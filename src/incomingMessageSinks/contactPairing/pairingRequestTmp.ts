import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { BaseLogger } from 'pino';

import type { MessageSink } from '../sinkTypes.js';
import { ContactPairingRequest } from '../../models/ContactPairingRequest.model.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';
import type { Emitter } from '../../utilities/eventing/Emitter.js';

const MATCH_CONTENT_TYPE = 'application/vnd.relaycorp.letro.pairing-match-tmp';

function serialiseMatchContent(
  requesterVeraId: string,
  targetVeraId: string,
  targetEndpointId: string,
  targetIdKey: Buffer,
) {
  const targetIdKeyEncoded = targetIdKey.toString('base64');
  return Buffer.from(
    `${requesterVeraId},${targetVeraId},${targetEndpointId},${targetIdKeyEncoded}`,
  );
}

interface Requester {
  readonly endpointId: string;
  readonly veraId: string;
}

interface Target {
  readonly endpointIdKey: Buffer;
  readonly veraId: string;
}

async function processMatch(
  requester: Requester,
  target: Target,
  ownEndpointId: string,
  emitter: Emitter<unknown>,
  requestModel: ReturnModelType<typeof ContactPairingRequest>,
  logger: BaseLogger,
) {
  const matchMessage = makeOutgoingServiceMessage({
    senderId: ownEndpointId,
    recipientId: requester.endpointId,
    contentType: MATCH_CONTENT_TYPE,

    content: serialiseMatchContent(
      requester.veraId,
      target.veraId,
      requester.endpointId,
      target.endpointIdKey,
    ),
  });
  await emitter.emit(matchMessage);
  await requestModel.deleteOne({ requesterVeraId: requester.veraId, targetVeraId: target.veraId });
  logger.debug({ peerId: requester.endpointId, parcelId: matchMessage.id }, 'Pairing match sent');
}

const pairingRequestTmp: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.pairing-request-tmp',

  async handler(message, { logger, emitter, dbConnection }) {
    const [requesterVeraId, targetVeraId, requesterIdKeyBase64] = message.content
      .toString()
      .split(',');
    if (!requesterIdKeyBase64) {
      logger.info('Refused malformed request containing fewer than 3 fields');
      return true;
    }

    const requestModel = getModelForClass(ContactPairingRequest, {
      existingConnection: dbConnection,
    });

    // Create the request unconditionally, and then check if there's a match. We shouldn't check
    // for a match first in case the two matching requests are received in quick succession.
    const requesterIdKey = Buffer.from(requesterIdKeyBase64, 'base64');
    await requestModel.updateOne(
      { requesterVeraId, targetVeraId },
      {
        requesterVeraId,
        targetVeraId,
        requesterEndpointId: message.senderId,
        requesterIdKey,
      },
      { upsert: true },
    );

    const matchingRequest = await requestModel.findOne({
      requesterVeraId: targetVeraId,
      targetVeraId: requesterVeraId,
    });
    if (matchingRequest) {
      await processMatch(
        { endpointId: message.senderId, veraId: requesterVeraId },
        { endpointIdKey: matchingRequest.requesterIdKey, veraId: targetVeraId },
        message.recipientId,
        emitter,
        requestModel,
        logger,
      );

      await processMatch(
        {
          endpointId: matchingRequest.requesterEndpointId,
          veraId: matchingRequest.requesterVeraId,
        },
        { endpointIdKey: requesterIdKey, veraId: matchingRequest.targetVeraId },
        message.recipientId,
        emitter,
        requestModel,
        logger,
      );

      logger.info({ requesterVeraId, targetVeraId }, 'Contact request matched');
    } else {
      logger.info({ requesterVeraId, targetVeraId }, 'Contact request created or updated');
    }

    return true;
  },
};

export default pairingRequestTmp;
export { MATCH_CONTENT_TYPE };
