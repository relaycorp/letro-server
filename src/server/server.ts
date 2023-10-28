import type { FastifyInstance, FastifyPluginCallback, RouteOptions } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import registerHealthcheckRoutes from '../utilities/fastify/plugins/healthCheck.js';

import incomingAwalaServiceMessages from './awalaServiceMessages.js';

const rootRoutes: FastifyPluginCallback<RouteOptions>[] = [
  registerHealthcheckRoutes,
  incomingAwalaServiceMessages,
];

async function makeServerPlugin(server: FastifyInstance): Promise<void> {
  await Promise.all(rootRoutes.map((route) => server.register(route)));
}

export async function makeServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeServerPlugin, customLogger);
}
