import { type Compute, GoogleAuth } from 'google-auth-library';
import moize from 'moize';
import { minutesToMilliseconds } from 'date-fns';

const googleAuth = new GoogleAuth();

const TOKEN_TTL_MINUTES = 15;
const TOKEN_TTL_MS = minutesToMilliseconds(TOKEN_TTL_MINUTES);

async function getGoogleIdTokenUncached(audience: string): Promise<string> {
  const client = (await googleAuth.getClient()) as Compute;
  return client.fetchIdToken(audience);
}

export const getGoogleIdToken = moize(getGoogleIdTokenUncached, {
  isPromise: true,
  maxAge: TOKEN_TTL_MS,
});
