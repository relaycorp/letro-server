/* eslint-disable new-cap */

import { AsnProp, AsnPropTypes, AsnSerializer } from '@peculiar/asn1-schema';

import { verifySignature } from '../../../utilities/crypto/signing.js';

import { AccountRequest } from './AccountRequest.js';

export class AccountRequestSignature {
  @AsnProp({ type: AccountRequest, context: 0, implicit: true })
  public request!: AccountRequest;

  @AsnProp({ type: AsnPropTypes.BitString, context: 1, implicit: true })
  public signature!: ArrayBuffer;

  public async verifySignature(): Promise<boolean> {
    const plaintext = AsnSerializer.serialize(this.request);
    const publicKeyDer = AsnSerializer.serialize(this.request.publicKey);
    return verifySignature(plaintext, this.signature, publicKeyDer);
  }
}
