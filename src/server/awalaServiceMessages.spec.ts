import { jest } from '@jest/globals';
import { CloudEvent } from 'cloudevents';
import type { FastifyInstance } from 'fastify';

import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { postEvent } from '../testUtils/eventing/cloudEvents.js';
import { partialPinoLog, type MockLogSet } from '../testUtils/logging.js';
import { mockSpy } from '../testUtils/jest.js';
import { mockEmitter } from '../testUtils/eventing/mockEmitter.js';
import { CE_CONTENT_TYPE, CE_DATA, CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';
import type { MessageSinkHandler } from '../sinks/types.js';
import type { IncomingServiceMessage } from '../utilities/awalaEndpoint.js';

const mockHandler: jest.Mock<MessageSinkHandler> = mockSpy(jest.fn());
jest.unstable_mockModule('../sinks/accountCreation/accountCreation.js', () => ({
  default: { contentType: CE_CONTENT_TYPE, handler: mockHandler },
}));
const { makeTestServer } = await import('../testUtils/server.js');

const EVENT = new CloudEvent({
  id: CE_ID,
  type: 'tech.relaycorp.awala.endpoint-internet.incoming-service-message',
  source: CE_SOURCE,
  subject: 'subject',
  datacontenttype: CE_CONTENT_TYPE,
  data: CE_DATA,
});

describe('Awala service messages', () => {
  const emitter = mockEmitter();

  const getTestServerFixture = makeTestServer();
  let logs: MockLogSet;
  let server: FastifyInstance;
  beforeEach(() => {
    ({ server, logs } = getTestServerFixture());
  });

  test('Invalid CloudEvent should be refused', async () => {
    const response = await server.inject({ method: 'POST', url: '/' });

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
    expect(response.json()).toHaveProperty('message', 'Invalid CloudEvent');
  });

  test('Invalid event type should be refused', async () => {
    const invalidEvent = EVENT.cloneWith({ type: `not.${EVENT.type}` });

    const response = await postEvent(invalidEvent, server);

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
    expect(response.json()).toHaveProperty('message', 'Invalid incoming service message');
    expect(logs).toContainEqual(
      partialPinoLog('warn', 'Invalid incoming service message', {
        err: expect.objectContaining({ type: 'Error' }),
      }),
    );
  });

  test('Unsupported content type should be refused', async () => {
    const contentType = 'text/plain';
    const invalidEvent = EVENT.cloneWith({ datacontenttype: contentType });

    const response = await postEvent(invalidEvent, server);

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
    expect(response.json()).toHaveProperty('message', 'Unsupported service message content type');
    expect(logs).toContainEqual(
      partialPinoLog('warn', 'Unsupported service message content type', {
        contentType,
        parcelId: EVENT.id,
      }),
    );
  });

  test('Handler should be passed logger containing content type', async () => {
    const logMessage = 'This is the log message';
    // eslint-disable-next-line @typescript-eslint/require-await
    mockHandler.mockImplementation(async (_event, { logger }) => {
      logger.info(logMessage);
      return true;
    });

    await postEvent(EVENT, server);

    expect(logs).toContainEqual(partialPinoLog('info', logMessage));
  });

  test('Handler should be passed emitter', async () => {
    await postEvent(EVENT, server);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emitter }),
    );
  });

  test('Handler should be passed DB connection', async () => {
    await postEvent(EVENT, server);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dbConnection: expect.anything() }),
    );
  });

  test('Handler should be passed equivalent message', async () => {
    await postEvent(EVENT, server);

    const expectedMessage: IncomingServiceMessage = {
      parcelId: EVENT.id,
      senderId: EVENT.source,
      recipientId: EVENT.subject!,
      contentType: EVENT.datacontenttype!,
      content: EVENT.data!,
    };
    expect(mockHandler).toHaveBeenCalledWith(expectedMessage, expect.anything());
  });

  test('HTTP 204 No Content should be returned if handler returns true', async () => {
    mockHandler.mockResolvedValue(true);

    const response = await postEvent(EVENT, server);

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.NO_CONTENT);
  });

  test('HTTP 503 Service Unavailable should be returned if handler returns false', async () => {
    mockHandler.mockResolvedValue(false);

    const response = await postEvent(EVENT, server);

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
  });
});
