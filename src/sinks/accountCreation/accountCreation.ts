import { AsnParser, AsnSerializer } from '@peculiar/asn1-schema';
import type { BaseLogger } from 'pino';

import type { MessageSink } from '../types.js';
import {
  type IncomingServiceMessage,
  makeOutgoingServiceMessage,
} from '../../utilities/awalaEndpoint.js';
import { RELAYCORP_LETRO_CONTENT_TYPES } from '../../utilities/letro.js';
import type { Emitter } from '../../utilities/eventing/Emitter.js';
import type { VeraidAuthClientMaker } from '../../utilities/VeraidAuthClientMaker.js';

import { AccountRequestSignature } from './schemas/AccountRequestSignature.js';
import { createVeraidUser, type UserCreationOutput } from './veraidAuth/userCreation.js';
import { sanitiseUserName } from './userNameValidation.js';
import { getDomainForLocale } from './veraidAuth/orgs.js';
import { AccountCreation } from './schemas/AccountCreation.js';
import type { AccountRequest } from './schemas/AccountRequest.js';

async function sendAccountCreationMessage(
  request: AccountRequest,
  userId: string,
  veraidBundle: ArrayBuffer,
  message: IncomingServiceMessage,
  emitter: Emitter<unknown>,
) {
  const creationMessage = new AccountCreation();
  creationMessage.requestedUserName = request.userName;
  creationMessage.locale = request.locale;
  creationMessage.assignedUserId = userId;
  creationMessage.veraidBundle = veraidBundle;
  const accountCreatedEvent = makeOutgoingServiceMessage({
    senderId: message.recipientId,
    recipientId: message.senderId,
    contentType: RELAYCORP_LETRO_CONTENT_TYPES.ACCOUNT_CREATION,
    content: Buffer.from(AsnSerializer.serialize(creationMessage)),
  });
  await emitter.emit(accountCreatedEvent);
}

async function getAndValidateRequest(
  requestSignatureSerialised: Buffer,
  logger: BaseLogger,
): Promise<AccountRequest | null> {
  let requestSignature;
  try {
    requestSignature = AsnParser.parse(requestSignatureSerialised, AccountRequestSignature);
  } catch (err) {
    logger.info({ err }, 'Ignored malformed account creation request');
    return null;
  }

  if (!(await requestSignature.verifySignature())) {
    logger.info({ requestSignature }, 'Ignored account creation request with invalid signature');
    return null;
  }
  return requestSignature.request;
}

async function createUser(
  request: AccountRequest,
  veraidAuthClientMaker: VeraidAuthClientMaker,
  logger: BaseLogger,
): Promise<(UserCreationOutput & { domainName: string }) | null> {
  const authorityClient = await veraidAuthClientMaker.make();
  const userName = sanitiseUserName(request.userName);
  const domainName = getDomainForLocale(request.locale);
  const publicKeyDer = AsnSerializer.serialize(request.publicKey);
  let output;
  try {
    output = await createVeraidUser(userName, domainName, publicKeyDer, authorityClient, logger);
  } catch (err) {
    logger.error({ err }, 'Failed to create user');
    return null;
  }

  return { ...output, domainName };
}

const accountCreation: MessageSink = {
  contentType: 'application/vnd.relaycorp.letro.account-request',

  async handler(message, { logger, emitter, veraidAuthClientMaker }) {
    const request = await getAndValidateRequest(message.content, logger);
    if (request === null) {
      return true;
    }

    const user = await createUser(request, veraidAuthClientMaker, logger);
    if (user === null) {
      return false;
    }

    const userId = `${user.userName}@${user.domainName}`;
    await sendAccountCreationMessage(request, userId, user.bundle, message, emitter);
    logger.info({ userId }, 'Account created');
    return true;
  },
};

export default accountCreation;
