import type { FastifyInstance, FastifyPluginCallback, RouteOptions } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from './utilities/fastify/server.js';
import healthcheckRoutes from './routes/healthcheck.routes.js';

async function makeServerPlugin(server: FastifyInstance): Promise<void> {
  const rootRoutes: FastifyPluginCallback<RouteOptions>[] = [healthcheckRoutes];
  await Promise.all(rootRoutes.map((route) => server.register(route)));
}

export async function makeServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeServerPlugin, customLogger);
}
