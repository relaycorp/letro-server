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
    test('Invalid signature should be refused', () => {
      const { publicKey } = generateRsaPssKeyPair();

      expect(
        verifySignature(PLAINTEXT, bufferToArrayBuffer(Buffer.from('invalid')), publicKey),
      ).toBeFalse();
    });

    test.each([2048, 3072, 4096])('RSA modulus %s should be accepted', (modulus) => {
      const { publicKey, privateKey } = generateRsaPssKeyPair({ modulus });
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey)).toBeTrue();
    });

    test.each(['SHA-256', 'SHA-384', 'SHA-512'])('Hash %s should be accepted', (hashAlgorithm) => {
      const { publicKey, privateKey } = generateRsaPssKeyPair({ hashAlgorithm });
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey)).toBeTrue();
    });
  });

  describe('Ed25519', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
    });

    test('Valid signature should be allowed', () => {
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer)).toBeTrue();
    });

    test('Invalid signature should be refused', () => {
      const differentPlaintext = bufferToArrayBuffer(Buffer.from(PLAINTEXT.slice(1)));
      const signature = signPlaintext(differentPlaintext, privateKey);

      expect(
        verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer),
      ).toBeFalse();
    });
  });

  test.each<KeyType>(['ed25519', 'ed448'])(
    'EdDSA algorithm %s should be supported',
    (algorithm) => {
      const { publicKey, privateKey } = generateKeyPairSync(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        algorithm as any,
        { publicKeyEncoding: PUBLIC_KEY_DER_ENCODING },
      );
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer)).toBeTrue();
      expect(
        verifySignature(PLAINTEXT, new ArrayBuffer(2), publicKey as unknown as ArrayBuffer),
      ).toBeFalse();
    },
  );
});
