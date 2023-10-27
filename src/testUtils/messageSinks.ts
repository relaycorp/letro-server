import type { CloudEvent } from 'cloudevents';
import type { Connection } from 'mongoose';

import type { MessageSink } from '../sinks/types.js';

import { makeMockLogging, type MockLogSet } from './logging.js';
import { mockEmitter } from './eventing/mockEmitter.js';
import { setUpTestDbConnection } from './db.js';
import { mockClientMaker } from './veraid/authority/clientMaker.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from './envVars.js';
import { type Endpoint, generateEndpoint } from './awala.js';

interface TestRunnerOptions {
  readonly senderEndpointId: string;
}

interface TestRunnerContext {
  readonly logs: MockLogSet;
  readonly emittedEvents: CloudEvent[];
  readonly getDbConnection: () => Connection;

  readonly senderEndpoint: Endpoint;
  readonly recipientEndpointId: string;

  readonly runner: (content: Buffer, options?: Partial<TestRunnerOptions>) => Promise<boolean>;
}

export async function makeSinkTestRunner(sink: MessageSink): Promise<TestRunnerContext> {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();
  const getDbConnection = setUpTestDbConnection();
  const veraidAuthClientMaker = mockClientMaker();

  const senderEndpoint = await generateEndpoint();
  const recipientEndpointId = 'letro-server-endpoint-id';

  configureMockEnvVars(REQUIRED_ENV_VARS);

  return {
    logs: mockLogger.logs,
    emittedEvents: emitter.events,
    getDbConnection,

    senderEndpoint,
    recipientEndpointId,

    runner: async (content: Buffer, options) =>
      sink.handler(
        {
          parcelId: 'parcel id',
          senderId: options?.senderEndpointId ?? senderEndpoint.id,
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
