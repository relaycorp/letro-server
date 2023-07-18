import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { CloudEventV1 } from 'cloudevents';

import { partialPinoLog } from '../../testUtils/logging.js';
import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';
import { ContactPairingRequest } from '../../models/ContactPairingRequest.model.js';

import pairingRequestTmp from './pairingRequestTmp.js';

function serialiseContactRequest(
  requesterId: string,
  targetId: string,
  requesterIdKey: Buffer,
): Buffer {
  return Buffer.from(`${requesterId},${targetId},${requesterIdKey.toString('base64')}`);
}

describe('contactRequestTmp', () => {
  const requesterId = 'requester@example.com';
  const requesterIdKey = Buffer.from('requesterIdKey');
  const targetId = 'target@foo.bar';
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
    await runner(Buffer.from('one,two'));

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refused malformed request containing fewer than 3 fields'),
    );
  });

  describe('Non-matching request', () => {
    test('Request should be created if it does not exist', async () => {
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey));

      await expect(
        requestModel.exists({ requesterId, targetId, requesterEndpointId, requesterIdKey }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterId,
          targetId,
        }),
      );
    });

    test('Request should be updated if it exists', async () => {
      // Request #1
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey));

      // Request #2
      const requesterIdKey2 = Buffer.concat([requesterIdKey, Buffer.from('2')]);
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey2));

      await expect(
        requestModel.exists({ requesterId, targetId, requesterEndpointId, requesterIdKey }),
      ).resolves.toBeNull();
      await expect(
        requestModel.exists({
          requesterId,
          targetId,
          requesterEndpointId,
          requesterIdKey: requesterIdKey2,
        }),
      ).resolves.not.toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request created or updated', {
          requesterId,
          targetId,
        }),
      );
    });
  });

  describe('Matching request', () => {
    test('Neither request should be left in the DB', async () => {
      // Request #1: Swap the requester and target
      await runner(serialiseContactRequest(targetId, requesterId, targetIdKey));

      // Request #2
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey));

      await expect(requestModel.exists({ requesterId, targetId })).resolves.toBeNull();
      await expect(
        requestModel.exists({ requesterId: targetId, targetId: requesterId }),
      ).resolves.toBeNull();
    });

    test('Both peers should get their requests swapped', async () => {
      // Request #1: Swap the requester and target
      const originalRequesterEndpointId = 'originalRequesterEndpointId';
      await runner(serialiseContactRequest(targetId, requesterId, targetIdKey), {
        senderEndpointId: originalRequesterEndpointId,
      });

      // Request #2
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey));

      expect(emittedEvents).toHaveLength(2);
      const [event1, event2] = emittedEvents;
      expect(event1).toMatchObject(
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          source: ownEndpointId,
          subject: requesterEndpointId,
          datacontenttype: pairingRequestTmp.contentType,

          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: serialiseContactRequest(targetId, requesterId, targetIdKey).toString(
            'base64',
          ),
        }),
      );
      expect(event2).toMatchObject(
        expect.objectContaining<Partial<CloudEventV1<Buffer>>>({
          source: ownEndpointId,
          subject: originalRequesterEndpointId,
          datacontenttype: pairingRequestTmp.contentType,

          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          data_base64: serialiseContactRequest(requesterId, targetId, requesterIdKey).toString(
            'base64',
          ),
        }),
      );
    });

    test('Match should be logged', async () => {
      // Request #1: Swap the requester and target
      await runner(serialiseContactRequest(targetId, requesterId, targetIdKey));

      // Request #2
      await runner(serialiseContactRequest(requesterId, targetId, requesterIdKey));

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Contact request matched', {
          requesterId,
          targetId,
        }),
      );
    });
  });
});
