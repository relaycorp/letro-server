import type { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';
import { generateRSAKeyPair, getIdFromIdentityKey } from '@relaycorp/relaynet-core';

import { encodePublicKey } from './crypto/keys.js';

export interface Endpoint {
  readonly id: string;
  readonly publicKey: SubjectPublicKeyInfo;
}

export async function generateEndpoint(): Promise<Endpoint> {
  const keyPair = await generateRSAKeyPair();
  return {
    id: await getIdFromIdentityKey(keyPair.publicKey),
    publicKey: await encodePublicKey(keyPair.publicKey),
  };
}
