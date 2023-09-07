import { createPublicKey, verify } from 'node:crypto';

export function verifySignature(
  plaintext: ArrayBuffer,
  signature: ArrayBuffer,
  publicKeyDer: ArrayBuffer,
): boolean {
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeyDer),
    type: 'spki',
    format: 'der',
  });
  return verify(null, Buffer.from(plaintext), publicKey, Buffer.from(signature));
}
