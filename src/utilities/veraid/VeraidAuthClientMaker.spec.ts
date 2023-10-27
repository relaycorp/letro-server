import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import {
  VAUTH_TOKEN,
  VAUTH_API_URL,
  VAUTH_API_AUDIENCE,
} from '../../testUtils/veraid/authority/stubs.js';

const mockGetGoogleIdToken = jest.fn<() => Promise<string>>().mockResolvedValue(VAUTH_TOKEN);
jest.unstable_mockModule('../googleAuthn.js', () => ({
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
  const baseEnvVars = { VAUTH_API_URL, VAUTH_API_AUDIENCE };
  const mockEnvVars = configureMockEnvVars(baseEnvVars);

  describe('init', () => {
    test.each(['VAUTH_API_URL', 'VAUTH_API_AUDIENCE'])(
      'Environment variable %s should be defined',
      (envVarName) => {
        mockEnvVars({ ...baseEnvVars, [envVarName]: undefined });

        expect(() => VeraidAuthClientMaker.init()).toThrowWithMessage(
          envVar.EnvVarError,
          // eslint-disable-next-line security/detect-non-literal-regexp
          new RegExp(envVarName, 'u'),
        );
      },
    );
  });

  describe('make', () => {
    test('Token should be retrieved with specified audience', async () => {
      const authority = VeraidAuthClientMaker.init();

      await authority.make();

      expect(mockGetGoogleIdToken).toHaveBeenCalledWith(VAUTH_API_AUDIENCE);
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
