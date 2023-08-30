import type { AuthorityClient } from '@relaycorp/veraid-authority';

export abstract class Command<CommandOutput> {
  public abstract run(client: AuthorityClient): Promise<CommandOutput>;
}
