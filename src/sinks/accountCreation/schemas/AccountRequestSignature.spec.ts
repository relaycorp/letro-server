import { AsnSerializer } from '@peculiar/asn1-schema';

import { generateRsaPssKeyPair, signPlaintext } from '../../../testUtils/crypto/signing.js';
import { derDecodePublicKey } from '../../../testUtils/crypto/keys.js';
import { USER_NAME } from '../../../testUtils/veraid/stubs.js';

import { AccountRequest } from './AccountRequest.js';
import { AccountRequestSignature } from './AccountRequestSignature.js';

describe('AccountRequestSignature', () => {
  describe('verifySignature', () => {
    const { publicKey, privateKey } = generateRsaPssKeyPair();

    const accountRequest = new AccountRequest();
    accountRequest.name = USER_NAME;
    accountRequest.locale = 'es-ve';
    accountRequest.publicKey = derDecodePublicKey(publicKey);

    test('Valid signature should be allowed', async () => {
      const signature = new AccountRequestSignature();
      signature.request = accountRequest;
      const requestSerialised = AsnSerializer.serialize(accountRequest);
      signature.signature = signPlaintext(requestSerialised, privateKey);

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
