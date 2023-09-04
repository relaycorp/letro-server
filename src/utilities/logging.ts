import { getPinoOptions, type LoggingTarget } from '@relaycorp/pino-cloud';
import env from 'env-var';
import { type Level, type Logger, pino } from 'pino';

const APP_NAME = 'letro-server';

export function makeLogger(): Logger {
  const logTarget = env.get('LOG_TARGET').asString();
  const version = env.get('VERSION').required().asString();
  const appContext = { name: APP_NAME, version };
  const cloudPinoOptions = getPinoOptions(logTarget as LoggingTarget, appContext);

  const logLevel = env.get('LOG_LEVEL').default('info').asString().toLowerCase() as Level;
  return pino({ ...cloudPinoOptions, level: logLevel });
}
