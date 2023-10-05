import { FALLBACK_DOMAIN_NAME, getDomainForLocale } from './orgs.js';

describe('getDomainForLocale', () => {
  const esVeDomain = 'guarapo.cafe';

  test('Should return the domain name for a supported locale', () => {
    expect(getDomainForLocale('es-ve')).toBe(esVeDomain);
  });

  test('Should consider locale as case-insensitive', () => {
    expect(getDomainForLocale('ES-VE')).toBe(esVeDomain);
  });

  test('Should return the fallback domain name for an unsupported locale', () => {
    expect(getDomainForLocale('unknown')).toBe(FALLBACK_DOMAIN_NAME);
  });
});
