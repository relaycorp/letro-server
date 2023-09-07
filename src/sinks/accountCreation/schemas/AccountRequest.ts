/* eslint-disable new-cap */

import { AsnProp, AsnPropTypes } from '@peculiar/asn1-schema';
import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';

export class AccountRequest {
  @AsnProp({ type: AsnPropTypes.VisibleString, context: 0, implicit: true })
  public name!: string;

  @AsnProp({ type: AsnPropTypes.VisibleString, context: 1, implicit: true })
  public locale!: string;

  @AsnProp({ type: SubjectPublicKeyInfo, context: 2, implicit: true })
  public publicKey!: SubjectPublicKeyInfo;
}
