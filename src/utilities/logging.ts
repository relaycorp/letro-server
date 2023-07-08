import { getPinoOptions, type LoggingTarget } from '@relaycorp/pino-cloud';
import env from 'env-var';
import pino, { type Level, type Logger } from 'pino';

const DEFAULT_APP_NAME = 'letro-server';

export function makeLogger(): Logger {
  const logTarget = env.get('LOG_TARGET').asString();
  const version = env.get('VERSION').required().asString();
  const logEnvironmentName = env.get('LOG_ENV_NAME').default(DEFAULT_APP_NAME).asString();
  const appContext = { name: logEnvironmentName, version };
  const cloudPinoOptions = getPinoOptions(logTarget as LoggingTarget, appContext);

  const logLevel = env.get('LOG_LEVEL').default('info').asString().toLowerCase() as Level;
  return pino({ ...cloudPinoOptions, level: logLevel });
}
