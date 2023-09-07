import type { Connection } from 'mongoose';
import type { BaseLogger } from 'pino';

import type { Emitter } from '../utilities/eventing/Emitter.js';
import type { IncomingServiceMessage } from '../utilities/awalaEndpoint.js';
import type { VeraidAuthClientMaker } from '../utilities/VeraidAuthClientMaker.js';

interface MessageSinkHandlerContext {
  readonly logger: BaseLogger;
  readonly emitter: Emitter<unknown>;
  readonly dbConnection: Connection;
  readonly veraidAuthClientMaker: VeraidAuthClientMaker;
}

export type MessageSinkHandler = (
  message: IncomingServiceMessage,
  context: MessageSinkHandlerContext,
) => Promise<boolean>;

export interface MessageSink {
  readonly contentType: string;
  readonly handler: MessageSinkHandler;
}
