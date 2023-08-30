import { AuthorityClient } from '@relaycorp/veraid-authority';
import envVar from 'env-var';

import { getGoogleIdToken } from '../googleAuthn.js';

import type { Command } from './Command.js';

export class VeraidAuthClient {
  public static init(): VeraidAuthClient {
    const apiUrl = envVar.get('VAUTH_API_URL').required().asString();
    return new VeraidAuthClient(apiUrl);
  }

  protected constructor(public readonly authnTokenAudience: string) {}

  public async run<CommandOutput>(command: Command<CommandOutput>): Promise<CommandOutput> {
    const token = await getGoogleIdToken(this.authnTokenAudience);
    const client = new AuthorityClient(this.authnTokenAudience, {
      scheme: 'Bearer',
      parameters: token,
    });
    return command.run(client);
  }
}
