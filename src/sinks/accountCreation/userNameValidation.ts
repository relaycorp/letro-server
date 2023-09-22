import { remove as replaceAsciiLookalike } from 'confusables';
import { generateUsername } from 'unique-username-generator';

const MAX_USERNAME_LENGTH = 16;
const ILLICIT_CHARS_REGEX = /[\s@]/gu;

const RESERVED_WORDS = [
  'admin',
  'support',
  'help',
  'relaycorp',
  'awala',
  'letro',
  'vera', // Covers VeraId
  'gusnarea',
  'gustavonarea',
  'gnarea',
];

function isUserNameValid(string: string): boolean {
  const sanitisedString = replaceAsciiLookalike(string).replaceAll(/[^a-z\d]/gu, '');
  if (sanitisedString.length === 0) {
    return false;
  }
  const hasReservedWords = RESERVED_WORDS.some((word) => sanitisedString.includes(word));
  return !hasReservedWords;
}

export { RESERVED_WORDS };

export function sanitiseUserName(name: string): string {
  const sanitisedName = name
    .replaceAll(ILLICIT_CHARS_REGEX, '')
    .slice(0, MAX_USERNAME_LENGTH)
    .toLowerCase();
  if (isUserNameValid(sanitisedName)) {
    return sanitisedName;
  }

  return generateUsername('-', 0, MAX_USERNAME_LENGTH);
}
