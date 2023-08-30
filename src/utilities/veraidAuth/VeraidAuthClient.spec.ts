import type { AuthorityClient } from '@relaycorp/veraid-authority';
import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../../testUtils/envVars.js';

import { Command } from './Command.js';

const TOKEN = 'the token';
const mockGetGoogleIdToken = jest.fn<() => Promise<string>>().mockResolvedValue(TOKEN);
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
const { VeraidAuthClient } = await import('./VeraidAuthClient.js');

const VAUTH_API_URL = 'https://veraid-auth.example.com';

class MockCommand extends Command<string> {
  public callClient: MockAuthorityClient | null = null;

  // eslint-disable-next-line @typescript-eslint/require-await
  public async run(client: AuthorityClient): Promise<string> {
    this.callClient = client as unknown as MockAuthorityClient;
    return 'test';
  }
}

describe('VeraidAuthClient', () => {
  const mockEnvVars = configureMockEnvVars({ VAUTH_API_URL });

  describe('init', () => {
    test('Environment variable VAUTH_API_URL should be defined', () => {
      mockEnvVars({ VAUTH_API_URL: undefined });

      expect(() => VeraidAuthClient.init()).toThrowWithMessage(
        envVar.EnvVarError,
        /VAUTH_API_URL/u,
      );
    });

    test('Token audience should use VAUTH_API_URL', () => {
      const authority = VeraidAuthClient.init();

      expect(authority.authnTokenAudience).toBe(VAUTH_API_URL);
    });
  });

  describe('run', () => {
    test('Token should be retrieved with specified audience', async () => {
      const authority = VeraidAuthClient.init();

      await authority.run(new MockCommand());

      expect(mockGetGoogleIdToken).toHaveBeenCalledWith(VAUTH_API_URL);
    });

    test('Client should connect to the specified API URL', async () => {
      const authority = VeraidAuthClient.init();
      const command = new MockCommand();

      await authority.run(command);

      expect(command.callClient!.baseUrl).toBe(VAUTH_API_URL);
    });

    test('Client should use the retrieved token', async () => {
      const authority = VeraidAuthClient.init();
      const command = new MockCommand();

      await authority.run(command);

      expect(command.callClient!.authHeader).toHaveProperty('parameters', TOKEN);
    });

    test('Client should use token of type Bearer', async () => {
      const authority = VeraidAuthClient.init();
      const command = new MockCommand();

      await authority.run(command);

      expect(command.callClient!.authHeader).toHaveProperty('scheme', 'Bearer');
    });
  });
});
