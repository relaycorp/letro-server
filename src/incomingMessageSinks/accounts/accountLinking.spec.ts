import { makeMockLogging } from '../../testUtils/logging.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';

import accountLinking from './accountLinking.js';

describe('accountLinking handler', () => {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();

  test('should be tested', async () => {
    await expect(
      accountLinking.handler(
        {
          senderId: 'sender',
          recipientId: 'recipient',
          contentType: accountLinking.contentType,
          content: Buffer.from(JSON.stringify({ domainName: 'example.com' })),
        },
        { logger: mockLogger.logger, emitter },
      ),
    ).resolves.toBe(true);
  });
});
