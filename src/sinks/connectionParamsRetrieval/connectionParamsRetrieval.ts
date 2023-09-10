import {
  BindingType,
  resolveInternetAddress,
  UnreachableResolverError,
} from '@relaycorp/relaynet-core';
import envVar from 'env-var';
import isValidDomain from 'is-valid-domain';
import type { BaseLogger } from 'pino';

import type { MessageSink } from '../types.js';
import { RELAYCORP_LETRO_TYPES } from '../../utilities/letro.js';
import {
  type IncomingServiceMessage,
  makeOutgoingServiceMessage,
} from '../../utilities/awalaEndpoint.js';
import type { Emitter } from '../../utilities/eventing/Emitter.js';
import type { Result } from '../../utilities/result.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';

import { AWALA_CONTENT_TYPES } from './awala.js';

const MAX_DOMAIN_NAME_LENGTH = 128;

const HTTP_REQUEST_TIMEOUT = 3000;

interface RetrievalFailureContext {
  readonly shouldRetry: boolean;
}

function parseDomainName(domainNameBuffer: Buffer, logger: BaseLogger): string | null {
  const domainNameLength = domainNameBuffer.byteLength;
  if (domainNameLength > MAX_DOMAIN_NAME_LENGTH) {
    logger.info({ domainNameLength }, 'Requested domain name is too long');
    return null;
  }
  const domainName = domainNameBuffer.toString();
  if (!isValidDomain(domainName, { allowUnicode: true })) {
    logger.info({ domainName }, 'Requested domain name is malformed');
    return null;
  }
  return domainName;
}

async function replyWithMisconfiguredEndpoint(
  incomingMessage: IncomingServiceMessage,
  emitter: Emitter<unknown>,
) {
  const outgoingMessage = makeOutgoingServiceMessage({
    senderId: incomingMessage.recipientId,
    recipientId: incomingMessage.senderId,
    contentType: RELAYCORP_LETRO_TYPES.MISCONFIGURED_ENDPOINT,
    content: incomingMessage.content,
  });
  await emitter.emit(outgoingMessage);
}

async function resolveConnectionParamsUrl(
  internetAddress: string,
  logger: BaseLogger,
): Promise<Result<string, RetrievalFailureContext>> {
  let endpointAddress;
  try {
    endpointAddress = await resolveInternetAddress(internetAddress, BindingType.PDC);
  } catch (err) {
    if (err instanceof UnreachableResolverError) {
      logger.error({ err, internetAddress }, 'Failed to use DNS resolver');
      return { didSucceed: false, context: { shouldRetry: true } };
    }

    logger.info({ err, internetAddress }, 'Invalid Awala DNS configuration');
    return { didSucceed: false, context: { shouldRetry: false } };
  }

  if (endpointAddress === null) {
    logger.info({ internetAddress }, 'Awala endpoint record not found');
    return { didSucceed: false, context: { shouldRetry: false } };
  }

  logger.debug(
    { internetAddress, endpointHost: endpointAddress.host },
    'Awala endpoint record found',
  );

  const url = `https://${endpointAddress.host}:${endpointAddress.port}/connection-params.der`;
  return { didSucceed: true, result: url };
}

async function httpGet(url: string): Promise<Response> {
  const headers = new Headers();
  const serverVersion = envVar.get('VERSION').required().asString();
  headers.set('user-agent', `Letro-Server/${serverVersion}`);
  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT),
  });
}

async function retrieveConnectionParams(
  internetAddress: string,
  logger: BaseLogger,
): Promise<Result<ArrayBuffer, RetrievalFailureContext>> {
  const connectionParamsUrlResult = await resolveConnectionParamsUrl(internetAddress, logger);
  if (!connectionParamsUrlResult.didSucceed) {
    return connectionParamsUrlResult;
  }

  let response;
  try {
    response = await httpGet(connectionParamsUrlResult.result);
  } catch (err) {
    logger.error({ err, internetAddress }, 'Failed to retrieve connection params');
    return { didSucceed: false, context: { shouldRetry: true } };
  }

  if (response.ok) {
    const responseContentType = response.headers.get('content-type');
    if (responseContentType !== AWALA_CONTENT_TYPES.CONNECTION_PARAMS) {
      logger.info(
        { internetAddress, contentType: responseContentType },
        'Received invalid content type for connection params',
      );
      return { didSucceed: false, context: { shouldRetry: false } };
    }
    return { didSucceed: true, result: await response.arrayBuffer() };
  }

  const isClientErrorResponse = response.status < HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  if (isClientErrorResponse) {
    logger.info(
      { internetAddress, status: response.status },
      'Failed to retrieve connection params from non-PoHTTP-compatible server',
    );
    return { didSucceed: false, context: { shouldRetry: false } };
  }

  logger.info(
    { internetAddress, status: response.status },
    'Failed to retrieve connection params due to server error',
  );
  return { didSucceed: false, context: { shouldRetry: true } };
}

const connectionParamsRetrieval: MessageSink = {
  contentType: RELAYCORP_LETRO_TYPES.CONNECTION_PARAMS_REQUEST,

  async handler(message, { logger, emitter }) {
    const internetAddress = parseDomainName(message.content, logger);
    if (internetAddress === null) {
      return true;
    }

    const connectionParamsResult = await retrieveConnectionParams(internetAddress, logger);
    if (!connectionParamsResult.didSucceed) {
      const { shouldRetry } = connectionParamsResult.context;
      if (!shouldRetry) {
        await replyWithMisconfiguredEndpoint(message, emitter);
        return true;
      }
      return false;
    }

    const outgoingMessage = makeOutgoingServiceMessage({
      senderId: message.recipientId,
      recipientId: message.senderId,
      contentType: RELAYCORP_LETRO_TYPES.CONNECTION_PARAMS,
      content: Buffer.from(connectionParamsResult.result),
    });
    await emitter.emit(outgoingMessage);
    logger.info({ internetAddress }, 'Connection parameters sent');
    return true;
  },
};

export default connectionParamsRetrieval;
