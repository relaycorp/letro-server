import type { CloudEventV1 } from 'cloudevents';
import type { FastifyInstance, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import { convertMessageToEvent } from '../utilities/eventing/receiver.js';
import type { MessageSink, MessageSinkHandler } from '../sinks/types.js';
import accountCreation from '../sinks/accountCreation/accountCreation.js';
import connParamsRetrieval from '../sinks/connectionParamsRetrieval/connectionParamsRetrieval.js';
import { Emitter } from '../utilities/eventing/Emitter.js';
import {
  type IncomingServiceMessage,
  makeIncomingServiceMessage,
} from '../utilities/awalaEndpoint.js';
import pairingRequest from '../sinks/contactPairing/pairingRequest.js';
import pairingRequestTmp from '../sinks/contactPairing/pairingRequestTmp.js';
import pairingAuth from '../sinks/contactPairing/pairingAuth.js';
import { VeraidAuthClientMaker } from '../utilities/veraid/VeraidAuthClientMaker.js';

const SINKS: MessageSink[] = [
  accountCreation,
  connParamsRetrieval,
  pairingRequest,
  pairingRequestTmp,
  pairingAuth,
];
const HANDLER_BY_TYPE: { [contentType: string]: MessageSinkHandler } = SINKS.reduce(
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
  const veraidAuthClientMaker = VeraidAuthClientMaker.init();
  fastify.route({
    method: ['POST'],
    url: '/',

    async handler(request, reply) {
      let event: CloudEventV1<Buffer>;
      try {
        event = convertMessageToEvent(request.headers, request.body as Buffer);
      } catch {
        return reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send({ message: 'Invalid CloudEvent' });
      }

      let message: IncomingServiceMessage;
      try {
        message = makeIncomingServiceMessage(event);
      } catch (err) {
        request.log.warn({ err }, 'Invalid incoming service message');
        return reply
          .status(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ message: 'Invalid incoming service message' });
      }

      const parcelAwareLogger = request.log.child({ parcelId: message.parcelId });

      const contentType = event.datacontenttype!;
      const handler = HANDLER_BY_TYPE[contentType] as MessageSinkHandler | undefined;
      if (handler === undefined) {
        parcelAwareLogger.warn({ contentType }, 'Unsupported service message content type');
        return reply
          .status(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ message: 'Unsupported service message content type' });
      }

      const context = {
        emitter,
        logger: parcelAwareLogger,
        dbConnection: fastify.mongoose,
        veraidAuthClientMaker,
      };
      const wasFulfilled = await handler(message, context);
      const responseCode = wasFulfilled
        ? HTTP_STATUS_CODES.NO_CONTENT
        : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;
      return reply.code(responseCode).send();
    },
  });

  done();
}
