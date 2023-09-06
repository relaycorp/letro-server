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
      return createUserWithRetries(preferredUserName, org, client, attempts + 1);
    }

    throw new Error('Failed to create user', { cause: err });
  }

  return { userName, output };
}

async function importKey(
  publicKeyDer: Buffer,
  publicKeysEndpoint: string,
  client: AuthorityClient,
) {
  const keyImportCommand = new MemberPublicKeyImportCommand({
    endpoint: publicKeysEndpoint,
    publicKeyDer,
    serviceOid: LETRO_OID,
  });
  return client.send(keyImportCommand);
}

async function deleteUser(userEndpoint: string, client: AuthorityClient) {
  const deletionCommand = new DeletionCommand(userEndpoint);
  await client.send(deletionCommand);
}

async function retrieveBundle(bundleEndpoint: string, client: AuthorityClient) {
  const command = new RawRetrievalCommand(bundleEndpoint);
  return client.send(command);
}

export async function createUser(
  preferredUserName: string,
  org: ManagedDomainName,
  publicKeyDer: Buffer,
  client: AuthorityClient,
): Promise<UserCreationOutput> {
  const { userName, output } = await createUserWithRetries(preferredUserName, org, client);

  let bundle;
  try {
    const { bundle: bundleEndpoint } = await importKey(publicKeyDer, output.publicKeys, client);
    bundle = await retrieveBundle(bundleEndpoint, client);
  } catch (err) {
    // Clean up so we can try again later
    await deleteUser(output.self, client);
    throw new Error('Failed to complete user creation', { cause: err });
  }

  return { userName, bundle };
}
