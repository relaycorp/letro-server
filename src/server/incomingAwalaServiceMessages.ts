import type { CloudEventV1 } from 'cloudevents';
import type { FastifyInstance, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import { convertMessageToEvent } from '../utilities/eventing/receiver.js';
import type { MessageSink, MessageSinkHandler } from '../incomingMessageSinks/sinkTypes.js';
import accountCreation from '../incomingMessageSinks/accounts/accountCreation.js';
import { Emitter } from '../utilities/eventing/Emitter.js';

const INCOMING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.incoming-service-message';

const SINKS: MessageSink[] = [accountCreation];
const HANDLER_BY_CONTENT_TYPE: { [contentType: string]: MessageSinkHandler } = SINKS.reduce(
  (acc, sink) => ({ ...acc, [sink.contentType]: sink.handler }),
  {},
);

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, next) => {
    next(null, payload);
  });

  const emitter = Emitter.init();
  fastify.route({
    method: ['POST'],
    url: '/',

    async handler(request, reply) {
      let event: CloudEventV1<unknown>;
      try {
        event = convertMessageToEvent(request.headers, request.body as Buffer);
      } catch {
        return reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send({ message: 'Invalid CloudEvent' });
      }

      if (event.type !== INCOMING_SERVICE_MESSAGE_TYPE) {
        return reply
          .status(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ message: 'Invalid incoming service message' });
      }

      const serviceMessageContentType = event.datacontenttype!;
      const handler = HANDLER_BY_CONTENT_TYPE[serviceMessageContentType] as
        | MessageSinkHandler
        | undefined;
      if (handler === undefined) {
        return reply
          .status(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ message: 'Unsupported service message content type' });
      }

      const sinkLogger = request.log.child({ serviceMessageContentType });
      const context = {
        emitter,
        logger: sinkLogger,
      };
      const didSucceed = await handler(event, context);
      const responseCode = didSucceed
        ? HTTP_STATUS_CODES.NO_CONTENT
        : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;
      return reply.code(responseCode).send();
    },
  });

  done();
}
