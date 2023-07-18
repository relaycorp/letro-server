import { getModelForClass } from '@typegoose/typegoose';

import type { MessageSink } from '../sinkTypes.js';
import { ContactPairingRequest } from '../../models/ContactPairingRequest.model.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const CONTENT_TYPE = 'application/vnd.relaycorp.letro.contact-request-tmp';

function serialiseContactRequestContent(
  targetId: string,
  requesterId: string,
  targetIdKey: Buffer,
) {
  const targetIdKeyEncoded = targetIdKey.toString('base64');
  return Buffer.from(`${targetId},${requesterId},${targetIdKeyEncoded}`);
}

const contactRequestTmp: MessageSink = {
  contentType: CONTENT_TYPE,

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
        contentType: CONTENT_TYPE,

        content: serialiseContactRequestContent(
          targetId,
          requesterId,
          matchingRequest.requesterIdKey,
        ),
      });
      await emitter.emit(outgoingRequest1);

      const outgoingRequest2 = makeOutgoingServiceMessage({
        senderId: message.recipientId,
        recipientId: matchingRequest.requesterEndpointId,
        contentType: CONTENT_TYPE,
        content: serialiseContactRequestContent(requesterId, targetId, requesterIdKey),
      });
      await emitter.emit(outgoingRequest2);

      await requestModel.deleteOne({ requesterId, targetId });
      await requestModel.deleteOne({ requesterId: targetId, targetId: requesterId });
      logger.info({ requesterId, targetId }, 'Contact request matched');
    }

    return true;
  },
};

export default contactRequestTmp;
