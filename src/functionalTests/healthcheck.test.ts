import { HTTP_STATUS_CODES } from '../utilities/http.js';

import { getServiceUrl } from './utils/knative.js';

const ENDPOINT = await getServiceUrl('letro-server');

describe('Healthcheck', () => {
  test('Endpoint should return 200 OK', async () => {
    const response = await fetch(ENDPOINT);

    expect(response.status).toBe(HTTP_STATUS_CODES.OK);
  });
});
