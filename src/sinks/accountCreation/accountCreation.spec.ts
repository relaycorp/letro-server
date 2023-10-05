import { jest } from '@jest/globals';
import { AsnParser, AsnSerializer } from '@peculiar/asn1-schema';
import type { CloudEventV1 } from 'cloudevents';

import { partialPinoLog } from '../../testUtils/logging.js';
import { mockSpy } from '../../testUtils/jest.js';
import {
  MEMBER_BUNDLE,
  MEMBER_PRIVATE_KEY,
  MEMBER_PUBLIC_KEY_DER,
  MEMBER_PUBLIC_KEY_ENCODED,
  USER_NAME,
} from '../../testUtils/veraid/stubs.js';
import { bufferToArrayBuffer } from '../../utilities/buffer.js';
import { LOCALE } from '../../testUtils/letro/stubs.js';
import { signPlaintext } from '../../testUtils/crypto/signing.js';
import { RELAYCORP_LETRO_TYPES } from '../../utilities/letro.js';
import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';

import type { UserCreationOutput } from './veraidAuth/userCreation.js';
import { AccountRequest } from './schemas/AccountRequest.js';
import { AccountRequestSignature } from './schemas/AccountRequestSignature.js';
import { getDomainForLocale } from './veraidAuth/orgs.js';
import { AccountCreation } from './schemas/AccountCreation.js';

const mockUserCreationOutput: UserCreationOutput = {
  bundle: bufferToArrayBuffer(MEMBER_BUNDLE),
  userName: USER_NAME,
};
const mockCreateVeraidUser = mockSpy(
  jest.fn<() => Promise<UserCreationOutput>>(),
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => mockUserCreationOutput,
);
jest.unstable_mockModule('./veraidAuth/userCreation.js', () => ({
  createVeraidUser: mockCreateVeraidUser,
}));

const { default: accountCreation } = await import('./accountCreation.js');

describe('accountCreation handler', () => {
  const { emittedEvents, logs, senderEndpointId, recipientEndpointId, runner } =
    makeSinkTestRunner(accountCreation);

  function makeRequest(options: Partial<AccountRequest> = {}): AccountRequest {
    const request = new AccountRequest();
    request.userName = options.userName ?? USER_NAME;
    request.locale = options.locale ?? LOCALE;
    request.publicKey = options.publicKey ?? MEMBER_PUBLIC_KEY_ENCODED;
    return request;
  }

  function makeRequestSigned(options: Partial<AccountRequest> = {}): Buffer {
    const request = makeRequest(options);
    const signature = new AccountRequestSignature();
    signature.request = request;
    const requestSerialised = AsnSerializer.serialize(request);
    signature.signature = signPlaintext(requestSerialised, MEMBER_PRIVATE_KEY);
    return Buffer.from(AsnSerializer.serialize(signature));
  }

  test('Malformed request should be ignored', async () => {
    const content = Buffer.from('malformed');

    await expect(runner(content)).resolves.toBeTrue();

    expect(mockCreateVeraidUser).not.toHaveBeenCalled();
    expect(emittedEvents).toBeEmpty();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Ignored malformed account creation request', {
        err: expect.objectContaining({ type: 'Error' }),
      }),
    );
  });

  test('Well-formed request with invalid signature should be refused', async () => {
    const request = makeRequest();
    const signature = new AccountRequestSignature();
    signature.request = request;
    signature.signature = new ArrayBuffer(2);
    const content = Buffer.from(AsnSerializer.serialize(signature));

    await expect(runner(content)).resolves.toBeTrue();

    expect(mockCreateVeraidUser).not.toHaveBeenCalled();
    expect(emittedEvents).toBeEmpty();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Ignored account creation request with invalid signature'),
    );
  });

  describe('User name', () => {
    test('Valid user name should be used as is', async () => {
      const request = makeRequestSigned({ userName: USER_NAME });

      await expect(runner(request)).resolves.toBeTrue();

      expect(mockCreateVeraidUser).toHaveBeenCalledWith(
        USER_NAME,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    test('Invalid user name should be sanitised', async () => {
      const invalidUserName = ` ${USER_NAME}`;
      const request = makeRequestSigned({ userName: invalidUserName });

      await expect(runner(request)).resolves.toBeTrue();

      expect(mockCreateVeraidUser).toHaveBeenCalledWith(
        USER_NAME,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('Locale', () => {
    test('Domain name should correspond to locale', async () => {
      const request = makeRequestSigned({ locale: LOCALE });

      await expect(runner(request)).resolves.toBeTrue();

      expect(mockCreateVeraidUser).toHaveBeenCalledWith(
        expect.anything(),
        getDomainForLocale(LOCALE),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    test('Unsupported locale should use default domain name', async () => {
      const invalidLocale = 'THIS CAN NEVER BE A LOCALE';
      const request = makeRequestSigned({ locale: invalidLocale });

      await expect(runner(request)).resolves.toBeTrue();

      expect(mockCreateVeraidUser).toHaveBeenCalledWith(
        expect.anything(),
        getDomainForLocale(invalidLocale),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  test('Account should be created with specified public key', async () => {
    const request = makeRequestSigned({ publicKey: MEMBER_PUBLIC_KEY_ENCODED });

    await expect(runner(request)).resolves.toBeTrue();

    expect(mockCreateVeraidUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.toSatisfy<ArrayBuffer>((key) =>
        Buffer.from(key).equals(Buffer.from(MEMBER_PUBLIC_KEY_DER)),
      ),
      expect.anything(),
      expect.anything(),
    );
  });

  test('Successful account creation should be logged', async () => {
    const request = makeRequestSigned();

    await expect(runner(request)).resolves.toBeTrue();

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Account created', {
        requestedUserName: USER_NAME,
        locale: LOCALE,
        userId: `${USER_NAME}@${getDomainForLocale(LOCALE)}`,
      }),
    );
  });

  describe('Outgoing account creation message', () => {
    async function postRequestAndGetCreationMessage(): Promise<CloudEventV1<Buffer>> {
      const request = makeRequestSigned();
      await runner(request);
      return emittedEvents[0];
    }

    test('Sender should be recipient of account creation request', async () => {
      const event = await postRequestAndGetCreationMessage();

      expect(event.source).toBe(recipientEndpointId);
    });

    test('Recipient should be sender of account creation request', async () => {
      const event = await postRequestAndGetCreationMessage();

      expect(event.subject).toBe(senderEndpointId);
    });

    test('Content type should be that of account creation', async () => {
      const event = await postRequestAndGetCreationMessage();

      expect(event.datacontenttype).toBe(RELAYCORP_LETRO_TYPES.ACCOUNT_CREATION);
    });

    describe('Content', () => {
      test('Requested user name should be honoured', async () => {
        const event = await postRequestAndGetCreationMessage();

        const content = AsnParser.parse(event.data!, AccountCreation);
        expect(content.requestedUserName).toBe(USER_NAME);
      });

      test('Locale should be honoured', async () => {
        const event = await postRequestAndGetCreationMessage();

        const content = AsnParser.parse(event.data!, AccountCreation);
        expect(content.locale).toBe(LOCALE);
      });

      test('Assigned user id should be included', async () => {
        const userName = `not-${USER_NAME}`;
        mockCreateVeraidUser.mockResolvedValue({ ...mockUserCreationOutput, userName });

        const event = await postRequestAndGetCreationMessage();

        const content = AsnParser.parse(event.data!, AccountCreation);
        expect(content.assignedUserId).toBe(`${userName}@${getDomainForLocale(LOCALE)}`);
      });

      test('VeraId bundle should be included', async () => {
        const event = await postRequestAndGetCreationMessage();

        const content = AsnParser.parse(event.data!, AccountCreation);
        expect(Buffer.from(content.veraidBundle)).toMatchObject(MEMBER_BUNDLE);
      });
    });
  });

  test('Failure to create account should be reattempted', async () => {
    const request = makeRequestSigned();
    const error = new Error('Failed to create user');
    mockCreateVeraidUser.mockRejectedValueOnce(error);

    await expect(runner(request)).resolves.toBeFalse();

    expect(logs).toContainEqual(
      partialPinoLog('error', 'Failed to create user', {
        err: expect.objectContaining({ message: error.message }),
        requestedUserName: USER_NAME,
        locale: LOCALE,
      }),
    );
  });
});
