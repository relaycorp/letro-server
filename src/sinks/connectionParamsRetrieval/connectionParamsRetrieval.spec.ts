import { jest } from '@jest/globals';

import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';
import { mockSpy } from '../../testUtils/jest.js';
import { partialPinoLog } from '../../testUtils/logging.js';
import { RELAYCORP_LETRO_TYPES } from '../../utilities/letro.js';
import { VERSION } from '../../testUtils/envVars.js';
import { bufferToArrayBuffer } from '../../utilities/buffer.js';

import { AWALA_CONTENT_TYPES } from './awala.js';

interface InternetNodeAddress {
  readonly host: string;
  readonly port: number;
}
const mockInternetAddress: InternetNodeAddress = { host: 'endpoint.com', port: 123 };
const mockResolveInternetAddress = mockSpy(
  jest.fn<() => Promise<InternetNodeAddress | null>>(),
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => mockInternetAddress as InternetNodeAddress | null,
);
const mockPdcBinding = 'awala-pdc';
class UnreachableResolverError extends Error {}
jest.unstable_mockModule('@relaycorp/relaynet-core', () => ({
  resolveInternetAddress: mockResolveInternetAddress,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  BindingType: { PDC: mockPdcBinding },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  UnreachableResolverError,
}));

const { default: connectionParamsRetrieval } = await import('./connectionParamsRetrieval.js');

const MOCK_CONNECTION_PARAMS = Buffer.from('connection params');
const mockFetch = mockSpy(jest.spyOn(global, 'fetch'));
beforeEach(() => {
  const headers = new Headers();
  headers.set('content-type', AWALA_CONTENT_TYPES.CONNECTION_PARAMS);
  const response = new Response(bufferToArrayBuffer(MOCK_CONNECTION_PARAMS), { headers });
  mockFetch.mockResolvedValue(response);
});

const DOMAIN_NAME = 'example.com';
const DOMAIN_NAME_BUFFER = Buffer.from(DOMAIN_NAME);

describe('connectionParamsRetrieval handler', () => {
  const { senderEndpointId, recipientEndpointId, emittedEvents, logs, runner } =
    makeSinkTestRunner(connectionParamsRetrieval);

  const misconfiguredEndpointMatch = expect.objectContaining({
    source: recipientEndpointId,
    subject: senderEndpointId,
    datacontenttype: RELAYCORP_LETRO_TYPES.MISCONFIGURED_ENDPOINT,
    data: DOMAIN_NAME_BUFFER,
  });

  describe('Domain name validation', () => {
    const longestNameLabel = 'a'.repeat(63);

    test('Domain name of up to 128 characters should be accepted', async () => {
      // eslint-disable-next-line max-len
      const domainName = `${longestNameLabel}.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.com`;
      expect(domainName).toHaveLength(128);
      const domainNameBuffer = Buffer.from(domainName);

      await expect(runner(domainNameBuffer)).resolves.toBeTrue();

      expect(mockResolveInternetAddress).toHaveBeenCalledWith(domainName, expect.anything());
    });

    test('Domain name longer than 128 characters should be refused', async () => {
      // eslint-disable-next-line max-len
      const domainName = `${longestNameLabel}}.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.ab.com`;
      expect(domainName).toHaveLength(129);
      const domainNameBuffer = Buffer.from(domainName);

      await expect(runner(domainNameBuffer)).resolves.toBeTrue();

      expect(mockResolveInternetAddress).not.toHaveBeenCalled();
      expect(emittedEvents).toHaveLength(0);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Requested domain name is too long', { domainNameLength: 129 }),
      );
    });

    test('Non-ASCII domain names should be allowed', async () => {
      const domainName = 'はじめよう.みんな';
      const domainNameBuffer = Buffer.from(domainName);

      await expect(runner(domainNameBuffer)).resolves.toBeTrue();

      expect(mockResolveInternetAddress).toHaveBeenCalledWith(domainName, expect.anything());
    });

    test('Malformed domain name should be refused', async () => {
      const domainName = 'malformed';
      const domainNameBuffer = Buffer.from(domainName);

      await expect(runner(domainNameBuffer)).resolves.toBeTrue();

      expect(mockResolveInternetAddress).not.toHaveBeenCalled();
      expect(emittedEvents).toHaveLength(0);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Requested domain name is malformed', { domainName }),
      );
    });
  });

  describe('Awala Internet address resolution', () => {
    test('Specified domain name should be resolved', async () => {
      await runner(DOMAIN_NAME_BUFFER);

      expect(mockResolveInternetAddress).toHaveBeenCalledWith(DOMAIN_NAME, expect.anything());
    });

    test('PDC binding should be requested', async () => {
      await runner(DOMAIN_NAME_BUFFER);

      expect(mockResolveInternetAddress).toHaveBeenCalledWith(expect.anything(), mockPdcBinding);
    });

    test('Successful resolution should be logged', async () => {
      await runner(DOMAIN_NAME_BUFFER);

      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Awala endpoint record found', {
          internetAddress: DOMAIN_NAME,
          endpointHost: mockInternetAddress.host,
        }),
      );
    });

    test('Non-existing DNS record should result in error message emitted', async () => {
      mockResolveInternetAddress.mockResolvedValue(null);

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(emittedEvents).toContainEqual(misconfiguredEndpointMatch);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Awala endpoint record not found', { internetAddress: DOMAIN_NAME }),
      );
    });

    test('DNS resolution errors should result in a retry', async () => {
      const error = new UnreachableResolverError('Whops!');
      mockResolveInternetAddress.mockRejectedValue(error);

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeFalse();

      expect(logs).toContainEqual(
        partialPinoLog('error', 'Failed to use DNS resolver', {
          err: expect.objectContaining({ message: error.message }),
          internetAddress: DOMAIN_NAME,
        }),
      );
      expect(emittedEvents).toHaveLength(0);
    });

    test('Misconfigured DNS should result in error message emitted', async () => {
      const error = new Error('DNS is misconfigured');
      mockResolveInternetAddress.mockRejectedValue(error);

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(emittedEvents).toContainEqual(misconfiguredEndpointMatch);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Invalid Awala DNS configuration', {
          internetAddress: DOMAIN_NAME,
          err: expect.objectContaining({ message: error.message }),
        }),
      );
    });
  });

  describe('Connection params retrieval', () => {
    const mockSignalTimeout = mockSpy(jest.spyOn(AbortSignal, 'timeout'));

    test('Connection params path should be retrieved from resolved address', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const path = '/connection-params.der';
      const expectedUrl = `https://${mockInternetAddress.host}:${mockInternetAddress.port}${path}`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.anything());
    });

    test('Request should time out after 3 seconds', async () => {
      const mockAbortSignal = Symbol('mock AbortSignal') as unknown as AbortSignal;
      mockSignalTimeout.mockReturnValue(mockAbortSignal);

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: mockAbortSignal }),
      );
      expect(mockSignalTimeout).toHaveBeenCalledWith(3000);
    });

    test('User agent should be Letro server', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const expectedUserAgent = `Letro-Server/${VERSION}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.toSatisfy<Headers>(
            (headers) => headers.get('user-agent') === expectedUserAgent,
          ),
        }),
      );
    });

    test('Connection errors should result in a retry', async () => {
      const error = new Error('This is a 500 response');
      mockFetch.mockRejectedValue(error);

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeFalse();

      expect(logs).toContainEqual(
        partialPinoLog('error', 'Failed to retrieve connection params', {
          err: expect.objectContaining({ message: error.message }),
          internetAddress: DOMAIN_NAME,
        }),
      );
    });

    test('HTTP 5XX response should result in a retry', async () => {
      const status = 500;
      mockFetch.mockResolvedValue(new Response('{}', { status }));

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeFalse();

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Failed to retrieve connection params due to server error', {
          internetAddress: DOMAIN_NAME,
          status,
        }),
      );
    });

    test('HTTP 4XX response should result in error message emitted', async () => {
      const status = 404;
      mockFetch.mockResolvedValue(new Response('{}', { status }));

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(emittedEvents).toContainEqual(misconfiguredEndpointMatch);
      expect(logs).toContainEqual(
        partialPinoLog(
          'info',
          'Failed to retrieve connection params from non-PoHTTP-compatible server',
          {
            internetAddress: DOMAIN_NAME,
            status,
          },
        ),
      );
    });

    test('Invalid response content type should result in error message emitted', async () => {
      const contentType = 'application/invalid';
      const headers = new Headers();
      headers.set('content-type', contentType);
      mockFetch.mockResolvedValue(new Response(MOCK_CONNECTION_PARAMS, { headers }));

      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(emittedEvents).toContainEqual(misconfiguredEndpointMatch);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Received invalid content type for connection params', {
          contentType,
          internetAddress: DOMAIN_NAME,
        }),
      );
    });
  });

  describe('Outgoing connection params message', () => {
    test('Sender should be the recipient of the incoming message', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const [event] = emittedEvents;
      expect(event.source).toBe(recipientEndpointId);
    });

    test('Recipient should be the sender of the incoming message', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const [event] = emittedEvents;
      expect(event.subject).toBe(senderEndpointId);
    });

    test('Content type should be the connection params content type', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const [event] = emittedEvents;
      expect(event.datacontenttype).toBe(RELAYCORP_LETRO_TYPES.CONNECTION_PARAMS);
    });

    test('Content should be the connection params', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      const [event] = emittedEvents;
      expect(event.data).toMatchObject(MOCK_CONNECTION_PARAMS);
    });

    test('Emission of outgoing message should be logged', async () => {
      await expect(runner(DOMAIN_NAME_BUFFER)).resolves.toBeTrue();

      expect(logs).toContainEqual(
        partialPinoLog('info', 'Connection parameters sent', { internetAddress: DOMAIN_NAME }),
      );
    });
  });
});
