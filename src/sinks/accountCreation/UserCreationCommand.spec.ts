import {
  ClientError,
  DeletionCommand,
  MemberCreationCommand,
  type MemberCreationOutput,
  MemberPublicKeyImportCommand,
  type MemberPublicKeyImportOutput,
  MemberRole,
} from '@relaycorp/veraid-authority';

import {
  type ExpectedOutcome,
  MockAuthorityClient,
} from '../../testUtils/veraidAuth/MockAuthorityClient.js';
import { getPromiseRejection } from '../../testUtils/jest.js';
import { LETRO_OID } from '../../utilities/letro.js';

import { MANAGED_DOMAIN_NAMES, ORG_ENDPOINT_BY_DOMAIN } from './orgs.js';
import { UserCreationCommand } from './UserCreationCommand.js';

const USER_NAME = 'alice';
const [ORG] = MANAGED_DOMAIN_NAMES;
const PUBLIC_KEY_DER = Buffer.from('public key');

const MEMBER_CREATION_OUTPUT = {
  self: '/self',
  publicKeys: '/public-keys',
  publicKeyImportTokens: '/public-key-import-tokens',
};
const MEMBER_CREATION_OUTCOME: ExpectedOutcome<MemberCreationOutput> = {
  commandType: MemberCreationCommand,
  output: MEMBER_CREATION_OUTPUT,
};

const MEMBER_PUBLIC_KEY_IMPORT_OUTCOME: ExpectedOutcome<MemberPublicKeyImportOutput> = {
  commandType: MemberPublicKeyImportCommand,
  output: { self: '/self' },
};

const HTTP_CODE_CONFLICT = 409;

describe('UserCreationCommand', () => {
  describe('User creation', () => {
    test('User should be created with the specified name', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.name).toBe(USER_NAME);
    });

    test('User should be created under the specified org', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.endpoint).toBe(ORG_ENDPOINT_BY_DOMAIN[ORG]);
    });

    test('User role should be regular', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.role).toBe(MemberRole.REGULAR);
    });

    test('User should be created without an email address', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.email).toBeUndefined();
    });

    test('User id and endpoint should be returned if creation is successful', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      const { userName, endpoint } = await command.run(client);

      expect(userName).toBe(USER_NAME);
      expect(endpoint).toBe(MEMBER_CREATION_OUTPUT.self);
    });

    test('Unexpected errors should be wrapped and rethrown', async () => {
      const error = new Error('Something went wrong');
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: error },
      ]);

      const wrappedError = await getPromiseRejection(async () => command.run(client), Error);

      expect(wrappedError.message).toBe('Failed to create user');
      expect(wrappedError.cause).toBe(error);
    });
  });

  describe('Taken user names', () => {
    const duplicatedUserError = new ClientError('User name already taken', HTTP_CODE_CONFLICT);
    const generatedUserNameRegex = new RegExp(`^${USER_NAME}-[a-f\\d]{1,6}$`, 'u');

    test('Creation should be retried with generated suffix if name is taken', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      const { userName } = await command.run(client);

      const creationInput = client.getSentCommandInput(1, MemberCreationCommand);
      expect(creationInput.name).toMatch(generatedUserNameRegex);
      expect(userName).toBe(creationInput.name);
    });

    test('Creation should be retried a second time if name is taken', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      const { userName } = await command.run(client);

      const creationInput = client.getSentCommandInput(2, MemberCreationCommand);
      expect(creationInput.name).toMatch(generatedUserNameRegex);
      expect(userName).toBe(creationInput.name);
    });

    test('Creation should fail if name is taken after two retries', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
      ]);

      await expect(command.run(client)).rejects.toThrow('All user names considered were taken');
    });
  });

  describe('Public key import', () => {
    const userDeletionOutcome = { commandType: DeletionCommand, output: {} };

    test('Key should be posted to the public keys endpoint', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.endpoint).toBe(MEMBER_CREATION_OUTPUT.publicKeys);
    });

    test('Specified key should be imported', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.publicKeyDer).toBe(PUBLIC_KEY_DER);
    });

    test('Service OID should be that of Letro', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
      ]);

      await command.run(client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.serviceOid).toBe(LETRO_OID);
    });

    test('Unexpected errors should be wrapped and rethrown', async () => {
      const error = new Error('Something went wrong');
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        { commandType: MemberPublicKeyImportCommand, output: error },
        userDeletionOutcome,
      ]);

      const wrappedError = await getPromiseRejection(async () => command.run(client), Error);

      expect(wrappedError.message).toBe('Failed to import public key');
      expect(wrappedError.cause).toBe(error);
    });

    test('User should be deleted if key could not be imported', async () => {
      const command = new UserCreationCommand(USER_NAME, ORG, PUBLIC_KEY_DER);
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        { commandType: MemberPublicKeyImportCommand, output: new Error('Something went wrong') },
        userDeletionOutcome,
      ]);

      await expect(command.run(client)).toReject();

      const deletionInput = client.getSentCommandInput(2, DeletionCommand);
      expect(deletionInput).toBe(MEMBER_CREATION_OUTPUT.self);
    });
  });
});
