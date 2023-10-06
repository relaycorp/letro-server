import { sanitiseUserName, RESERVED_WORDS } from './userNameValidation.js';

const GENERATED_NAME_REGEX = /^[\w-]{1,16}$/u;

describe('sanitiseUserName', () => {
  test('Name should have at least one character', () => {
    expect(sanitiseUserName('')).toMatch(GENERATED_NAME_REGEX);
    expect(sanitiseUserName('a')).toBe('a');
  });

  test('ASCII characters should be allowed', () => {
    const name = 'alice';
    expect(sanitiseUserName(name)).toBe(name);
  });

  test('Non-ASCII characters should be allowed', () => {
    const name = 'こんにちは';
    expect(sanitiseUserName(name)).toBe(name);
  });

  test('Name should be lowercased', () => {
    expect(sanitiseUserName('ALICE')).toBe('alice');
    expect(sanitiseUserName('Alice')).toBe('alice');
    expect(sanitiseUserName('MAÑANA')).toBe('mañana');
  });

  test('Non-printable characters should be refused', () => {
    // eslint-disable-next-line unicorn/no-hex-escape
    expect(sanitiseUserName('\x00')).toMatch(GENERATED_NAME_REGEX);
    // eslint-disable-next-line unicorn/no-hex-escape
    expect(sanitiseUserName('\x00\x00')).toMatch(GENERATED_NAME_REGEX);
  });

  test.each(['hey-👋', '🇦🇶-cold', '😍🇮🇸'])(
    'Emojis-containing names like "%s" should be valid',
    (name) => {
      expect(sanitiseUserName(name)).toBe(name);
    },
  );

  test.each([
    // eslint-disable-next-line unicorn/text-encoding-identifier-case
    ['ASCII', 'a'],
    ['non-ASCII', '你'],
    ['emoji', '🍕'],
    ['emoji sequence', '🇬🇧'],
    ['arabic numeral', '2'],
    ['non-arabic numeral', '二'],
  ])('Single %s character should be allowed', (_type, name) => {
    expect(sanitiseUserName(name)).toBe(name);
  });

  describe('Reserved terms', () => {
    test('Partial match on reserved word should be allowed', () => {
      const name = 'relay';
      expect(sanitiseUserName(name)).toBe(name);
    });

    test.each(RESERVED_WORDS)('Name containing "%s" should be invalid', (word) => {
      expect(sanitiseUserName(word)).toMatch(GENERATED_NAME_REGEX);
      expect(sanitiseUserName(word.toUpperCase())).toMatch(GENERATED_NAME_REGEX);
    });

    test('Name containing obfuscated reserved words should be invalid', () => {
      expect(sanitiseUserName('gus.narea')).toMatch(GENERATED_NAME_REGEX);
      expect(sanitiseUserName('gus narea')).toMatch(GENERATED_NAME_REGEX);
      expect(sanitiseUserName('gus_narea')).toMatch(GENERATED_NAME_REGEX);
    });

    test('Name containing lookalike reserved words should be invalid', () => {
      expect(sanitiseUserName('gusnaréa')).toMatch(GENERATED_NAME_REGEX);
    });
  });

  describe('Illicit characters', () => {
    test('Leading whitespace should be removed', () => {
      expect(sanitiseUserName(' alice')).toBe('alice');
      expect(sanitiseUserName('\talice')).toBe('alice');
      expect(sanitiseUserName('\nalice')).toBe('alice');
      expect(sanitiseUserName('\ralice')).toBe('alice');
      expect(sanitiseUserName('\r\nalice')).toBe('alice');
      expect(sanitiseUserName(' \r\nalice')).toBe('alice');
    });

    test('Trailing whitespace should be removed', () => {
      expect(sanitiseUserName('alice ')).toBe('alice');
      expect(sanitiseUserName('alice\t')).toBe('alice');
      expect(sanitiseUserName('alice\n')).toBe('alice');
      expect(sanitiseUserName('alice\r')).toBe('alice');
      expect(sanitiseUserName('alice \r\n')).toBe('alice');
    });

    test('Whitespace in the middle should be removed', () => {
      expect(sanitiseUserName('ali ce')).toBe('alice');
      expect(sanitiseUserName('ali\tce')).toBe('alice');
      expect(sanitiseUserName('ali\nce')).toBe('alice');
      expect(sanitiseUserName('ali\rce')).toBe('alice');
      expect(sanitiseUserName('ali \r\nce')).toBe('alice');
    });

    test('At signs should be removed', () => {
      expect(sanitiseUserName('ali@ce')).toBe('alice');
    });
  });

  test('Strings longer than 16 characters should be truncated', () => {
    const validString = 'a'.repeat(16);
    expect(sanitiseUserName(validString)).toBe(validString);

    expect(sanitiseUserName(`${validString}b`)).toBe(validString);
    expect(sanitiseUserName(` ${validString} `)).toBe(validString); // Whitespace
  });
});
