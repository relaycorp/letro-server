import type { MessageSink } from '../sinkTypes.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const accountCreation: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-claim-request',

  async handler(event, { logger, emitter }) {
    logger.info({ id: event.id }, 'Account claim request received');

    const { domainName } = JSON.parse((event.data as Buffer).toString());
    const userId = `alice@${domainName}`;

    const outgoingEvent = makeOutgoingServiceMessage({
      content: Buffer.from(userId),
      contentType: 'application/vnd.relaycorp.letro.account-claim-completed',
      recipientId: event.source,
      senderId: event.subject!,
    });
    await emitter.emit(outgoingEvent);

    return true;
  },
};

export default accountCreation;
