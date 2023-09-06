import { generateKeyPairSync, sign, type KeyObject, type KeyExportOptions } from 'node:crypto';

import { bufferToArrayBuffer } from '../buffer.js';

import { verifySignature } from './signing.js';

const PUBLIC_KEY_DER_ENCODING: KeyExportOptions<'der'> = { type: 'spki', format: 'der' };

const PLAINTEXT = bufferToArrayBuffer(Buffer.from('plaintext'));

interface KeyPair {
  publicKey: ArrayBuffer;
  privateKey: KeyObject;
}

function generateRsaKeyPair(modulus: number, hashAlgorithm: string): KeyPair {
  const options = {
    modulusLength: modulus,
    hashAlgorithm,
    mgf1HashAlgorithm: hashAlgorithm,
    publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
  };
  const { publicKey, privateKey } = generateKeyPairSync('rsa-pss', options);
  return { privateKey, publicKey: bufferToArrayBuffer(publicKey as unknown as Uint8Array) };
}

function signPlaintext(plaintext: ArrayBuffer, privateKey: KeyObject): ArrayBuffer {
  const signature = sign(null, Buffer.from(plaintext), privateKey);
  return bufferToArrayBuffer(signature);
}

describe('verifySignature', () => {
  describe('RSA', () => {
    const defaultModulus = 2048;
    const defaultHash = 'SHA-256';

    test('Invalid signature should be refused', async () => {
      const { publicKey } = generateRsaKeyPair(defaultModulus, defaultHash);

      expect(
        verifySignature(PLAINTEXT, bufferToArrayBuffer(Buffer.from('invalid')), publicKey),
      ).toBeFalse();
    });

    test.each([2048, 3072, 4096])('RSA modulus %s should be accepted', async (modulus) => {
      const { publicKey, privateKey } = generateRsaKeyPair(modulus, defaultHash);
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey)).toBeTrue();
    });

    test.each(['SHA-256', 'SHA-384', 'SHA-512'])('Hash %s should be accepted', async (hash) => {
      const { publicKey, privateKey } = generateRsaKeyPair(defaultModulus, hash);
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey)).toBeTrue();
    });
  });

  describe('Ed25519', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
    });

    test('Valid signature should be allowed', async () => {
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer)).toBeTrue();
    });

    test('Invalid signature should be refused', async () => {
      const differentPlaintext = bufferToArrayBuffer(Buffer.from(PLAINTEXT.slice(1)));
      const signature = signPlaintext(differentPlaintext, privateKey);

      expect(
        verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer),
      ).toBeFalse();
    });
  });

  test.each<'ed448' | 'ed25519'>(['ed25519', 'ed448'])(
    'EdDSA algorithm %s should be supported',
    async (algorithm) => {
      const { publicKey, privateKey } = generateKeyPairSync(algorithm as any, {
        publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
      });
      const signature = signPlaintext(PLAINTEXT, privateKey);

      expect(verifySignature(PLAINTEXT, signature, publicKey as unknown as ArrayBuffer)).toBeTrue();
      expect(
        verifySignature(PLAINTEXT, new ArrayBuffer(2), publicKey as unknown as ArrayBuffer),
      ).toBeFalse();
    },
  );
});
