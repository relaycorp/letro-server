import { MANAGED_DOMAIN_NAMES } from '../../sinks/accountCreation/veraidAuth/orgs.js';
import { generateRsaPssKeyPair } from '../crypto/signing.js';
import { encodePublicKeyFromDer } from '../crypto/keys.js';

const { publicKey, privateKey } = generateRsaPssKeyPair();
export const USER_NAME = 'alice';
export const MEMBER_PRIVATE_KEY = privateKey;
export const MEMBER_PUBLIC_KEY_DER = publicKey;
export const MEMBER_PUBLIC_KEY_ENCODED = encodePublicKeyFromDer(publicKey);
export const MEMBER_BUNDLE = Buffer.from('the bundle');

export const ORG_NAME = MANAGED_DOMAIN_NAMES.at(0)!;
