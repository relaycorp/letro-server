import { CloudEvent } from 'cloudevents';

interface OutgoingServiceMessageOptions {
  readonly parcelId?: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

export function makeOutgoingServiceMessage(
  options: OutgoingServiceMessageOptions,
): CloudEvent<Buffer> {
  return new CloudEvent({
    type: 'tech.relaycorp.awala.endpoint-internet.outgoing-service-message',
    id: options.parcelId,
    source: options.senderId,
    subject: options.recipientId,
    datacontenttype: options.contentType,
    data: options.content,
  });
}
