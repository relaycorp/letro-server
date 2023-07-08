import { makeServer } from '../server.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { REQUIRED_ENV_VARS } from './envVars.js';

export function makeLetroTestServer(): () => TestServerFixture {
  const getFixture = makeTestServer(makeServer, REQUIRED_ENV_VARS);

  beforeEach(() => {
    const { envVarMocker } = getFixture();

    envVarMocker({ ...REQUIRED_ENV_VARS });
  });

  return getFixture;
}
