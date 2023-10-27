import { AsnParser, AsnSerializer } from '@peculiar/asn1-schema';
import { derDeserializeRSAPublicKey, getIdFromIdentityKey } from '@relaycorp/relaynet-core';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { FastifyBaseLogger } from 'fastify';
import type { BaseLogger } from 'pino';

import type { MessageSink } from '../types.js';
import { ContactPairingRequest as RequestModel } from '../../models/ContactPairingRequest.model.js';
import {
  type IncomingServiceMessage,
  makeOutgoingServiceMessage,
} from '../../utilities/awalaEndpoint.js';
import type { Emitter } from '../../utilities/eventing/Emitter.js';
import { verifyVeraidSignature } from '../../utilities/veraid/signatureVerification.js';
import { isValidVeraidIdForUser } from '../../utilities/veraid/idValidation.js';

import { CONTACT_PAIRING_CONTENT_TYPES } from './contentTypes.js';
import { ContactPairingRequest } from './schemas/ContactPairingRequest.schema.js';
import {
  ContactPairingFailure,
  ContactPairingFailureReason,
} from './schemas/ContactPairingFailure.schema.js';

interface PairingPeer {
  readonly endpointId: string;
  readonly veraId: string;
}

interface SignedPairingRequest {
  readonly requesterVeraidId: string;
  readonly requesterVeraidName?: string;
  readonly requesterAwalaIdKeyDer: Buffer;
  readonly targetVeraidId: string;
}

async function extractSignedPairingRequest(
  signatureBundle: Buffer,
  logger: FastifyBaseLogger,
): Promise<SignedPairingRequest | null> {
  const verificationResult = await verifyVeraidSignature(signatureBundle);
  if (!verificationResult.didSucceed) {
    logger.info(
      { err: verificationResult.context },
      'Refused invalid VeraId SignatureBundle for contact pairing request',
    );
    return null;
  }

  let request: ContactPairingRequest;
  try {
    request = AsnParser.parse(verificationResult.result.plaintext, ContactPairingRequest);
  } catch (err) {
    logger.info({ err }, 'Refused malformed contact pairing request');
    return null;
  }

  const requesterAwalaEndpointPublicKey = Buffer.from(
    AsnSerializer.serialize(request.requesterAwalaEndpointPublicKey),
  );
  return {
    requesterVeraidId: verificationResult.result.signerVeraidId,
    requesterVeraidName: verificationResult.result.signerVeraidName,
    requesterAwalaIdKeyDer: requesterAwalaEndpointPublicKey,
    targetVeraidId: request.targetVeraidId,
  };
}

async function replyWithFailure(
  targetVeraidId: string,
  reason: ContactPairingFailureReason,
  senderId: string,
  recipientId: string,
  emitter: Emitter<unknown>,
) {
  const failureMessage = new ContactPairingFailure();
  failureMessage.targetContactVeraid = targetVeraidId;
  failureMessage.reason = reason;
  const failureEvent = makeOutgoingServiceMessage({
    senderId,
    recipientId,
    contentType: CONTACT_PAIRING_CONTENT_TYPES.FAILURE,
    content: Buffer.from(AsnSerializer.serialize(failureMessage)),
  });
  await emitter.emit(failureEvent);
}

async function validatePairingRequest(
  {
    requesterVeraidId,
    requesterVeraidName,
    requesterAwalaIdKeyDer,
    targetVeraidId,
  }: SignedPairingRequest,
  message: IncomingServiceMessage,
  logger: FastifyBaseLogger,
  emitter: Emitter<unknown>,
): Promise<boolean> {
  if (requesterVeraidName === undefined) {
    logger.info({ requesterVeraidId }, 'Refused contact pairing request from a VeraId org bot');
    await replyWithFailure(
      targetVeraidId,
      ContactPairingFailureReason.INVALID_REQUESTER_VERAID,
      message.recipientId,
      message.senderId,
      emitter,
    );
    return false;
  }

  const requestAwareLogger = logger.child({ requesterVeraidId, targetVeraidId });

  const requesterAwalaIdKey = await derDeserializeRSAPublicKey(requesterAwalaIdKeyDer);
  const expectedRequesterAwalaId = await getIdFromIdentityKey(requesterAwalaIdKey);
  if (message.senderId !== expectedRequesterAwalaId) {
    requestAwareLogger.info(
      'Refused pairing request due to mismatching Awala endpoint key from sender',
    );
    await replyWithFailure(
      targetVeraidId,
      ContactPairingFailureReason.INVALID_REQUESTER_AWALA_KEY,
      message.recipientId,
      message.senderId,
      emitter,
    );
    return false;
  }

  if (!isValidVeraidIdForUser(targetVeraidId)) {
    requestAwareLogger.info('Refused pairing request because the target is not a VeraId user id');
    await replyWithFailure(
      targetVeraidId,
      ContactPairingFailureReason.INVALID_TARGET_VERAID,
      message.recipientId,
      message.senderId,
      emitter,
    );
    return false;
  }

  return true;
}

async function processMatch(
  requester: PairingPeer,
  targetVeraidId: string,
  bundle: Buffer,
  ownEndpointId: string,
  emitter: Emitter<unknown>,
  requestModel: ReturnModelType<typeof RequestModel>,
  logger: BaseLogger,
) {
  const matchMessage = makeOutgoingServiceMessage({
    senderId: ownEndpointId,
    recipientId: requester.endpointId,
    contentType: CONTACT_PAIRING_CONTENT_TYPES.REQUEST,
    content: bundle,
  });
  await emitter.emit(matchMessage);
  await requestModel.deleteOne({ requesterVeraId: requester.veraId, targetVeraId: targetVeraidId });
  logger.debug({ peerId: requester.endpointId, parcelId: matchMessage.id }, 'Pairing match sent');
}

const pairingRequest: MessageSink = {
  contentType: CONTACT_PAIRING_CONTENT_TYPES.REQUEST,

  async handler(message, { logger, emitter, dbConnection }) {
    const signedPairingRequest = await extractSignedPairingRequest(message.content, logger);
    if (!signedPairingRequest) {
      return true;
    }

    const isPairingRequestValid = await validatePairingRequest(
      signedPairingRequest,
      message,
      logger,
      emitter,
    );
    if (!isPairingRequestValid) {
      return true;
    }

    const { requesterVeraidId, requesterAwalaIdKeyDer, targetVeraidId } = signedPairingRequest;

    const requestModel = getModelForClass(RequestModel, {
      existingConnection: dbConnection,
    });

    // Create the request unconditionally, and then check if there's a match. We shouldn't check
    // for a match first in case the two matching requests are received in quick succession.
    await requestModel.updateOne(
      { requesterVeraId: requesterVeraidId, targetVeraId: targetVeraidId },
      {
        requesterVeraId: requesterVeraidId,
        targetVeraidId,
        requesterEndpointId: message.senderId,
        requesterIdKey: requesterAwalaIdKeyDer,
        signatureBundle: message.content,
      },
      { upsert: true },
    );

    const requestAwareLogger = logger.child({ requesterVeraidId, targetVeraidId });

    const matchingRequest = await requestModel.findOne({
      requesterVeraId: targetVeraidId,
      targetVeraId: requesterVeraidId,
    });
    if (matchingRequest) {
      await processMatch(
        { endpointId: message.senderId, veraId: requesterVeraidId },
        targetVeraidId,
        message.content,
        message.recipientId,
        emitter,
        requestModel,
        requestAwareLogger,
      );

      await processMatch(
        {
          endpointId: matchingRequest.requesterEndpointId,
          veraId: matchingRequest.requesterVeraId,
        },
        matchingRequest.targetVeraId,
        matchingRequest.signatureBundle!,
        message.recipientId,
        emitter,
        requestModel,
        requestAwareLogger,
      );

      requestAwareLogger.info('Contact request matched');
    } else {
      requestAwareLogger.info('Contact request created or updated');
    }

    return true;
  },
};

export default pairingRequest;
