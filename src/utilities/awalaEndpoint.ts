import { randomUUID } from 'node:crypto';

import { CloudEvent, type CloudEventV1 } from 'cloudevents';
import { addMonths } from 'date-fns';

const OUTGOING_MESSAGE_TTL_MONTHS = 3;

interface ServiceMessage {
  readonly senderId: string;
  readonly recipientId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

const INCOMING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.incoming-service-message';
export const OUTGOING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.outgoing-service-message';

export interface OutgoingServiceMessage extends ServiceMessage {
  readonly parcelId?: string;
  readonly expiry?: Date;
}

export interface IncomingServiceMessage extends ServiceMessage {
  readonly parcelId: string;
}

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
    parcelId: event.id,
    senderId: event.source,
    recipientId: event.subject,
    contentType: event.datacontenttype,
    content: event.data,
  };
}

export function makeOutgoingServiceMessage(options: OutgoingServiceMessage): CloudEvent<Buffer> {
  const expiry = options.expiry ?? addMonths(new Date(), OUTGOING_MESSAGE_TTL_MONTHS);
  return new CloudEvent({
    type: OUTGOING_SERVICE_MESSAGE_TYPE,
    id: options.parcelId ?? randomUUID(),
    expiry: expiry.toISOString(),
    source: options.senderId,
    subject: options.recipientId,
    datacontenttype: options.contentType,
    data: options.content,
  });
}
