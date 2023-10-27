import { NON_ASCII_DOMAIN_NAME } from '../domains.js';
import { ORG_NAME, USER_ID, USER_NAME } from '../../testUtils/veraid/stubs.js';

import { isValidVeraidIdForUser } from './idValidation.js';

describe('isValidVeraidIdForUser', () => {
  test('Bot ids should be refused', () => {
    expect(isValidVeraidIdForUser(ORG_NAME)).toBeFalse();
  });

  test('Malformed user name should be refused', () => {
    expect(isValidVeraidIdForUser(`${USER_NAME}\n@${ORG_NAME}`)).toBeFalse();
  });

  test('Malformed domain name should be refused', () => {
    expect(isValidVeraidIdForUser(`${USER_NAME}@example dot com`)).toBeFalse();
  });

  test('Multiple at-signs shouldn not bypass validation', () => {
    expect(isValidVeraidIdForUser(`${USER_NAME}@${ORG_NAME}@example dot com`)).toBeFalse();
  });

  test('Domain names with trailing dots should be refused', () => {
    expect(isValidVeraidIdForUser(`${USER_NAME}@${ORG_NAME}.`)).toBeFalse();
  });

  test('Well-formed user id should be allowed', () => {
    expect(isValidVeraidIdForUser(USER_ID)).toBeTrue();
  });

  test('Non-ASCII domain names should be allowed', () => {
    expect(isValidVeraidIdForUser(`${USER_NAME}@${NON_ASCII_DOMAIN_NAME}`)).toBeTrue();
  });
});
