import type { MessageSink } from '../sinkTypes.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const accountCreation: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-creation-request',

  async handler(message, { logger, emitter }) {
    logger.info({ sender: message.senderId }, 'Account creation request received');

    const outgoingEvent = makeOutgoingServiceMessage({
      content: message.content,
      contentType: 'application/vnd.relaycorp.letro.account-creation-completed',
      recipientId: message.senderId,
      senderId: message.recipientId,
    });
    await emitter.emit(outgoingEvent);

    return true;
  },
};

export default accountCreation;
