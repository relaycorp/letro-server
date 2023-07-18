import { getModelForClass } from '@typegoose/typegoose';

import type { MessageSink } from '../sinkTypes.js';
import { ContactPairingRequest } from '../../models/ContactPairingRequest.model.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const MATCH_CONTENT_TYPE = 'application/vnd.relaycorp.letro.contact-pairing-match-tmp';

function serialiseMatchContent(
  targetId: string,
  requesterId: string,
  targetEndpointId: string,
  targetIdKey: Buffer,
) {
  const targetIdKeyEncoded = targetIdKey.toString('base64');
  return Buffer.from(`${targetId},${requesterId},${targetEndpointId},${targetIdKeyEncoded}`);
}

const pairingRequestTmp: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.contact-pairing-request-tmp',

  async handler(message, { logger, emitter, dbConnection }) {
    const [requesterId, targetId, requesterIdKeyBase64] = message.content.toString().split(',');
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
      { requesterId, targetId },
      {
        requesterId,
        targetId,
        requesterEndpointId: message.senderId,
        requesterIdKey,
      },
      { upsert: true },
    );
    logger.info({ requesterId, targetId }, 'Contact request created or updated');

    const matchingRequest = await requestModel.findOne({
      requesterId: targetId,
      targetId: requesterId,
    });
    if (matchingRequest) {
      const outgoingRequest1 = makeOutgoingServiceMessage({
        senderId: message.recipientId,
        recipientId: message.senderId,
        contentType: MATCH_CONTENT_TYPE,

        content: serialiseMatchContent(
          targetId,
          requesterId,
          message.senderId,
          matchingRequest.requesterIdKey,
        ),
      });
      await emitter.emit(outgoingRequest1);

      const outgoingRequest2 = makeOutgoingServiceMessage({
        senderId: message.recipientId,
        recipientId: matchingRequest.requesterEndpointId,
        contentType: MATCH_CONTENT_TYPE,

        content: serialiseMatchContent(
          requesterId,
          targetId,
          matchingRequest.requesterEndpointId,
          requesterIdKey,
        ),
      });
      await emitter.emit(outgoingRequest2);

      await requestModel.deleteOne({ requesterId, targetId });
      await requestModel.deleteOne({ requesterId: targetId, targetId: requesterId });
      logger.info({ requesterId, targetId }, 'Contact request matched');
    }

    return true;
  },
};

export default pairingRequestTmp;
export { MATCH_CONTENT_TYPE };
