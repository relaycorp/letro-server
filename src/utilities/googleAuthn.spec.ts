import { jest } from '@jest/globals';

import { mockSpy } from '../testUtils/jest.js';

const ID_TOKEN = 'the id token';
// eslint-disable-next-line @typescript-eslint/require-await
const mockFetchIdToken = mockSpy(jest.fn<() => Promise<string>>(), async () => ID_TOKEN);
jest.unstable_mockModule('google-auth-library', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  GoogleAuth: jest.fn().mockReturnValue({
    getClient: jest.fn().mockReturnValue({
      fetchIdToken: mockFetchIdToken,
    }),
  }),
}));

const { getGoogleIdToken } = await import('./googleAuthn.js');

const AUDIENCE = 'the audience';

describe('getGoogleIdToken', () => {
  test('Specified audience should be used', async () => {
    await getGoogleIdToken(AUDIENCE);

    expect(mockFetchIdToken).toHaveBeenCalledWith(AUDIENCE);
  });

  test('Id token should be returned', async () => {
    const result = await getGoogleIdToken(AUDIENCE);

    expect(result).toBe(ID_TOKEN);
  });

  test('Token should be cached for 15 minutes', () => {
    expect(getGoogleIdToken.options.maxAge).toBe(15 * 60 * 1000);
  });
});
