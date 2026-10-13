import { describe, expect, it } from 'vitest';
import { DEFAULT_PACK } from '../../src/index.js';

/**
 * Guards the content-coverage commitments from the remediation pass:
 *  - ms-MY now covers the nine previously-missing error types.
 *  - Severity 1 and 5 contain real entries for the listed validation types.
 */

function count(predicate: (e: (typeof DEFAULT_PACK)[number]) => boolean): number {
  return DEFAULT_PACK.filter(predicate).length;
}

describe('ms-MY coverage for the nine previously-missing types', () => {
  const required = [
    'build_failed',
    'invalid_format',
    'invalid_input',
    'invalid_phone',
    'merge_conflict',
    'missing_config',
    'out_of_range',
    'syntax_error',
    'type_error',
  ];
  for (const type of required) {
    it(`ms-MY has >= 3 entries for ${type}`, () => {
      expect(count((e) => e.locale === 'ms-MY' && e.error_type === type)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('severity 1 and 5 contain real content', () => {
  it('has severity 1 entries', () => {
    expect(count((e) => e.severity === 1)).toBeGreaterThan(0);
  });
  it('has severity 5 entries', () => {
    expect(count((e) => e.severity === 5)).toBeGreaterThan(0);
  });

  const types = [
    'required_field',
    'invalid_email',
    'invalid_format',
    'invalid_input',
    'password_too_short',
    'invalid_number',
  ];
  for (const type of types) {
    it(`en/${type} has >= 2 severity-1 and >= 2 severity-5 entries`, () => {
      expect(
        count((e) => e.locale === 'en' && e.error_type === type && e.severity === 1),
      ).toBeGreaterThanOrEqual(2);
      expect(
        count((e) => e.locale === 'en' && e.error_type === type && e.severity === 5),
      ).toBeGreaterThanOrEqual(2);
    });
  }
});
