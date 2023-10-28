/* eslint-disable new-cap */

import { AsnProp, AsnPropTypes } from '@peculiar/asn1-schema';
import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';

export class ContactPairingRequest {
  @AsnProp({ type: SubjectPublicKeyInfo, context: 0, implicit: true })
  public requesterAwalaEndpointPublicKey!: SubjectPublicKeyInfo;

  @AsnProp({ type: AsnPropTypes.Utf8String, context: 1, implicit: true })
  public targetVeraidId!: string;
}
