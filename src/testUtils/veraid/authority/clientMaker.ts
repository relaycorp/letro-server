import type { AuthorityClient } from '@relaycorp/veraid-authority';

import { VeraidAuthClientMaker } from '../../../utilities/veraid/VeraidAuthClientMaker.js';

import { VAUTH_API_AUDIENCE, VAUTH_API_URL } from './stubs.js';
import { MockAuthorityClient } from './MockAuthorityClient.js';

class MockClientMaker extends VeraidAuthClientMaker {
  public readonly clients: MockAuthorityClient[] = [];

  public constructor() {
    super(VAUTH_API_URL, VAUTH_API_AUDIENCE);
  }

  public reset(): void {
    this.clients.splice(0, this.clients.length);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async make(): Promise<AuthorityClient> {
    const client = new MockAuthorityClient([]);
    this.clients.push(client);
    return client;
  }
}

export function mockClientMaker(): MockClientMaker {
  const maker = new MockClientMaker();

  beforeEach(() => {
    maker.reset();
  });

  return maker;
}
