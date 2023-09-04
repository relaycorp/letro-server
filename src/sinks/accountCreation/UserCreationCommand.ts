import { randomBytes } from 'node:crypto';

import {
  type AuthorityClient,
  type ClientError,
  DeletionCommand,
  MemberCreationCommand,
  type MemberCreationOutput,
  MemberPublicKeyImportCommand,
  MemberRole,
} from '@relaycorp/veraid-authority';

import { Command } from '../../utilities/veraidAuth/Command.js';
import { LETRO_OID } from '../../utilities/letro.js';

import { type ManagedDomainName, ORG_ENDPOINT_BY_DOMAIN } from './orgs.js';

const USER_NAME_TAKEN_STATUS_CODE = 409;
const ALT_USER_NAME_SUFFIX_LENGTH = 3;
const MAX_USER_CREATION_ATTEMPTS = 3;

interface UserCreationOutput {
  userName: string;
  endpoint: string;
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

  private generateAltUserName(originalUserName: string) {
    const suffixLength = Math.floor(Math.random() * ALT_USER_NAME_SUFFIX_LENGTH) + 1;
    const randomSuffix = randomBytes(suffixLength).toString('hex');
    return `${originalUserName}-${randomSuffix}`;
  }

  public async run(client: AuthorityClient): Promise<UserCreationOutput> {
    const { userName, output } = await this.createUser(this.userName, client);

    try {
      await this.importKey(output.publicKeys, client);
    } catch (err) {
      await this.deleteUser(output.self, client);
      throw new Error('Failed to import public key', { cause: err });
    }

    return { userName, endpoint: output.self };
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
    await client.send(keyImportCommand);
  }

  private async deleteUser(userEndpoint: string, client: AuthorityClient) {
    const deletionCommand = new DeletionCommand(userEndpoint);
    await client.send(deletionCommand);
  }
}
