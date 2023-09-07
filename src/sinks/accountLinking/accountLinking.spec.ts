import { makeSinkTestRunner } from '../../testUtils/messageSinks.js';

import accountLinking from './accountLinking.js';

describe('accountLinking handler', () => {
  const { runner } = makeSinkTestRunner(accountLinking);

  test('should be tested', async () => {
    const content = Buffer.from(JSON.stringify({ domainName: 'example.com' }));
    await expect(runner(content)).resolves.toBe(true);
  });
});
