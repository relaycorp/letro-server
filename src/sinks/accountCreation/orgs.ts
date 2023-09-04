export const MANAGED_DOMAIN_NAMES = ['nautilus.ink'] as const;

export type ManagedDomainName = (typeof MANAGED_DOMAIN_NAMES)[number];

export const ORG_ENDPOINT_BY_DOMAIN: { [key in ManagedDomainName]: string } = Object.fromEntries(
  MANAGED_DOMAIN_NAMES.map((domain) => [domain, `/orgs/${domain}`]),
) as { [key in ManagedDomainName]: string };
