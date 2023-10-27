/* eslint-disable new-cap */

import { AsnProp, AsnPropTypes } from '@peculiar/asn1-schema';

export enum ContactPairingFailureReason {
  INVALID_REQUESTER_VERAID = 0,
  INVALID_TARGET_VERAID = 1,
  INVALID_REQUESTER_AWALA_KEY = 2,
}

export class ContactPairingFailure {
  @AsnProp({ type: AsnPropTypes.Utf8String, context: 0, implicit: true })
  public targetContactVeraid!: string;

  @AsnProp({ type: AsnPropTypes.Integer, context: 1, implicit: true })
  public reason!: ContactPairingFailureReason;
}
