import { jest } from '@jest/globals';
import type { SignatureBundleVerification, IDatePeriod } from '@relaycorp/veraid';
import { subDays } from 'date-fns';

import { mockSpy } from '../../testUtils/jest.js';
import { ORG_NAME, USER_ID, USER_NAME } from '../../testUtils/veraid/stubs.js';
import { bufferToArrayBuffer } from '../buffer.js';
import { LETRO_VERAID_SVC_OID } from '../letro.js';
import type { FailureResult, SuccessfulResult } from '../result.js';

import type { ValidSignature } from './signatureVerification.js';

const PLAINTEXT = bufferToArrayBuffer(Buffer.from('plaintext'));
const mockSignatureBundleVerification: SignatureBundleVerification = {
  member: { user: USER_NAME, organisation: ORG_NAME },
  plaintext: PLAINTEXT,
};
const mockVeraidVerify = mockSpy(
  jest.fn<() => Promise<SignatureBundleVerification>>(),
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => mockSignatureBundleVerification,
);
jest.unstable_mockModule('@relaycorp/veraid', () => ({
  verify: mockVeraidVerify,
}));
const { verifyVeraidSignature } = await import('./signatureVerification.js');

const SIGNATURE_BUNDLE = bufferToArrayBuffer(Buffer.from('signature bundle'));

describe('verifyVeraidSignature', () => {
  describe('Verification', () => {
    test('Plaintext should be encapsulated', async () => {
      await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(mockVeraidVerify).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    test('Specified signature bundle should be used', async () => {
      await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(mockVeraidVerify).toHaveBeenCalledWith(
        undefined,
        expect.toSatisfy<ArrayBuffer>((bundle) => bundle === SIGNATURE_BUNDLE),
        expect.anything(),
        expect.anything(),
      );
    });

    test('Signature should have been valid in the past 90 days', async () => {
      const dateBeforeVerification = new Date();

      await verifyVeraidSignature(SIGNATURE_BUNDLE);

      const dateAfterVerification = new Date();
      const cutoffDays = 90;
      expect(mockVeraidVerify).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        expect.anything(),
        expect.toSatisfy<IDatePeriod>(
          ({ start, end }) =>
            subDays(dateBeforeVerification, cutoffDays) <= start &&
            start <= subDays(dateAfterVerification, cutoffDays) &&
            end <= dateAfterVerification &&
            dateBeforeVerification <= end,
        ),
      );
    });

    test('Signature should be valid for the Letro service', async () => {
      await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(mockVeraidVerify).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        LETRO_VERAID_SVC_OID,
        expect.anything(),
      );
    });

    test('Verification errors should be returned (not thrown)', async () => {
      const error = new Error('Oh noes!');
      mockVeraidVerify.mockRejectedValueOnce(error);

      const result = await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(result.didSucceed).toBeFalse();
      expect((result as FailureResult<Error>).context).toBe(error);
    });
  });

  describe('Output', () => {
    test('Member id should be extracted from the signature', async () => {
      const result = await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(result.didSucceed).toBeTrue();
      const signature = (result as SuccessfulResult<ValidSignature>).result;
      expect(signature.signerVeraidId).toBe(USER_ID);
      expect(signature.signerVeraidName).toBe(USER_NAME);
    });

    test('Member id should be allowed to be that of a bot', async () => {
      mockVeraidVerify.mockResolvedValue({
        member: { organisation: ORG_NAME },
        plaintext: PLAINTEXT,
      });

      const result = await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(result.didSucceed).toBeTrue();
      const signature = (result as SuccessfulResult<ValidSignature>).result;
      expect(signature.signerVeraidId).toBe(ORG_NAME);
      expect(signature.signerVeraidName).toBeUndefined();
    });

    test('Plaintext should be extracted from the signature', async () => {
      const result = await verifyVeraidSignature(SIGNATURE_BUNDLE);

      expect(result.didSucceed).toBeTrue();
      expect((result as SuccessfulResult<ValidSignature>).result.plaintext).toBe(PLAINTEXT);
    });
  });
});
