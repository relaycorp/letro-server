import { verify, type IDatePeriod } from '@relaycorp/veraid';
import { subDays } from 'date-fns';

import type { Result } from '../result.js';
import { LETRO_VERAID_SVC_OID } from '../letro.js';

const TTL_DAYS = 90;

export interface ValidSignature {
  readonly signerVeraidId: string;
  readonly signerVeraidName?: string;
  readonly plaintext: ArrayBuffer;
}

export type SignatureVerification = Result<ValidSignature, Error>;

export async function verifyVeraidSignature(
  signatureBundle: ArrayBuffer,
): Promise<SignatureVerification> {
  const now = new Date();
  const datePeriod: IDatePeriod = { start: subDays(now, TTL_DAYS), end: now };

  let verificationResult;
  try {
    verificationResult = await verify(undefined, signatureBundle, LETRO_VERAID_SVC_OID, datePeriod);
  } catch (err) {
    return { didSucceed: false, context: err as Error };
  }

  const { user, organisation } = verificationResult.member;
  const signerVeraidId = user === undefined ? organisation : `${user}@${organisation}`;
  return {
    didSucceed: true,
    result: { plaintext: verificationResult.plaintext, signerVeraidId, signerVeraidName: user },
  };
}
