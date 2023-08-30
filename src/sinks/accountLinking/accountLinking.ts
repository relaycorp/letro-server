import type { MessageSink } from '../types.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const accountLinking: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-claim-request',

  async handler(message, { logger, emitter }) {
    logger.info({ sender: message.senderId }, 'Account claim request received');

    const { domainName } = JSON.parse(message.content.toString());
    const userId = `alice@${domainName}`;

    const outgoingEvent = makeOutgoingServiceMessage({
      content: Buffer.from(userId),
      contentType: 'application/vnd.relaycorp.letro.account-claim-completed',
      recipientId: message.senderId,
      senderId: message.recipientId,
    });
    await emitter.emit(outgoingEvent);

    return true;
  },
};

export default accountLinking;
