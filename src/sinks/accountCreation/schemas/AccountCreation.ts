/* eslint-disable new-cap */

import { AsnProp, AsnPropTypes } from '@peculiar/asn1-schema';

export class AccountCreation {
  @AsnProp({ type: AsnPropTypes.VisibleString, context: 0, implicit: true })
  public requestedUserName!: string;

  @AsnProp({ type: AsnPropTypes.VisibleString, context: 1, implicit: true })
  public locale!: string;

  @AsnProp({ type: AsnPropTypes.VisibleString, context: 2, implicit: true })
  public assignedUserId!: string;

  @AsnProp({ type: AsnPropTypes.OctetString, context: 3, implicit: true })
  public veraidBundle!: ArrayBuffer;
}
