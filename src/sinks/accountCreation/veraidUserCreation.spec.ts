import {
  ClientError,
  DeletionCommand,
  MemberCreationCommand,
  type MemberCreationOutput,
  MemberPublicKeyImportCommand,
  type MemberPublicKeyImportOutput,
  MemberRole,
  RawRetrievalCommand,
} from '@relaycorp/veraid-authority';

import {
  type ExpectedOutcome,
  MockAuthorityClient,
} from '../../testUtils/veraid/authority/MockAuthorityClient.js';
import { getPromiseRejection } from '../../testUtils/jest.js';
import { LETRO_OID } from '../../utilities/letro.js';
import { bufferToArrayBuffer } from '../../utilities/buffer.js';
import { ORG_NAME, MEMBER_PUBLIC_KEY_DER, USER_NAME } from '../../testUtils/veraid/stubs.js';

import { ORG_ENDPOINT_BY_DOMAIN } from './orgs.js';
import { createUser } from './veraidUserCreation.js';

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
  output: { self: '/self', bundle: '/bundle' },
};

const MEMBER_BUNDLE = Buffer.from('the bundle');
const MEMBER_BUNDLE_OUTCOME: ExpectedOutcome<ArrayBuffer> = {
  commandType: RawRetrievalCommand,
  output: bufferToArrayBuffer(MEMBER_BUNDLE),
};

const MEMBER_DELETION_OUTCOME = { commandType: DeletionCommand, output: {} };

const HTTP_CODE_CONFLICT = 409;

describe('createUser', () => {
  describe('User creation', () => {
    test('User should be created with the specified name', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.name).toBe(USER_NAME);
    });

    test('User should be created under the specified org', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.endpoint).toBe(ORG_ENDPOINT_BY_DOMAIN[ORG_NAME]);
    });

    test('User role should be regular', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.role).toBe(MemberRole.REGULAR);
    });

    test('User should be created without an email address', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(0, MemberCreationCommand);
      expect(creationInput.email).toBeUndefined();
    });

    test('User name should be returned if creation is successful', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      const { userName } = await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      expect(userName).toBe(USER_NAME);
    });

    test('Unexpected errors should be wrapped and rethrown', async () => {
      const error = new Error('Something went wrong');
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: error },
      ]);

      const wrappedError = await getPromiseRejection(
        async () => createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client),
        Error,
      );

      expect(wrappedError.message).toBe('Failed to create user');
      expect(wrappedError.cause).toBe(error);
    });
  });

  describe('Taken user names', () => {
    const duplicatedUserError = new ClientError('User name already taken', HTTP_CODE_CONFLICT);
    // eslint-disable-next-line security/detect-non-literal-regexp
    const generatedUserNameRegex = new RegExp(`^${USER_NAME}-[a-f\\d]{1,6}$`, 'u');

    test('Creation should be retried with generated suffix if name is taken', async () => {
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      const { userName } = await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(1, MemberCreationCommand);
      expect(creationInput.name).toMatch(generatedUserNameRegex);
      expect(userName).toBe(creationInput.name);
    });

    test('Creation should be retried a second time if name is taken', async () => {
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      const { userName } = await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const creationInput = client.getSentCommandInput(2, MemberCreationCommand);
      expect(creationInput.name).toMatch(generatedUserNameRegex);
      expect(userName).toBe(creationInput.name);
    });

    test('Creation should fail if name is taken after two retries', async () => {
      const client = new MockAuthorityClient([
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
        { commandType: MemberCreationCommand, output: duplicatedUserError },
      ]);

      await expect(createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client)).rejects.toThrow(
        'All user names considered were taken',
      );
    });
  });

  describe('Public key import', () => {
    test('Key should be posted to the public keys endpoint', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.endpoint).toBe(MEMBER_CREATION_OUTPUT.publicKeys);
    });

    test('Specified key should be imported', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.publicKeyDer).toBe(MEMBER_PUBLIC_KEY_DER);
    });

    test('Service OID should be that of Letro', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      const importInput = client.getSentCommandInput(1, MemberPublicKeyImportCommand);
      expect(importInput.serviceOid).toBe(LETRO_OID);
    });

    test('Unexpected errors should be wrapped and rethrown', async () => {
      const error = new Error('Something went wrong');
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        { commandType: MemberPublicKeyImportCommand, output: error },
        MEMBER_DELETION_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      const wrappedError = await getPromiseRejection(
        async () => createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client),
        Error,
      );

      expect(wrappedError.message).toBe('Failed to complete user creation');
      expect(wrappedError.cause).toBe(error);
    });

    test('User should be deleted if key could not be imported', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        { commandType: MemberPublicKeyImportCommand, output: new Error('Something went wrong') },
        MEMBER_DELETION_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      await expect(createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client)).toReject();

      const deletionInput = client.getSentCommandInput(2, DeletionCommand);
      expect(deletionInput).toBe(MEMBER_CREATION_OUTPUT.self);
    });
  });

  describe('Bundle', () => {
    test('Bundle should be returned', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        MEMBER_BUNDLE_OUTCOME,
      ]);

      const { bundle } = await createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client);

      expect(Buffer.from(bundle)).toMatchObject(MEMBER_BUNDLE);
    });

    test('Unexpected errors should be wrapped and rethrown', async () => {
      const error = new Error('Something went wrong');
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        { commandType: RawRetrievalCommand, output: error },
        MEMBER_DELETION_OUTCOME,
      ]);

      const wrappedError = await getPromiseRejection(
        async () => createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client),
        Error,
      );

      expect(wrappedError.message).toBe('Failed to complete user creation');
      expect(wrappedError.cause).toBe(error);
    });

    test('User should be deleted if bundle could not be retrieved', async () => {
      const client = new MockAuthorityClient([
        MEMBER_CREATION_OUTCOME,
        MEMBER_PUBLIC_KEY_IMPORT_OUTCOME,
        { commandType: RawRetrievalCommand, output: new Error('Something went wrong') },
        MEMBER_DELETION_OUTCOME,
      ]);

      await expect(createUser(USER_NAME, ORG_NAME, MEMBER_PUBLIC_KEY_DER, client)).toReject();

      const deletionInput = client.getSentCommandInput(3, DeletionCommand);
      expect(deletionInput).toBe(MEMBER_CREATION_OUTPUT.self);
    });
  });
});