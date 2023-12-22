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

import { LETRO_VERAID_SVC_OID } from '../../../utilities/letro.js';

import { MANAGED_DOMAIN_NAMES } from './orgs.js';

const USER_NAME_TAKEN_STATUS_CODE = 409;
const USER_NAME_SUFFIX_LENGTH = 3;
const MAX_USER_CREATION_ATTEMPTS = 3;

const ORG_MEMBERS_ENDPOINT_BY_DOMAIN: { [key in string]: string } = Object.fromEntries(
  MANAGED_DOMAIN_NAMES.map((domain) => [domain, `/orgs/${domain}/members`]),
) as { [key in string]: string };

const PUBLIC_KEY_PATH_REGEX = /^\/orgs\/[^/]+\/members\/[^/]+\/public-keys\/(?<publicKeyId>.+)$/u;

interface KeyImportOutput {
  readonly bundleEndpoint: string;
  readonly publicKeyId: string;
}

interface UserCreationOutput {
  userName: string;
  bundle: ArrayBuffer;
  publicKeyId: string;
}

function addNameSuffix(name: string): string {
  const suffixLength = Math.floor(Math.random() * USER_NAME_SUFFIX_LENGTH) + 1;
  const randomSuffix = randomBytes(suffixLength).toString('hex');
  return `${name}-${randomSuffix}`;
}

async function createUserWithRetries(
  preferredUserName: string,
  org: string,
  client: AuthorityClient,
  logger: BaseLogger,
  attempts = 1,
): Promise<{ userName: string; output: MemberCreationOutput }> {
  const userName = attempts === 1 ? preferredUserName : addNameSuffix(preferredUserName);
  const orgEndpoint = ORG_MEMBERS_ENDPOINT_BY_DOMAIN[org];
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
  publicKeyDer: ArrayBuffer,
  publicKeysEndpoint: string,
  client: AuthorityClient,
  logger: BaseLogger,
): Promise<KeyImportOutput> {
  const keyImportCommand = new MemberPublicKeyImportCommand({
    endpoint: publicKeysEndpoint,
    publicKeyDer: Buffer.from(publicKeyDer),
    serviceOid: LETRO_VERAID_SVC_OID,
  });
  const keyImport = await client.send(keyImportCommand);

  const publicKeyPathMatch = PUBLIC_KEY_PATH_REGEX.exec(keyImport.self);
  if (!publicKeyPathMatch) {
    logger.error({ publicKeyPath: keyImport.self }, 'Failed to extract public key id');
    throw new Error('Failed to extract public key id');
  }

  logger.debug('Public key imported in VeraId Authority');
  return { bundleEndpoint: keyImport.bundle, publicKeyId: publicKeyPathMatch.groups!.publicKeyId };
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
  org: string,
  publicKeyDer: ArrayBuffer,
  client: AuthorityClient,
  logger: BaseLogger,
): Promise<UserCreationOutput> {
  const { userName, output } = await createUserWithRetries(preferredUserName, org, client, logger);

  let bundle;
  let publicKeyId;
  try {
    const importOutput = await importKey(publicKeyDer, output.publicKeys, client, logger);
    bundle = await retrieveBundle(importOutput.bundleEndpoint, client);
    ({ publicKeyId } = importOutput);
  } catch (err) {
    // Clean up so we can try again later
    await deleteUser(output.self, client);
    throw new Error('Failed to complete user creation', { cause: err });
  }

  return { userName, bundle, publicKeyId };
}

export type { UserCreationOutput };
