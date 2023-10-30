import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';
import { AsnParser, AsnSerializer } from '@peculiar/asn1-schema';
import { derSerializePublicKey } from '@relaycorp/relaynet-core';

export async function encodePublicKey(publicKey: CryptoKey): Promise<SubjectPublicKeyInfo> {
  const publicKeySerialised = await derSerializePublicKey(publicKey);
  return AsnParser.parse(publicKeySerialised, SubjectPublicKeyInfo);
}

export function encodePublicKeyFromDer(publicKeyDer: ArrayBuffer): SubjectPublicKeyInfo {
  return AsnParser.parse(publicKeyDer, SubjectPublicKeyInfo);
}

export function derSerialiseEncodedPublicKey(publicKey: SubjectPublicKeyInfo): Buffer {
  return Buffer.from(AsnSerializer.serialize(publicKey));
}
