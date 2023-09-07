import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';
import { AsnParser } from '@peculiar/asn1-schema';

export function encodePublicKeyFromDer(publicKeyDer: ArrayBuffer): SubjectPublicKeyInfo {
  return AsnParser.parse(publicKeyDer, SubjectPublicKeyInfo);
}
