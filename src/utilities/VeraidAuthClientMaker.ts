import { AuthorityClient } from '@relaycorp/veraid-authority';
import envVar from 'env-var';

import { getGoogleIdToken } from './googleAuthn.js';

export class VeraidAuthClientMaker {
  public static init(): VeraidAuthClientMaker {
    const apiUrl = envVar.get('VAUTH_API_URL').required().asString();
    return new VeraidAuthClientMaker(apiUrl);
  }

  protected constructor(public readonly authnTokenAudience: string) {}

  public async make(): Promise<AuthorityClient> {
    const token = await getGoogleIdToken(this.authnTokenAudience);
    const authHeader = { scheme: 'Bearer', parameters: token };
    return new AuthorityClient(this.authnTokenAudience, authHeader);
  }
}
