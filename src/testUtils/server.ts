import type { FastifyInstance } from 'fastify';
import type { Connection } from 'mongoose';

import { makeServer } from '../server/server.js';

import { makeMockLogging, type MockLogSet } from './logging.js';
import { configureMockEnvVars, type EnvVarMocker, REQUIRED_ENV_VARS } from './envVars.js';
import { setUpTestDbConnection } from './db.js';

interface TestServerFixture {
  readonly server: FastifyInstance;
  readonly dbConnection: Connection;
  readonly logs: MockLogSet;
  readonly envVarMocker: EnvVarMocker;
}

export function makeTestServer(): () => TestServerFixture {
  const envVarMocker = configureMockEnvVars(REQUIRED_ENV_VARS);
  const mockLogging = makeMockLogging();
  const getConnection = setUpTestDbConnection();

  let server: FastifyInstance;
  beforeEach(async () => {
    server = await makeServer(mockLogging.logger);
  });

  afterEach(async () => {
    await server.close();
  });

  return () => ({
    server,
    dbConnection: getConnection(),
    logs: mockLogging.logs,
    envVarMocker,
  });
}
