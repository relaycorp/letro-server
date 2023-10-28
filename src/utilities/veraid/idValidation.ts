import { validateUserName } from '@relaycorp/veraid';
import isValidDomain from 'is-valid-domain';

const USER_ID_REGEX = /^(?<userName>[^@]+)@(?<domainName>.+[^\\.])$/u;

/**
 * Report whether the `veraidId` is well-formed and corresponds to a user.
 */
export function isValidVeraidIdForUser(veraidId: string): boolean {
  const match = USER_ID_REGEX.exec(veraidId);
  if (!match) {
    return false;
  }

  try {
    validateUserName(match.groups!.userName);
  } catch {
    return false;
  }

  return isValidDomain(match.groups!.domainName, { allowUnicode: true });
}
