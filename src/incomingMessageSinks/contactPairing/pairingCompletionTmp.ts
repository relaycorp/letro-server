import { PrivateEndpointConnParams } from '@relaycorp/relaynet-core';

import type { MessageSink } from '../sinkTypes.js';
import { bufferToArrayBuffer } from '../../utilities/buffer.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const PAIRING_COMPLETE_CONTENT_TYPE =
  'application/vnd.relaycorp.letro.contact-pairing-complete-tmp';

const pairingCompletionTmp: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.contact-connection-params-tmp',

  async handler(message, { logger, emitter }) {
    let connectionParams: PrivateEndpointConnParams;
    const connParamsArrayBuffer = bufferToArrayBuffer(message.content);
    try {
      connectionParams = await PrivateEndpointConnParams.deserialize(connParamsArrayBuffer);
    } catch (err) {
      logger.info({ err }, 'Refused malformed connection params');
      return true;
    }

    const pda = connectionParams.deliveryAuth.leafCertificate;

    const granterId = pda.getIssuerId();
    if (granterId !== message.senderId) {
      logger.info(
        { messageSenderId: message.senderId, granterId },
        'Refused connection params not issued by sender',
      );
      return true;
    }

    const granteeId = await pda.calculateSubjectId();
    const completionEvent = makeOutgoingServiceMessage({
      senderId: message.recipientId,
      recipientId: granteeId,
      contentType: PAIRING_COMPLETE_CONTENT_TYPE,
      content: Buffer.from(`${granterId},${message.content.toString('base64')}`),
    });
    await emitter.emit(completionEvent);

    logger.info({ granterId, granteeId }, 'Forwarded connection params to contact');

    return true;
  },
};

export default pairingCompletionTmp;
export { PAIRING_COMPLETE_CONTENT_TYPE };
