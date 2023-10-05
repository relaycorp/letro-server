import { createPublicKey, verify } from 'node:crypto';
import { promisify } from 'node:util';

const verifyAsync = promisify(verify);

export async function verifySignature(
  plaintext: ArrayBuffer,
  signature: ArrayBuffer,
  publicKeyDer: ArrayBuffer,
): Promise<boolean> {
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeyDer),
    type: 'spki',
    format: 'der',
  });
  return verifyAsync(null, Buffer.from(plaintext), publicKey, Buffer.from(signature));
}
