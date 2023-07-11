import { randomUUID } from 'node:crypto';

import { CloudEvent, type CloudEventV1 } from 'cloudevents';

const INCOMING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.incoming-service-message';
const OUTGOING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.outgoing-service-message';

interface ServiceMessage {
  readonly senderId: string;
  readonly recipientId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

export interface OutgoingServiceMessage extends ServiceMessage {
  readonly parcelId?: string;
}

export type IncomingServiceMessage = ServiceMessage;

export function makeIncomingServiceMessage(event: CloudEventV1<Buffer>): IncomingServiceMessage {
  if (event.type !== INCOMING_SERVICE_MESSAGE_TYPE) {
    throw new Error('Invalid event type');
  }
  if (event.subject === undefined) {
    throw new Error('Missing event subject');
  }
  if (event.datacontenttype === undefined) {
    throw new Error('Missing event data content type');
  }
  if (event.data === undefined) {
    throw new Error('Missing event data');
  }
  return {
    senderId: event.source,
    recipientId: event.subject,
    contentType: event.datacontenttype,
    content: event.data,
  };
}

export function makeOutgoingServiceMessage(options: OutgoingServiceMessage): CloudEvent<Buffer> {
  return new CloudEvent({
    type: OUTGOING_SERVICE_MESSAGE_TYPE,
    id: options.parcelId ?? randomUUID(),
    source: options.senderId,
    subject: options.recipientId,
    datacontenttype: options.contentType,
    data: options.content,
  });
}
