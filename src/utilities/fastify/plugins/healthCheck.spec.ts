import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { HTTP_STATUS_CODES } from '../../http.js';
import { makeMockLogging, partialPinoLog } from '../../../testUtils/logging.js';
import { makeFastify } from '../server.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from '../../../testUtils/envVars.js';

import registerHealthCheck from './healthCheck.js';

describe('healthcheck routes', () => {
  configureMockEnvVars(REQUIRED_ENV_VARS);
  const mockLogging = makeMockLogging();

  let server: FastifyInstance;
  beforeEach(async () => {
    server = await makeFastify(registerHealthCheck as FastifyPluginCallback, mockLogging.logger);
  });
  afterEach(async () => {
    await server.close();
  });

  test('Response should report when server is running fine', async () => {
    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.OK);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
    expect(response.payload).toContain('Success');
  });

  test('Server error response should be returned if the database is not available', async () => {
    await server.mongoose.destroy(true);

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
    expect(response.payload).toContain('Failed to connect to the database');
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('error', 'Failed to connect to the database', {
        err: expect.objectContaining({ message: expect.anything() }),
      }),
    );
  });

  test('HEAD request should be supported', async () => {
    const response = await server.inject({ method: 'HEAD', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.OK);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
  });
});
