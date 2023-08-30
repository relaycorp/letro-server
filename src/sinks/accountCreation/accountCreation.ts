import type { MessageSink } from '../types.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const accountCreation: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-creation-request',

  async handler(message, { logger, emitter }) {
    const outgoingEvent1 = makeOutgoingServiceMessage({
      content: message.content,
      contentType: 'application/vnd.relaycorp.letro.account-creation-completed',
      recipientId: message.senderId,
      senderId: message.recipientId,
    });
    await emitter.emit(outgoingEvent1);

    const requestedId = message.content.toString();
    const outgoingEvent2 = makeOutgoingServiceMessage({
      content: Buffer.from(`${requestedId},${requestedId}`),
      contentType: 'application/vnd.relaycorp.letro.account-creation-completed-tmp',
      recipientId: message.senderId,
      senderId: message.recipientId,
    });
    await emitter.emit(outgoingEvent2);

    logger.info({ sender: message.senderId }, 'Account creation request received');

    return true;
  },
};

export default accountCreation;
