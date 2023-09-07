import { AsnSerializer } from '@peculiar/asn1-schema';

import { signPlaintext } from '../../../testUtils/crypto/signing.js';
import {
  MEMBER_PRIVATE_KEY,
  MEMBER_PUBLIC_KEY_ENCODED,
  USER_NAME,
} from '../../../testUtils/veraid/stubs.js';
import { LOCALE } from '../../../testUtils/letro/stubs.js';

import { AccountRequest } from './AccountRequest.js';
import { AccountRequestSignature } from './AccountRequestSignature.js';

describe('AccountRequestSignature', () => {
  describe('verifySignature', () => {
    const accountRequest = new AccountRequest();
    accountRequest.userName = USER_NAME;
    accountRequest.locale = LOCALE;
    accountRequest.publicKey = MEMBER_PUBLIC_KEY_ENCODED;

    test('Valid signature should be allowed', async () => {
      const signature = new AccountRequestSignature();
      signature.request = accountRequest;
      const requestSerialised = AsnSerializer.serialize(accountRequest);
      signature.signature = signPlaintext(requestSerialised, MEMBER_PRIVATE_KEY);

      await expect(signature.verifySignature()).resolves.toBeTrue();
    });

    test('Invalid signature should be refused', async () => {
      const signature = new AccountRequestSignature();
      signature.request = accountRequest;
      signature.signature = new ArrayBuffer(2);

      await expect(signature.verifySignature()).resolves.toBeFalse();
    });
  });
});
