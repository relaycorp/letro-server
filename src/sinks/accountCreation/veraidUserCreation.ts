import { randomBytes } from 'node:crypto';

import {
  type AuthorityClient,
  type ClientError,
  DeletionCommand,
  MemberCreationCommand,
  type MemberCreationOutput,
  MemberPublicKeyImportCommand,
  MemberRole,
  RawRetrievalCommand,
} from '@relaycorp/veraid-authority';
import type { BaseLogger } from 'pino';

import { LETRO_OID } from '../../utilities/letro.js';

import { type ManagedDomainName, ORG_ENDPOINT_BY_DOMAIN } from './orgs.js';

const USER_NAME_TAKEN_STATUS_CODE = 409;
const USER_NAME_SUFFIX_LENGTH = 3;
const MAX_USER_CREATION_ATTEMPTS = 3;

interface UserCreationOutput {
  userName: string;
  bundle: ArrayBuffer;
}

function addNameSuffix(name: string): string {
  const suffixLength = Math.floor(Math.random() * USER_NAME_SUFFIX_LENGTH) + 1;
  const randomSuffix = randomBytes(suffixLength).toString('hex');
  return `${name}-${randomSuffix}`;
}

async function createUserWithRetries(
  preferredUserName: string,
  org: ManagedDomainName,
  client: AuthorityClient,
  logger: BaseLogger,
  attempts = 1,
): Promise<{ userName: string; output: MemberCreationOutput }> {
  const userName = attempts === 1 ? preferredUserName : addNameSuffix(preferredUserName);
  const orgEndpoint = ORG_ENDPOINT_BY_DOMAIN[org];
  const creationCommand = new MemberCreationCommand({
    name: userName,
    endpoint: orgEndpoint,
    role: MemberRole.REGULAR,
  });
  let output;
  try {
    output = await client.send(creationCommand);
  } catch (err) {
    if ((err as ClientError).statusCode === USER_NAME_TAKEN_STATUS_CODE) {
      if (MAX_USER_CREATION_ATTEMPTS <= attempts) {
        throw new Error('All user names considered were taken');
      }
      logger.debug({ userName }, 'User name taken; will try adding a random suffix');
      return createUserWithRetries(preferredUserName, org, client, logger, attempts + 1);
    }

    throw new Error('Failed to create user', { cause: err });
  }

  logger.debug({ userName }, 'User created in VeraId Authority');
  return { userName, output };
}

async function importKey(
  publicKeyDer: Buffer,
  publicKeysEndpoint: string,
  client: AuthorityClient,
  logger: BaseLogger,
): Promise<string> {
  const keyImportCommand = new MemberPublicKeyImportCommand({
    endpoint: publicKeysEndpoint,
    publicKeyDer,
    serviceOid: LETRO_OID,
  });
  const { bundle: bundleEndpoint } = await client.send(keyImportCommand);
  logger.debug('Public key imported in VeraId Authority');
  return bundleEndpoint;
}

async function deleteUser(userEndpoint: string, client: AuthorityClient) {
  const deletionCommand = new DeletionCommand(userEndpoint);
  await client.send(deletionCommand);
}

async function retrieveBundle(bundleEndpoint: string, client: AuthorityClient) {
  const command = new RawRetrievalCommand(bundleEndpoint);
  return client.send(command);
}

export async function createVeraidUser(
  preferredUserName: string,
  org: ManagedDomainName,
  publicKeyDer: Buffer,
  client: AuthorityClient,
  logger: BaseLogger,
): Promise<UserCreationOutput> {
  const { userName, output } = await createUserWithRetries(preferredUserName, org, client, logger);

  let bundle;
  try {
    const bundleEndpoint = await importKey(publicKeyDer, output.publicKeys, client, logger);
    bundle = await retrieveBundle(bundleEndpoint, client);
  } catch (err) {
    // Clean up so we can try again later
    await deleteUser(output.self, client);
    throw new Error('Failed to complete user creation', { cause: err });
  }

  return { userName, bundle };
}

export type { UserCreationOutput };
