import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../testUtils/envVars.js';
import { VAUTH_TOKEN, VAUTH_API_URL } from '../testUtils/veraid/authority/stubs.js';

const mockGetGoogleIdToken = jest.fn<() => Promise<string>>().mockResolvedValue(VAUTH_TOKEN);
jest.unstable_mockModule('./googleAuthn.js', () => ({
  getGoogleIdToken: mockGetGoogleIdToken,
}));

class MockAuthorityClient {
  public constructor(public baseUrl: string, public authHeader: any) {}
}
jest.unstable_mockModule('@relaycorp/veraid-authority', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AuthorityClient: MockAuthorityClient,
}));

// eslint-disable-next-line @typescript-eslint/naming-convention
const { VeraidAuthClientMaker } = await import('./VeraidAuthClientMaker.js');

describe('Maker', () => {
  const mockEnvVars = configureMockEnvVars({ VAUTH_API_URL });

  describe('init', () => {
    test('Environment variable VAUTH_API_URL should be defined', () => {
      mockEnvVars({ VAUTH_API_URL: undefined });

      expect(() => VeraidAuthClientMaker.init()).toThrowWithMessage(
        envVar.EnvVarError,
        /VAUTH_API_URL/u,
      );
    });

    test('Token audience should use VAUTH_API_URL', () => {
      const authority = VeraidAuthClientMaker.init();

      expect(authority.authnTokenAudience).toBe(VAUTH_API_URL);
    });
  });

  describe('make', () => {
    test('Token should be retrieved with specified audience', async () => {
      const authority = VeraidAuthClientMaker.init();

      await authority.make();

      expect(mockGetGoogleIdToken).toHaveBeenCalledWith(VAUTH_API_URL);
    });

    test('Client should connect to the specified API URL', async () => {
      const authority = VeraidAuthClientMaker.init();

      const client = (await authority.make()) as unknown as MockAuthorityClient;

      expect(client.baseUrl).toBe(VAUTH_API_URL);
    });

    test('Client should use the retrieved token', async () => {
      const authority = VeraidAuthClientMaker.init();

      const client = (await authority.make()) as unknown as MockAuthorityClient;

      expect(client.authHeader).toHaveProperty('parameters', VAUTH_TOKEN);
    });

    test('Client should use token of type Bearer', async () => {
      const authority = VeraidAuthClientMaker.init();

      const client = (await authority.make()) as unknown as MockAuthorityClient;

      expect(client.authHeader).toHaveProperty('scheme', 'Bearer');
    });
  });
});
