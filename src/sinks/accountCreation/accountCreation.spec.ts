import { makeMockLogging } from '../../testUtils/logging.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';
import { setUpTestDbConnection } from '../../testUtils/db.js';

import accountCreation from './accountCreation.js';

describe('accountCreation handler', () => {
  const mockLogger = makeMockLogging();
  const emitter = mockEmitter();
  const getDbConnection = setUpTestDbConnection();

  test('should be tested', async () => {
    await expect(
      accountCreation.handler(
        {
          parcelId: 'parcel id',
          senderId: 'sender',
          recipientId: 'recipient',
          contentType: accountCreation.contentType,
          content: Buffer.from(''),
        },
        { logger: mockLogger.logger, emitter, dbConnection: getDbConnection() },
      ),
    ).resolves.toBe(true);
  });
});
