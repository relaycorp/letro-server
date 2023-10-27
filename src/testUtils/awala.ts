import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';
import {
  derSerializePublicKey,
  generateRSAKeyPair,
  getIdFromIdentityKey,
} from '@relaycorp/relaynet-core';
import { AsnParser } from '@peculiar/asn1-schema';

export interface Endpoint {
  readonly id: string;
  readonly publicKey: SubjectPublicKeyInfo;
}

export async function generateEndpoint(): Promise<Endpoint> {
  const keyPair = await generateRSAKeyPair();
  const publicKeySerialised = await derSerializePublicKey(keyPair.publicKey);
  const publicKeyEncoded = AsnParser.parse(publicKeySerialised, SubjectPublicKeyInfo);
  return {
    id: await getIdFromIdentityKey(keyPair.publicKey),
    publicKey: publicKeyEncoded,
  };
}
