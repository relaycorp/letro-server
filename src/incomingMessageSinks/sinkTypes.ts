import type { CloudEventV1 } from 'cloudevents';
import type { BaseLogger } from 'pino';

import type { Emitter } from '../utilities/eventing/Emitter.js';

interface MessageSinkHandlerContext {
  readonly logger: BaseLogger;
  readonly emitter: Emitter<unknown>;
}

export type MessageSinkHandler = (
  event: CloudEventV1<unknown>,
  context: MessageSinkHandlerContext,
) => Promise<boolean>;

export interface MessageSink {
  readonly contentType: string;
  readonly handler: MessageSinkHandler;
}
