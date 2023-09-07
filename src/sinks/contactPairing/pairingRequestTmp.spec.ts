import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { CloudEventV1 } from 'cloudevents';

import { partialPinoLog } from '../../testUtils/logging.js';
import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';
import { ContactPairingRequest } from '../../models/ContactPairingRequest.model.js';

import pairingRequestTmp, { MATCH_CONTENT_TYPE } from './pairingRequestTmp.js';

function serialiseContactRequest(
  requesterVeraId: string,
  targetVeraId: string,
  requesterIdKey: Buffer,
): Buffer {
  return Buffer.from(`${requesterVeraId},${targetVeraId},${requesterIdKey.toString('base64')}`);
}

function serialiseContactMatch(
  requesterVeraId: string,
  targetVeraId: string,
  requesterEndpointId: string,
  requesterIdKey: Buffer,
): Buffer {
  return Buffer.from(
    `${requesterVeraId},${targetVeraId},${requesterEndpointId},${requesterIdKey.toString(
      'base64',
    )}`,
  );
}

describe('contactRequestTmp', () => {
  const requesterVeraId = 'requester@example.com';
  const requesterIdKey = Buffer.from('requesterIdKey');
  const targetVeraId = 'target@foo.bar';
  const targetIdKey = Buffer.from('targetIdKey');

  const {
    getDbConnection,
    logs,
    emittedEvents,
    senderEndpointId: requesterEndpointId,
    recipientEndpointId: ownEndpointId,
    runner,
  } = makeSinkTestRunner(pairingRequestTmp);

  let requestModel: ReturnModelType<typeof ContactPairingRequest>;
  beforeEach(() => {
    requestModel = getModelForClass(ContactPairingRequest, {
      existingConnection: getDbConnection(),
    });
  });

  test('Input message should have at least 3 comma-separated fields', async () => {
    await expect(runner(Buffer.from('one,two'))).resolves.toBeTrue();

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refused malformed request containing fewer than 3 fields'),
    );
  });

  describe('Non-matching request', () => {
    test('Request should be created if it does not exist', async () => {
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey)),
      ).resolves.toBeTrue();

      await expect(
        requestModel.exists({ requesterVeraId, targetVeraId, requesterEndpointId, requesterIdKey }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterVeraId,
          targetVeraId,
        }),
      );
    });

    test('Request should be updated if it exists', async () => {
      // Request #1
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey)),
      ).resolves.toBeTrue();

      // Request #2
      const requesterIdKey2 = Buffer.concat([requesterIdKey, Buffer.from('2')]);
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey2)),
      ).resolves.toBeTrue();

      await expect(
        requestModel.exists({
          requesterVeraId,
          targetVeraId,
          requesterEndpointId,
          requesterIdKey,
        }),
      ).resolves.toBeNull();
      await expect(
        requestModel.exists({
          requesterVeraId,
          targetVeraId,
          requesterEndpointId,
          requesterIdKey: requesterIdKey2,
        }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterVeraId,
          targetVeraId,
        }),
      );
    });
  });

  describe('Matching request', () => {
    test('Neither request should be left in the DB', async () => {
      // Request #1: Swap the requester and target
      await expect(
        runner(serialiseContactRequest(targetVeraId, requesterVeraId, targetIdKey)),
      ).resolves.toBeTrue();

      // Request #2
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey)),
      ).resolves.toBeTrue();

      await expect(requestModel.exists({ requesterVeraId, targetVeraId })).resolves.toBeNull();
      await expect(
        requestModel.exists({ requesterVeraId: targetVeraId, targetVeraId: requesterVeraId }),
      ).resolves.toBeNull();
    });

    test('Both peers should get their requests swapped', async () => {
      // Request #1: Swap the requester and target
      const originalRequesterEndpointId = 'originalRequesterEndpointId';
      await expect(
        runner(serialiseContactRequest(targetVeraId, requesterVeraId, targetIdKey), {
          senderEndpointId: originalRequesterEndpointId,
        }),
      ).resolves.toBeTrue();

      // Request #2
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey)),
      ).resolves.toBeTrue();

      expect(emittedEvents).toHaveLength(2);
      const [event1, event2] = emittedEvents;
      expect(event1).toMatchObject(
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          source: ownEndpointId,
          subject: requesterEndpointId,
          datacontenttype: MATCH_CONTENT_TYPE,

          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: serialiseContactMatch(
            requesterVeraId,
            targetVeraId,
            originalRequesterEndpointId,
            targetIdKey,
          ).toString('base64'),
        }),
      );
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Pairing match sent', { peerId: requesterEndpointId }),
      );
      expect(event2).toMatchObject(
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          source: ownEndpointId,
          subject: originalRequesterEndpointId,
          datacontenttype: MATCH_CONTENT_TYPE,

          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: serialiseContactMatch(
            targetVeraId,
            requesterVeraId,
            requesterEndpointId,
            requesterIdKey,
          ).toString('base64'),
        }),
      );
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Pairing match sent', { peerId: originalRequesterEndpointId }),
      );
    });

    test('Match should be logged', async () => {
      // Request #1: Swap the requester and target
      await expect(
        runner(serialiseContactRequest(targetVeraId, requesterVeraId, targetIdKey)),
      ).resolves.toBeTrue();

      // Request #2
      await expect(
        runner(serialiseContactRequest(requesterVeraId, targetVeraId, requesterIdKey)),
      ).resolves.toBeTrue();

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request matched', {
          requesterVeraId,
          targetVeraId,
        }),
      );
    });
  });
});
