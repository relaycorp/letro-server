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

import { Command } from '../../utilities/veraidAuth/Command.js';
import { LETRO_OID } from '../../utilities/letro.js';

import { type ManagedDomainName, ORG_ENDPOINT_BY_DOMAIN } from './orgs.js';

const USER_NAME_TAKEN_STATUS_CODE = 409;
const ALT_USER_NAME_SUFFIX_LENGTH = 3;
const MAX_USER_CREATION_ATTEMPTS = 3;

interface UserCreationOutput {
  userName: string;
  bundle: ArrayBuffer;
}

export class UserCreationCommand extends Command<UserCreationOutput> {
  protected readonly orgEndpoint: string;

  public constructor(
    protected userName: string,
    org: ManagedDomainName,
    protected publicKeyDer: Buffer,
  ) {
    super();

    this.orgEndpoint = ORG_ENDPOINT_BY_DOMAIN[org];
  }

  protected generateAltUserName(originalUserName: string): string {
    const suffixLength = Math.floor(Math.random() * ALT_USER_NAME_SUFFIX_LENGTH) + 1;
    const randomSuffix = randomBytes(suffixLength).toString('hex');
    return `${originalUserName}-${randomSuffix}`;
  }

  public async run(client: AuthorityClient): Promise<UserCreationOutput> {
    const { userName, output } = await this.createUser(this.userName, client);

    let bundle;
    try {
      const { bundle: bundleEndpoint } = await this.importKey(output.publicKeys, client);
      bundle = await this.retrieveBundle(bundleEndpoint, client);
    } catch (err) {
      // Clean up so we can try again later
      await this.deleteUser(output.self, client);
      throw new Error('Failed to complete user creation', { cause: err });
    }

    return { userName, bundle };
  }

  protected async createUser(
    preferredUserName: string,
    client: AuthorityClient,
    attempts = 1,
  ): Promise<{ userName: string; output: MemberCreationOutput }> {
    const userName =
      attempts === 1 ? preferredUserName : this.generateAltUserName(preferredUserName);
    const creationCommand = new MemberCreationCommand({
      name: userName,
      endpoint: this.orgEndpoint,
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
        return this.createUser(preferredUserName, client, attempts + 1);
      }

      throw new Error('Failed to create user', { cause: err });
    }

    return { userName, output };
  }

  private async importKey(publicKeysEndpoint: string, client: AuthorityClient) {
    const keyImportCommand = new MemberPublicKeyImportCommand({
      endpoint: publicKeysEndpoint,
      publicKeyDer: this.publicKeyDer,
      serviceOid: LETRO_OID,
    });
    return client.send(keyImportCommand);
  }

  private async deleteUser(userEndpoint: string, client: AuthorityClient) {
    const deletionCommand = new DeletionCommand(userEndpoint);
    await client.send(deletionCommand);
  }

  private async retrieveBundle(bundleEndpoint: string, client: AuthorityClient) {
    const command = new RawRetrievalCommand(bundleEndpoint);
    return client.send(command);
  }
}
