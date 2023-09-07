import { generateKeyPairSync, type KeyType } from 'node:crypto';

import { bufferToArrayBuffer } from '../buffer.js';
import {
  generateRsaPssKeyPair,
  PUBLIC_KEY_DER_ENCODING,
  signPlaintext,
} from '../../testUtils/crypto/signing.js';

import { verifySignature } from './signing.js';

const PLAINTEXT = bufferToArrayBuffer(Buffer.from('plaintext'));

describe('verifySignature', () => {
  describe('RSA', () => {
    test('Invalid signature should be refused', async () => {
      const { publicKey } = generateRsaPssKeyPair();

      await expect(
        verifySignature(PLAINTEXT, bufferToArrayBuffer(Buffer.from('invalid')), publicKey),
      ).resolves.toBeFalse();
    });

    test.each([2048, 3072, 4096])('RSA modulus %s should be accepted', async (modulus) => {
      const { publicKey, privateKey } = generateRsaPssKeyPair({ modulus });
      const signature = signPlaintext(PLAINTEXT, privateKey);

      await expect(verifySignature(PLAINTEXT, signature, publicKey)).resolves.toBeTrue();
    });

    test.each(['SHA-256', 'SHA-384', 'SHA-512'])(
      'Hash %s should be accepted',
      async (hashAlgorithm) => {
        const { publicKey, privateKey } = generateRsaPssKeyPair({ hashAlgorithm });
        const signature = signPlaintext(PLAINTEXT, privateKey);

        await expect(verifySignature(PLAINTEXT, signature, publicKey)).resolves.toBeTrue();
      },
    );
  });

  describe('Ed25519', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
    });

    test('Valid signature should be allowed', async () => {
      const signature = signPlaintext(PLAINTEXT, privateKey);

      await expect(
        verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer),
      ).resolves.toBeTrue();
    });

    test('Invalid signature should be refused', async () => {
      const differentPlaintext = bufferToArrayBuffer(Buffer.from(PLAINTEXT.slice(1)));
      const signature = signPlaintext(differentPlaintext, privateKey);

      await expect(
        verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer),
      ).resolves.toBeFalse();
    });
  });

  test.each<KeyType>(['ed25519', 'ed448'])(
    'EdDSA algorithm %s should be supported',
    async (algorithm) => {
      const { publicKey, privateKey } = generateKeyPairSync(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        algorithm as any,
        { publicKeyEncoding: PUBLIC_KEY_DER_ENCODING },
      );
      const signature = signPlaintext(PLAINTEXT, privateKey);

      await expect(
        verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer),
      ).resolves.toBeTrue();
      await expect(
        verifySignature(PLAINTEXT, new ArrayBuffer(2), publicKey as unknown as ArrayBuffer),
      ).resolves.toBeFalse();
    },
  );
});
