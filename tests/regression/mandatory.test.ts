import { describe, expect, it } from 'vitest';
import { createIaaS, type RoastEntry } from '../../src/index.js';

/**
 * The ten mandatory regression guarantees from the V1 specification (§13).
 * These protect the product principle: your application owns the error;
 * IaaS only changes how it is presented.
 */

describe('regression #1: disabled mode returns the original byte-for-byte', () => {
  it('preserves every character, including punctuation and whitespace', () => {
    const iaas = createIaaS({ enabled: false });
    const samples = [
      'Email is invalid',
      '  leading and trailing  ',
      'tabs\tand\nnewlines',
      'unicode: café — 日本語 — 💀',
      'quotes "double" and \'single\' and `back`',
      '',
    ];
    for (const s of samples) {
      const out = iaas.message(s, 'invalid_email');
      expect(out).toBe(s);
      expect(out.length).toBe(s.length);
    }
  });
});

describe('regression #2: unknown error types preserve the original message', () => {
  it('returns the original for an unregistered type even when enabled', () => {
    const iaas = createIaaS({ enabled: true });
    expect(iaas.message('Original', 'not_a_registered_type')).toBe('Original');
  });
});

describe('regression #3: missing roast templates preserve the original message', () => {
  it('returns the original when a known type has no matching content', () => {
    const iaas = createIaaS({ enabled: true, locale: 'en', includeDefaultPack: false });
    // Known type, but no packs loaded -> no content.
    expect(iaas.message('Original', 'invalid_email')).toBe('Original');
  });
});

describe('regression #4: per-call opt-out wins over global enablement', () => {
  it('a single opt-out call returns the original', () => {
    const iaas = createIaaS({ enabled: true });
    expect(iaas.message('Original', 'invalid_email', { enabled: false })).toBe('Original');
    // ... and the next call without opt-out still roasts.
    expect(iaas.message('Original', 'invalid_email')).not.toBe('Original');
  });
});

describe('regression #5: safety restrictions cannot be bypassed by per-call override', () => {
  it('a sensitive error type is never roasted via per-call opt-in', () => {
    const iaas = createIaaS({ enabled: true });
    const pack: RoastEntry[] = [
      {
        id: 'pay.en.1',
        error_type: 'payment_declined',
        locale: 'en',
        severity: 3,
        message: 'ROAST',
      },
    ];
    iaas.use(pack);
    const r = iaas.result('Card declined', 'payment_declined', { enabled: true });
    expect(r.roasted).toBe(false);
    expect(r.message).toBe('Card declined');
    expect(r.fallbackReason).toBe('sensitive_error_type');
  });

  it('sensitive types are only roastable with instance allowSensitive', () => {
    const iaas = createIaaS({ enabled: true, allowSensitive: true });
    iaas.use([
      {
        id: 'pay.en.2',
        error_type: 'payment_declined',
        locale: 'en',
        severity: 3,
        message: 'ROAST',
      },
    ]);
    expect(iaas.message('Card declined', 'payment_declined')).toBe('ROAST');
  });
});

describe('regression #6: custom packs cannot execute code', () => {
  it('a message that looks like code is treated as inert text', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    const payload = '${process.exit(1)} <script>alert(1)</script> `rm -rf /`';
    iaas.use([
      { id: 'x.en.1', error_type: 'invalid_email', locale: 'en', severity: 3, message: payload },
    ]);
    expect(iaas.message('x', 'invalid_email')).toBe(payload);
  });
});

describe('regression #7: repeated calls do not mutate config or pack objects', () => {
  it('the caller pack object is never mutated', () => {
    const pack: RoastEntry[] = [
      {
        id: 'y.en.1',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3,
        message: 'ROAST',
        tags: ['t'],
      },
    ];
    const snapshot = JSON.stringify(pack);
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false, packs: [pack] });
    for (let i = 0; i < 50; i++) iaas.message('x', 'invalid_email');
    expect(JSON.stringify(pack)).toBe(snapshot);
  });

  it('the config object passed in is never mutated', () => {
    const cfg = { enabled: true, severity: 3, locale: 'en' };
    const snapshot = JSON.stringify(cfg);
    const iaas = createIaaS(cfg);
    for (let i = 0; i < 50; i++) iaas.message('x', 'invalid_email');
    iaas.configure({ severity: 5 });
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });
});

describe('regression #8: unsupported locale behaviour is deterministic', () => {
  it('an unsupported locale with no supported parent always falls back the same way', () => {
    const iaas = createIaaS({ enabled: true, locale: 'xx-YY' });
    const first = iaas.result('Original', 'invalid_email');
    for (let i = 0; i < 20; i++) {
      const r = iaas.result('Original', 'invalid_email');
      expect(r.message).toBe(first.message);
      expect(r.fallbackReason).toBe(first.fallbackReason);
    }
    expect(first.message).toBe('Original');
  });
});

describe('regression #9: malformed content does not crash valid pack loading', () => {
  it('invalid entries are skipped and valid ones still load', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    const mixed = [
      null,
      42,
      { id: 'ok.en.1', error_type: 'invalid_email', locale: 'en', severity: 3, message: 'VALID' },
      { id: '', error_type: 'invalid_email', locale: 'en', severity: 3, message: 'empty id' },
      {
        id: 'bad.severity',
        error_type: 'invalid_email',
        locale: 'en',
        severity: NaN,
        message: 'bad severity',
      },
      {
        id: 'empty.message',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3,
        message: '   ',
      },
    ] as unknown as RoastEntry[];
    expect(() => iaas.use(mixed)).not.toThrow();
    expect(iaas.message('x', 'invalid_email')).toBe('VALID');
  });
});

describe('regression #10: core works in a Node environment', () => {
  it('produces a roast synchronously as a string', () => {
    const iaas = createIaaS({ enabled: true });
    const out = iaas.message('x', 'invalid_email');
    expect(typeof out).toBe('string');
  });
});
