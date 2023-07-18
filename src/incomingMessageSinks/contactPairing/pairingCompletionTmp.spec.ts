import {
  CertificationPath,
  generateRSAKeyPair,
  getIdFromIdentityKey,
  InvalidNodeConnectionParams,
  issueDeliveryAuthorization,
  issueEndpointCertificate,
  PrivateEndpointConnParams,
  SessionKeyPair,
} from '@relaycorp/relaynet-core';
import type { CloudEventV1 } from 'cloudevents';
import { addDays } from 'date-fns';

import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';
import { partialPinoLog } from '../../testUtils/logging.js';

import pairingCompletionTmp, { PAIRING_COMPLETE_CONTENT_TYPE } from './pairingCompletionTmp.js';

const granterIdentityKeyPair = await generateRSAKeyPair();
const granterCert = await issueEndpointCertificate({
  issuerPrivateKey: granterIdentityKeyPair.privateKey,
  subjectPublicKey: granterIdentityKeyPair.publicKey,
  validityEndDate: addDays(new Date(), 1),
});
const granteeIdentityKeyPair = await generateRSAKeyPair();
const pda = await issueDeliveryAuthorization({
  issuerPrivateKey: granterIdentityKeyPair.privateKey,
  issuerCertificate: granterCert,
  subjectPublicKey: granteeIdentityKeyPair.publicKey,
  validityEndDate: granterCert.expiryDate,
});
const sessionKeyPair = await SessionKeyPair.generate();

function serialiseCompletionContent(granterEndpointId: string, connectionParamsSerialised: Buffer) {
  return Buffer.from(`${granterEndpointId},${connectionParamsSerialised.toString('base64')}`);
}

describe('pairingCompletionTmp', () => {
  const {
    logs,
    emittedEvents,
    senderEndpointId,
    recipientEndpointId: ownEndpointId,
    runner,
  } = makeSinkTestRunner(pairingCompletionTmp);

  test('Malformed connection params should be refused', async () => {
    await runner(Buffer.from('malformed'));

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refused malformed connection params', {
        err: expect.objectContaining({ type: InvalidNodeConnectionParams.name }),
      }),
    );
  });

  test('Connection params not issued by sender should be refused', async () => {
    const connectionParams = new PrivateEndpointConnParams(
      granterIdentityKeyPair.publicKey,
      'gateway.com',
      new CertificationPath(pda, []),
      sessionKeyPair.sessionKey,
    );

    await runner(Buffer.from(await connectionParams.serialize()));

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refused connection params not issued by sender', {
        messageSenderId: senderEndpointId,
        granterId: await getIdFromIdentityKey(granterIdentityKeyPair.publicKey),
      }),
    );
    expect(emittedEvents).toBeEmpty();
  });

  test('Connection params should be forwarded to contact', async () => {
    const connectionParams = new PrivateEndpointConnParams(
      granterIdentityKeyPair.publicKey,
      'gateway.com',
      new CertificationPath(pda, []),
      sessionKeyPair.sessionKey,
    );
    const granterEndpointId = await getIdFromIdentityKey(granterIdentityKeyPair.publicKey);
    const connectionParamsSerialised = Buffer.from(await connectionParams.serialize());

    await runner(connectionParamsSerialised, { senderEndpointId: granterEndpointId });

    const granteeEndpointId = await getIdFromIdentityKey(granteeIdentityKeyPair.publicKey);
    expect(emittedEvents).toContainEqual(
      expect.objectContaining<Partial<CloudEventV1<any>>>({
        source: ownEndpointId,
        subject: granteeEndpointId,
        datacontenttype: PAIRING_COMPLETE_CONTENT_TYPE,

        // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
        data_base64: serialiseCompletionContent(
          granterEndpointId,
          connectionParamsSerialised,
        ).toString('base64'),
      }),
    );
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Forwarded connection params to contact', {
        granterId: granterEndpointId,
        granteeId: granteeEndpointId,
      }),
    );
  });
});
