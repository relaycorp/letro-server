import type { MessageSink } from '../sinkTypes.js';
import { makeOutgoingServiceMessage } from '../../utilities/awalaEndpoint.js';

const accountCreation: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-creation-request',

  async handler(event, { logger, emitter }) {
    logger.info({ id: event.id }, 'Account creation request received');

    const outgoingEvent = makeOutgoingServiceMessage({
      content: event.data as Buffer,
      contentType: 'application/vnd.relaycorp.letro.account-creation-completed',
      recipientId: event.source,
      senderId: event.subject!,
    });
    await emitter.emit(outgoingEvent);

    return true;
  },
};

export default accountCreation;
