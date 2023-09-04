import { AuthorityClient, type Command } from '@relaycorp/veraid-authority';

import { VAUTH_API_URL, VAUTH_TOKEN } from './stubs.js';

type CommandType<Input, Output> = new (input: Input) => Command<Input, Output, any>;

export interface ExpectedOutcome<Output> {
  commandType: CommandType<any, Output>;
  output: Error | Output;
}

export class MockAuthorityClient extends AuthorityClient {
  protected sentCommands: Command<unknown, unknown, any>[] = [];

  public constructor(protected outcomes: ExpectedOutcome<unknown>[]) {
    super(VAUTH_API_URL, { scheme: 'Bearer', parameters: VAUTH_TOKEN });
  }

  public getSentCommandInput<Input>(
    index: number,
    expectedCommandType: CommandType<Input, any>,
  ): Input {
    const sentCommand = this.sentCommands[index] as Command<unknown, any, any> | undefined;
    if (sentCommand === undefined) {
      throw new Error(`No such command at index ${index}`);
    }
    if (!(sentCommand instanceof expectedCommandType)) {
      throw new TypeError('Unexpected command type');
    }
    const command = sentCommand as Command<Input, unknown, any>;
    return command.input;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async send<Output>(command: Command<any, Output, any>): Promise<Output> {
    const nextOutput = this.outcomes.shift();
    if (!nextOutput) {
      throw new Error('Unexpected command');
    }

    const { commandType, output } = nextOutput;

    if (!(command instanceof commandType)) {
      throw new TypeError('Unexpected command type');
    }

    this.sentCommands.push(command);

    if (output instanceof Error) {
      throw output;
    }
    return output as Output;
  }
}
