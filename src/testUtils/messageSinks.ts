import type { CloudEvent } from 'cloudevents';
import type { Connection } from 'mongoose';

import type { MessageSink } from '../sinks/types.js';

import { type MockLogSet, makeMockLogging } from './logging.js';
import { mockEmitter } from './eventing/mockEmitter.js';
import { setUpTestDbConnection } from './db.js';
import { mockClientMaker } from './veraid/authority/clientMaker.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from './envVars.js';

interface TestRunnerOptions {
  readonly senderEndpointId: string;
}

interface TestRunnerContext {
  readonly logs: MockLogSet;
  readonly emittedEvents: CloudEvent[];
  readonly getDbConnection: () => Connection;

  readonly senderEndpointId: string;
  readonly recipientEndpointId: string;

  readonly runner: (content: Buffer, options?: Partial<TestRunnerOptions>) => Promise<boolean>;
}

export function makeSinkTestRunner(sink: MessageSink): TestRunnerContext {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();
  const getDbConnection = setUpTestDbConnection();
  const veraidAuthClientMaker = mockClientMaker();

  const senderEndpointId = 'sender-endpoint-id';
  const recipientEndpointId = 'recipient-endpoint-id';

  configureMockEnvVars(REQUIRED_ENV_VARS);

  return {
    logs: mockLogger.logs,
    emittedEvents: emitter.events,
    getDbConnection,

    senderEndpointId,
    recipientEndpointId,

    runner: async (content: Buffer, options) =>
      sink.handler(
        {
          parcelId: 'parcel id',
          senderId: options?.senderEndpointId ?? senderEndpointId,
          recipientId: recipientEndpointId,
          contentType: sink.contentType,
          content,
        },
        {
          logger: mockLogger.logger,
          emitter,
          dbConnection: getDbConnection(),
          veraidAuthClientMaker,
        },
      ),
  };
}
