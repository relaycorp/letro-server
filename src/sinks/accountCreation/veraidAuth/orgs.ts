import domainByLocale from './domainNames.js';

type DomainByLocale = typeof domainByLocale;
export type Locale = keyof DomainByLocale;

export const FALLBACK_DOMAIN_NAME = 'nautilus.ink';

export const MANAGED_DOMAIN_NAMES: string[] = [
  FALLBACK_DOMAIN_NAME,
  ...Object.values(domainByLocale),
];

export function getDomainForLocale(locale: string): string {
  const localeNormalised = locale.toLocaleLowerCase() as Locale;
  const supportedLocaleDomain = domainByLocale[localeNormalised] as string | undefined;
  return supportedLocaleDomain ?? FALLBACK_DOMAIN_NAME;
}
