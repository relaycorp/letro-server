import { jest } from '@jest/globals';
import { AsnSerializer } from '@peculiar/asn1-schema';
import type { SubjectPublicKeyInfo } from '@peculiar/asn1-x509';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { CloudEventV1 } from 'cloudevents';
import { generateECDHKeyPair } from '@relaycorp/relaynet-core';

import { makeErrorLogMatcher, partialPinoLog } from '../../testUtils/logging.js';
import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';
import { ContactPairingRequest as RequestModel } from '../../models/ContactPairingRequest.model.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { SignatureVerification } from '../../utilities/veraid/signatureVerification.js';
import { ORG_NAME } from '../../testUtils/veraid/stubs.js';
import { derSerialiseEncodedPublicKey, encodePublicKey } from '../../testUtils/crypto/keys.js';
import { type Endpoint, generateEndpoint } from '../../testUtils/awala.js';
import { OUTGOING_SERVICE_MESSAGE_TYPE } from '../../utilities/awalaEndpoint.js';

import { CONTACT_PAIRING_CONTENT_TYPES } from './contentTypes.js';
import { ContactPairingRequest } from './schemas/ContactPairingRequest.schema.js';
import {
  ContactPairingFailure,
  ContactPairingFailureReason,
} from './schemas/ContactPairingFailure.schema.js';

const mockVerify = mockSpy(jest.fn<() => Promise<SignatureVerification>>());
jest.unstable_mockModule('../../utilities/veraid/signatureVerification.js', () => ({
  verifyVeraidSignature: mockVerify,
}));
const pairingRequest = await import('./pairingRequest.js');

function serialisePairingFailure(
  targetContactVeraid: string,
  reason: ContactPairingFailureReason,
): Buffer {
  const failure = new ContactPairingFailure();
  failure.targetContactVeraid = targetContactVeraid;
  failure.reason = reason;
  return Buffer.from(AsnSerializer.serialize(failure));
}

function serialisePairingRequest(
  requesterAwalaEndpointPublicKey: SubjectPublicKeyInfo,
  targetVeraidId: string,
): ArrayBuffer {
  const request = new ContactPairingRequest();
  request.requesterAwalaEndpointPublicKey = requesterAwalaEndpointPublicKey;
  request.targetVeraidId = targetVeraidId;
  return AsnSerializer.serialize(request);
}

function serialiseMockRequestSignature(
  requesterVeraidId: string,
  requesterAwalaEndpointPublicKey: SubjectPublicKeyInfo,
  targetVeraidId: string,
): Buffer {
  return Buffer.concat([
    Buffer.from(requesterVeraidId),
    Buffer.from(targetVeraidId),
    Buffer.from(AsnSerializer.serialize(requesterAwalaEndpointPublicKey)),
  ]);
}

function mockPairingRequest(
  requesterVeraidId: string,
  requesterAwalaEndpointPublicKey: SubjectPublicKeyInfo,
  targetVeraidId: string,
): ArrayBuffer {
  const requestSerialised = serialisePairingRequest(
    requesterAwalaEndpointPublicKey,
    targetVeraidId,
  );
  const signerVeraidName = requesterVeraidId.includes('@')
    ? requesterVeraidId.split('@')[0]
    : undefined;
  mockVerify.mockResolvedValueOnce({
    didSucceed: true,
    result: { signerVeraidId: requesterVeraidId, signerVeraidName, plaintext: requestSerialised },
  });
  return requestSerialised;
}

const {
  getDbConnection,
  logs,
  emittedEvents,
  senderEndpoint: requesterEndpoint,
  recipientEndpointId: ownEndpointId,
  runner,
} = await makeSinkTestRunner(pairingRequest.default);

const targetEndpoint = await generateEndpoint();

async function postPairingRequest(
  requesterAwalaEndpoint: Endpoint,
  requesterVeraidId: string,
  targetVeraidId: string,
): Promise<Buffer> {
  mockPairingRequest(requesterVeraidId, requesterAwalaEndpoint.publicKey, targetVeraidId);
  const stubSignatureBundle = serialiseMockRequestSignature(
    requesterVeraidId,
    requesterAwalaEndpoint.publicKey,
    targetVeraidId,
  );

  await expect(
    runner(stubSignatureBundle, { senderEndpointId: requesterAwalaEndpoint.id }),
  ).resolves.toBeTrue();

  return stubSignatureBundle;
}

function makeFailureEventMatcher(
  targetContactVeraid: string,
  reason: ContactPairingFailureReason,
): any {
  const failureData = serialisePairingFailure(targetContactVeraid, reason);
  return expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
    type: OUTGOING_SERVICE_MESSAGE_TYPE,
    source: ownEndpointId,
    subject: requesterEndpoint.id,
    datacontenttype: CONTACT_PAIRING_CONTENT_TYPES.FAILURE,
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    data_base64: failureData.toString('base64'),
  });
}

describe('contactRequest', () => {
  const requesterVeraidId = 'requester@example.com';
  const targetVeraidId = 'target@foo.bar';

  let requestModel: ReturnModelType<typeof RequestModel>;
  beforeEach(() => {
    requestModel = getModelForClass(RequestModel, {
      existingConnection: getDbConnection(),
    });
  });

  describe('Signature bundle validation', () => {
    test('Signature bundle should be valid', async () => {
      const error = new Error('Signature bundle is invalid');
      mockVerify.mockResolvedValueOnce({ didSucceed: false, context: error });
      const bundle = Buffer.from('Not a VeraId SignatureBundle');

      await expect(runner(bundle, { senderEndpointId: requesterEndpoint.id })).resolves.toBeTrue();

      expect(logs).toContainEqual(
        partialPinoLog(
          'info',
          'Refused invalid VeraId SignatureBundle for contact pairing request',
          { err: makeErrorLogMatcher(error), peerId: requesterEndpoint.id },
        ),
      );
      expect(emittedEvents).toBeEmpty();
      expect(mockVerify).toHaveBeenCalledWith(bundle);
    });

    test('Signature bundle should contain a pairing request', async () => {
      mockVerify.mockResolvedValue({
        didSucceed: true,

        result: {
          signerVeraidId: requesterVeraidId,
          signerVeraidName: requesterVeraidId.split('@')[0],
          plaintext: Buffer.from('Not a pairing request'),
        },
      });

      await expect(
        runner(Buffer.from('bundle'), { senderEndpointId: requesterEndpoint.id }),
      ).resolves.toBeTrue();

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed contact pairing request', {
          err: expect.objectContaining({ type: 'Error' }),
          peerId: requesterEndpoint.id,
        }),
      );
      expect(emittedEvents).toBeEmpty();
    });

    test('Signature bundle should be produced by a VeraId org user', async () => {
      await postPairingRequest(requesterEndpoint, ORG_NAME, targetVeraidId);

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused contact pairing request from a VeraId org bot', {
          requesterVeraidId: ORG_NAME,
          peerId: requesterEndpoint.id,
        }),
      );
      expect(emittedEvents).toMatchObject([
        makeFailureEventMatcher(
          targetVeraidId,
          ContactPairingFailureReason.INVALID_REQUESTER_VERAID,
        ),
      ]);
      await expect(requestModel.count()).resolves.toBe(0);
    });

    describe('Pairing request', () => {
      test('Requester Awala endpoint public key should match endpoint id', async () => {
        await postPairingRequest(
          {
            id: requesterEndpoint.id,
            publicKey: targetEndpoint.publicKey, // Invalid
          },
          requesterVeraidId,
          targetVeraidId,
        );

        expect(logs).toContainEqual(
          partialPinoLog(
            'info',
            'Refused pairing request due to mismatching Awala endpoint key from sender',
            { requesterVeraidId, targetVeraidId },
          ),
        );
        expect(emittedEvents).toMatchObject([
          makeFailureEventMatcher(
            targetVeraidId,
            ContactPairingFailureReason.INVALID_REQUESTER_AWALA_KEY,
          ),
        ]);
        await expect(requestModel.count()).resolves.toBe(0);
      });

      test('Requester Awala endpoint public key should be valid', async () => {
        const invalidKeyPair = await generateECDHKeyPair();

        await postPairingRequest(
          {
            id: requesterEndpoint.id,
            publicKey: await encodePublicKey(invalidKeyPair.publicKey), // Invalid
          },
          requesterVeraidId,
          targetVeraidId,
        );

        expect(logs).toContainEqual(
          partialPinoLog('info', 'Refused invalid Awala id key for requester', {
            err: expect.objectContaining({ type: 'Error' }),
          }),
        );
        expect(emittedEvents).toMatchObject([
          makeFailureEventMatcher(
            targetVeraidId,
            ContactPairingFailureReason.INVALID_REQUESTER_AWALA_KEY,
          ),
        ]);
        await expect(requestModel.count()).resolves.toBe(0);
      });

      test('Target contact VeraId should be syntactically valid', async () => {
        const malformedTargetVeraidId = `@${targetVeraidId}`;

        await postPairingRequest(requesterEndpoint, requesterVeraidId, malformedTargetVeraidId);

        expect(logs).toContainEqual(
          partialPinoLog(
            'info',
            'Refused pairing request because the target is not a VeraId user id',
            { requesterVeraidId, targetVeraidId: malformedTargetVeraidId },
          ),
        );
        expect(emittedEvents).toMatchObject([
          makeFailureEventMatcher(
            malformedTargetVeraidId,
            ContactPairingFailureReason.INVALID_TARGET_VERAID,
          ),
        ]);
        await expect(requestModel.count()).resolves.toBe(0);
      });

      test('Target contact VeraId should not be a bot', async () => {
        await postPairingRequest(requesterEndpoint, requesterVeraidId, ORG_NAME);

        expect(logs).toContainEqual(
          partialPinoLog(
            'info',
            'Refused pairing request because the target is not a VeraId user id',
            {
              requesterVeraidId,
              targetVeraidId: ORG_NAME,
            },
          ),
        );
        expect(emittedEvents).toMatchObject([
          makeFailureEventMatcher(ORG_NAME, ContactPairingFailureReason.INVALID_TARGET_VERAID),
        ]);
        await expect(requestModel.count()).resolves.toBe(0);
      });
    });
  });

  describe('Non-matching request', () => {
    test('Request should be created if it does not exist', async () => {
      const bundle = await postPairingRequest(requesterEndpoint, requesterVeraidId, targetVeraidId);

      await expect(
        requestModel.exists({
          requesterVeraId: requesterVeraidId,
          targetVeraId: targetVeraidId,
          requesterEndpointId: requesterEndpoint.id,
          requesterIdKey: derSerialiseEncodedPublicKey(requesterEndpoint.publicKey),
          signatureBundle: bundle,
        }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterVeraidId,
          targetVeraidId,
        }),
      );
    });

    test('Request should be updated if it exists', async () => {
      // Request #1
      await postPairingRequest(requesterEndpoint, requesterVeraidId, targetVeraidId);

      // Request #2 (different Awala endpoint)
      const requesterEndpoint2 = await generateEndpoint();
      const bundle = await postPairingRequest(
        requesterEndpoint2,
        requesterVeraidId,
        targetVeraidId,
      );

      await expect(
        requestModel.exists({
          requesterVeraId: requesterVeraidId,
          targetVeraId: targetVeraidId,
          requesterEndpointId: requesterEndpoint2.id,
          requesterIdKey: derSerialiseEncodedPublicKey(requesterEndpoint2.publicKey),
          signatureBundle: bundle,
        }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterVeraidId,
          targetVeraidId,
        }),
      );
    });
  });

  describe('Matching request', () => {
    async function completePairingRequest(): Promise<[Buffer, Buffer]> {
      // Request #1
      const bundle1 = await postPairingRequest(
        requesterEndpoint,
        requesterVeraidId,
        targetVeraidId,
      );

      // Request #2: Swap the requester and target
      const bundle2 = await postPairingRequest(targetEndpoint, targetVeraidId, requesterVeraidId);

      return [bundle1, bundle2];
    }

    test('Neither request should be left in the DB', async () => {
      await completePairingRequest();

      await expect(
        requestModel.exists({ requesterVeraId: requesterVeraidId, targetVeraId: targetVeraidId }),
      ).resolves.toBeNull();
      await expect(
        requestModel.exists({ requesterVeraId: targetVeraidId, targetVeraId: requesterVeraidId }),
      ).resolves.toBeNull();
    });

    test('Both peers should get their requests swapped', async () => {
      const [bundle1, bundle2] = await completePairingRequest();

      expect(emittedEvents).toMatchObject([
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          type: OUTGOING_SERVICE_MESSAGE_TYPE,
          source: ownEndpointId,
          subject: targetEndpoint.id,
          datacontenttype: CONTACT_PAIRING_CONTENT_TYPES.REQUEST,
          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: bundle1.toString('base64'),
        }),
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          type: OUTGOING_SERVICE_MESSAGE_TYPE,
          source: ownEndpointId,
          subject: requesterEndpoint.id,
          datacontenttype: CONTACT_PAIRING_CONTENT_TYPES.REQUEST,
          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: bundle2.toString('base64'),
        }),
      ]);
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Pairing match sent', { peerId: requesterEndpoint.id }),
      );
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Pairing match sent', { peerId: targetEndpoint.id }),
      );
    });

    test('Match should be logged', async () => {
      await completePairingRequest();

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request matched', {
          requesterVeraidId: targetVeraidId,
          targetVeraidId: requesterVeraidId,
        }),
      );
    });
  });
});
