import { generateKeyPairSync, type KeyExportOptions, type KeyObject, sign } from 'node:crypto';

import { bufferToArrayBuffer } from '../../utilities/buffer.js';

const RSA_DEFAULT_MODULUS = 2048;
const RSA_DEFAULT_HASH = 'SHA-256';

interface KeyPair {
  publicKey: ArrayBuffer;
  privateKey: KeyObject;
}

interface RsaKeyGenOptions {
  modulus: number;
  hashAlgorithm: string;
}

export const PUBLIC_KEY_DER_ENCODING: KeyExportOptions<'der'> = { type: 'spki', format: 'der' };

export function generateRsaPssKeyPair(options: Partial<RsaKeyGenOptions> = {}): KeyPair {
  const finalOptions = {
    modulusLength: options.modulus ?? RSA_DEFAULT_MODULUS,
    hashAlgorithm: options.hashAlgorithm ?? RSA_DEFAULT_HASH,
    mgf1HashAlgorithm: options.hashAlgorithm ?? RSA_DEFAULT_HASH,
    publicKeyEncoding: PUBLIC_KEY_DER_ENCODING,
  };
  const { publicKey, privateKey } = generateKeyPairSync('rsa-pss', finalOptions);
  return { privateKey, publicKey: bufferToArrayBuffer(publicKey as unknown as Uint8Array) };
}

export function signPlaintext(plaintext: ArrayBuffer, privateKey: KeyObject): ArrayBuffer {
  const signature = sign(null, Buffer.from(plaintext), privateKey);
  return bufferToArrayBuffer(signature);
}
