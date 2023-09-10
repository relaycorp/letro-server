import { jest } from '@jest/globals';
import envVar from 'env-var';

import { MONGODB_URI } from './db.js';
import { VAUTH_API_URL } from './veraid/authority/stubs.js';

interface EnvVarSet {
  readonly [key: string]: string | undefined;
}

export const VERSION = '1.0.0';
export const REQUIRED_ENV_VARS = {
  VERSION,
  MONGODB_URI,
  VAUTH_API_URL,
};

export type EnvVarMocker = (envVars: EnvVarSet) => void;

export function configureMockEnvVars(envVars: EnvVarSet = {}): EnvVarMocker {
  const mockEnvVarGet = jest.spyOn(envVar, 'get');
  function setEnvironmentVariables(newEnvVars: EnvVarSet): void {
    mockEnvVarGet.mockReset();
    mockEnvVarGet.mockImplementation((envVarName) => {
      const environment = envVar.from(newEnvVars);
      return environment.get(envVarName);
    });
  }

  beforeAll(() => {
    setEnvironmentVariables(envVars);
  });
  beforeEach(() => {
    setEnvironmentVariables(envVars);
  });

  afterAll(() => {
    mockEnvVarGet.mockRestore();
  });

  return (newEnvironmentVariables: EnvVarSet) => {
    setEnvironmentVariables(newEnvironmentVariables);
  };
}
