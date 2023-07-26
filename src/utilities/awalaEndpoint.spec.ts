import { CloudEvent } from 'cloudevents';
import { addMonths, parseISO } from 'date-fns';

import { CE_CONTENT_TYPE, CE_DATA, CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';

import {
  makeIncomingServiceMessage,
  makeOutgoingServiceMessage,
  type OutgoingServiceMessage,
} from './awalaEndpoint.js';

describe('makeIncomingServiceMessage', () => {
  const event = new CloudEvent({
    id: CE_ID,
    type: 'tech.relaycorp.awala.endpoint-internet.incoming-service-message',
    source: CE_SOURCE,
    subject: 'recipient',
    datacontenttype: CE_CONTENT_TYPE,
    data: CE_DATA,
  });

  test('Event type should be that of an incoming service message', () => {
    const invalidEvent = event.cloneWith({ type: `not.${event.type}` });

    expect(() => makeIncomingServiceMessage(invalidEvent)).toThrow('Invalid event type');
  });

  test('Sender should be taken from event source', () => {
    const message = makeIncomingServiceMessage(event);

    expect(message.senderId).toBe(event.source);
  });

  test('Parcel id should be taken from event id', () => {
    const message = makeIncomingServiceMessage(event);

    expect(message.parcelId).toBe(event.id);
  });

  describe('Recipient', () => {
    test('Should be taken from event subject', () => {
      const message = makeIncomingServiceMessage(event);

      expect(message.recipientId).toBe(event.subject);
    });

    test('Event should refused if subject is not set', () => {
      const invalidEvent = event.cloneWith({ subject: undefined });

      expect(() => makeIncomingServiceMessage(invalidEvent)).toThrow('Missing event subject');
    });
  });

  describe('Content type', () => {
    test('Should be taken from event data content type', () => {
      const message = makeIncomingServiceMessage(event);

      expect(message.contentType).toBe(event.datacontenttype);
    });

    test('Event should be refused if data content type is not set', () => {
      const invalidEvent = event.cloneWith({ datacontenttype: undefined });

      expect(() => makeIncomingServiceMessage(invalidEvent)).toThrow(
        'Missing event data content type',
      );
    });
  });

  describe('Content', () => {
    test('Should be taken from event data', () => {
      const message = makeIncomingServiceMessage(event);

      expect(message.content).toBe(event.data);
    });

    test('Event should be refused if data is not set', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
      const invalidEvent = event.cloneWith({ data: undefined, data_base64: undefined });

      expect(() => makeIncomingServiceMessage(invalidEvent)).toThrow('Missing event data');
    });
  });
});

describe('makeOutgoingServiceMessage', () => {
  const message: OutgoingServiceMessage = {
    parcelId: 'parcel',
    senderId: 'sender',
    recipientId: 'recipient',
    contentType: CE_CONTENT_TYPE,
    content: CE_DATA,
  };

  test('Event type should be that of an outgoing service message', () => {
    const event = makeOutgoingServiceMessage(message);

    expect(event.type).toBe('tech.relaycorp.awala.endpoint-internet.outgoing-service-message');
  });

  describe('Event id', () => {
    test('Should be taken from service message if set', () => {
      const event = makeOutgoingServiceMessage(message);

      expect(event.id).toBe(message.parcelId);
    });

    test('Should be generated if not set', () => {
      const event = makeOutgoingServiceMessage({ ...message, parcelId: undefined });

      expect(event.id).toMatch(/[\da-f-]{36}/u);
    });
  });

  describe('Expiry', () => {
    test('Should be taken from service message if set', () => {
      const expiry = new Date();

      const event = makeOutgoingServiceMessage({ ...message, expiry });

      expect(parseISO(event.expiry as string)).toMatchObject(expiry);
    });

    test('Should default to 3 months from now if not set', () => {
      const beforeDate = new Date();

      const event = makeOutgoingServiceMessage({ ...message, expiry: undefined });

      const afterDate = new Date();
      const expiry = parseISO(event.expiry as string);
      expect(expiry).toBeAfterOrEqualTo(addMonths(beforeDate, 3));
      expect(expiry).toBeBeforeOrEqualTo(addMonths(afterDate, 3));
    });
  });

  test('Event should should be the message sender id', () => {
    const event = makeOutgoingServiceMessage(message);

    expect(event.source).toBe(message.senderId);
  });

  test('Event subject should be the message recipient id', () => {
    const event = makeOutgoingServiceMessage(message);

    expect(event.subject).toBe(message.recipientId);
  });

  test('Event data content type should be the message content type', () => {
    const event = makeOutgoingServiceMessage(message);

    expect(event.datacontenttype).toBe(message.contentType);
  });

  test('Event data should be the message content', () => {
    const event = makeOutgoingServiceMessage(message);

    expect(event.data).toBe(message.content);
  });
});
