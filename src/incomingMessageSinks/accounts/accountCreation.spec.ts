import { makeMockLogging } from '../../testUtils/logging.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';

import accountCreation from './accountCreation.js';

describe('accountCreation handler', () => {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();

  test('should be tested', async () => {
    await expect(
      accountCreation.handler(
        {
          senderId: 'sender',
          recipientId: 'recipient',
          contentType: accountCreation.contentType,
          content: Buffer.from(''),
        },
        { logger: mockLogger.logger, emitter },
      ),
    ).resolves.toBe(true);
  });
});
