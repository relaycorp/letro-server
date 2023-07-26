import { makeMockLogging } from '../../testUtils/logging.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';
import { setUpTestDbConnection } from '../../testUtils/db.js';

import accountLinking from './accountLinking.js';

describe('accountLinking handler', () => {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();
  const getDbConnection = setUpTestDbConnection();

  test('should be tested', async () => {
    await expect(
      accountLinking.handler(
        {
          parcelId: 'parcel id',
          senderId: 'sender',
          recipientId: 'recipient',
          contentType: accountLinking.contentType,
          content: Buffer.from(JSON.stringify({ domainName: 'example.com' })),
        },
        { logger: mockLogger.logger, emitter, dbConnection: getDbConnection() },
      ),
    ).resolves.toBe(true);
  });
});
