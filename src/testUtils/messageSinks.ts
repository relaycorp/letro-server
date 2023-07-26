import type { CloudEvent } from 'cloudevents';
import type { Connection } from 'mongoose';

import type { MessageSink } from '../incomingMessageSinks/sinkTypes.js';

import { type MockLogSet, makeMockLogging } from './logging.js';
import { mockEmitter } from './eventing/mockEmitter.js';
import { setUpTestDbConnection } from './db.js';

interface TestRunnerOptions {
  readonly senderEndpointId: string;
}

interface TestRunnerContext {
  readonly logs: MockLogSet;
  readonly emittedEvents: CloudEvent[];
  readonly getDbConnection: () => Connection;

  readonly senderEndpointId: string;
  readonly recipientEndpointId: string;

  readonly runner: (content: Buffer, options?: Partial<TestRunnerOptions>) => Promise<void>;
}

export function makeSinkTestRunner(sink: MessageSink): TestRunnerContext {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();
  const getDbConnection = setUpTestDbConnection();
  const senderEndpointId = 'sender endpoint id';
  const recipientEndpointId = 'recipient';

  return {
    logs: mockLogger.logs,
    emittedEvents: emitter.events,
    getDbConnection,
    senderEndpointId,
    recipientEndpointId,

    runner: async (content: Buffer, options) => {
      await expect(
        sink.handler(
          {
            parcelId: 'parcel id',
            senderId: options?.senderEndpointId ?? senderEndpointId,
            recipientId: recipientEndpointId,
            contentType: sink.contentType,
            content,
          },
          { logger: mockLogger.logger, emitter, dbConnection: getDbConnection() },
        ),
      ).resolves.toBeTrue();
    },
  };
}
