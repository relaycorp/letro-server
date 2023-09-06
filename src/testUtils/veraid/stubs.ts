import { MANAGED_DOMAIN_NAMES } from '../../sinks/accountCreation/orgs.js';

export const USER_NAME = 'alice';
export const ORG_NAME = MANAGED_DOMAIN_NAMES.at(0)!;
export const MEMBER_PUBLIC_KEY_DER = Buffer.from('public key');
