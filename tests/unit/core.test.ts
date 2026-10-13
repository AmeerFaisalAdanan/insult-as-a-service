import { describe, expect, it } from 'vitest';
import { createIaaS, roast, type RoastEntry } from '../../src/index.js';

describe('configuration defaults', () => {
  it('uses documented defaults', () => {
    const iaas = createIaaS();
    const cfg = iaas.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.severity).toBe(3);
    expect(cfg.locale).toBe('en');
    expect(cfg.allowSensitive).toBe(false);
    expect(cfg.select).toBe('deterministic');
  });

  it('clamps out-of-range severity into 1..5', () => {
    expect(createIaaS({ severity: 99 }).getConfig().severity).toBe(5);
    expect(createIaaS({ severity: -4 }).getConfig().severity).toBe(1);
    expect(createIaaS({ severity: 2.6 }).getConfig().severity).toBe(3);
  });
});

describe('global enable / disable', () => {
  it('returns the original message when disabled', () => {
    const iaas = createIaaS({ enabled: false });
    expect(iaas.message('Email is invalid', 'invalid_email')).toBe('Email is invalid');
  });

  it('returns a roast when enabled and content exists', () => {
    const iaas = createIaaS({ enabled: true, locale: 'en', severity: 3 });
    const out = iaas.message('Email is invalid', 'invalid_email');
    expect(out).not.toBe('Email is invalid');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('runtime configuration changes', () => {
  it('applies immediately to the same instance', () => {
    const iaas = createIaaS({ enabled: true });
    const roasted = iaas.message('Email is invalid', 'invalid_email');
    expect(roasted).not.toBe('Email is invalid');

    iaas.configure({ enabled: false });
    expect(iaas.message('Email is invalid', 'invalid_email')).toBe('Email is invalid');

    iaas.configure({ enabled: true });
    expect(iaas.message('Email is invalid', 'invalid_email')).toBe(roasted);
  });
});

describe('per-call overrides', () => {
  it('per-call opt-out preserves the original', () => {
    const iaas = createIaaS({ enabled: true });
    expect(iaas.message('Email is invalid', 'invalid_email', { enabled: false })).toBe(
      'Email is invalid',
    );
  });

  it('per-call opt-in enables for a single call', () => {
    const iaas = createIaaS({ enabled: false });
    const out = iaas.message('Email is invalid', 'invalid_email', { enabled: true });
    expect(out).not.toBe('Email is invalid');
  });

  it('per-call locale override selects that locale', () => {
    const iaas = createIaaS({ enabled: true, locale: 'en' });
    const r = iaas.result('x', 'invalid_email', { locale: 'ms-MY' });
    expect(r.locale).toBe('ms-MY');
    expect(r.templateId?.includes('ms-MY')).toBe(true);
  });
});

describe('severity selection', () => {
  it('selects a template at the requested severity when available', () => {
    const iaas = createIaaS({ enabled: true, locale: 'en', severity: 4 });
    const r = iaas.result('x', 'invalid_email');
    expect(r.severity).toBe(4);
  });

  it('falls back to the nearest severity when the exact one is absent', () => {
    // en invalid_url has severities 2,3,4 — requesting 5 should fall back to 4.
    const iaas = createIaaS({ enabled: true, locale: 'en', severity: 5 });
    const r = iaas.result('x', 'invalid_url');
    expect(r.roasted).toBe(true);
    expect(r.severity).toBe(4);
  });
});

describe('locale selection and fallback', () => {
  it('falls back from a regional locale to its parent language', () => {
    // 'en-ZZ' has no content; parent 'en' does.
    const iaas = createIaaS({ enabled: true, locale: 'en-ZZ' });
    const r = iaas.result('x', 'invalid_email');
    expect(r.roasted).toBe(true);
    expect(r.locale).toBe('en');
  });

  it('never crosses to an unrelated locale', () => {
    // 'fr' has no content and no supported parent -> original message.
    const iaas = createIaaS({ enabled: true, locale: 'fr' });
    const r = iaas.result('Original', 'invalid_email');
    expect(r.roasted).toBe(false);
    expect(r.message).toBe('Original');
    expect(r.fallbackReason).toBe('no_match');
  });
});

describe('error type lookup', () => {
  it('unknown error type returns the original message', () => {
    const iaas = createIaaS({ enabled: true });
    const r = iaas.result('Original message', 'definitely_not_registered');
    expect(r.roasted).toBe(false);
    expect(r.message).toBe('Original message');
    expect(r.fallbackReason).toBe('unknown_error_type');
  });

  it('known error type with no matching content returns the original', () => {
    // 'invalid_format' exists only in 'en'; request it in ms-MY with no parent content.
    const iaas = createIaaS({ enabled: true, locale: 'ms-MY' });
    const r = iaas.result('Original', 'invalid_format');
    expect(r.roasted).toBe(false);
    expect(r.fallbackReason).toBe('no_match');
  });
});

describe('deterministic selection', () => {
  it('same input yields the same roast every time', () => {
    const iaas = createIaaS({ enabled: true });
    const a = iaas.message('same seed', 'invalid_email');
    const b = iaas.message('same seed', 'invalid_email');
    expect(a).toBe(b);
  });

  it('random strategy uses the injected RNG', () => {
    const iaas = createIaaS({
      enabled: true,
      locale: 'en',
      severity: 3,
      select: 'random',
      random: () => 0,
    });
    const r = iaas.result('x', 'invalid_email');
    // With random()=0 the first (id-sorted) candidate is chosen, deterministically for the test.
    expect(r.roasted).toBe(true);
  });
});

describe('custom pack loading', () => {
  const customPack: RoastEntry[] = [
    {
      id: 'custom.en.1',
      error_type: 'invalid_email',
      locale: 'en',
      severity: 3,
      message: 'CUSTOM ROAST',
    },
  ];

  it('loads a data-only pack via use()', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    iaas.use(customPack);
    expect(iaas.message('x', 'invalid_email')).toBe('CUSTOM ROAST');
  });

  it('loads packs via config', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false, packs: [customPack] });
    expect(iaas.message('x', 'invalid_email')).toBe('CUSTOM ROAST');
  });

  it('accepts the { entries } wrapper form', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    iaas.use({ name: 'wrapped', entries: customPack });
    expect(iaas.message('x', 'invalid_email')).toBe('CUSTOM ROAST');
  });
});

describe('input validation', () => {
  it('preserves a string exactly', () => {
    const iaas = createIaaS({ enabled: false });
    const original = '  Weird   spacing\tand\nnewlines.  ';
    expect(iaas.message(original, 'invalid_email')).toBe(original);
  });

  it('coerces safe primitives', () => {
    const iaas = createIaaS({ enabled: false });
    expect(iaas.message(42, 'invalid_email')).toBe('42');
    expect(iaas.message(true, 'invalid_email')).toBe('true');
  });

  it('returns empty string for non-primitive input (no leak)', () => {
    const iaas = createIaaS({ enabled: false });
    const r = iaas.result({ secret: 'value' } as unknown as string, 'invalid_email');
    expect(r.message).toBe('');
    expect(r.fallbackReason).toBe('invalid_input');
  });
});

describe('convenience roast()', () => {
  it('returns a roast string for a known type', () => {
    expect(roast('network_error').length).toBeGreaterThan(0);
  });

  it('returns empty string for an unknown type', () => {
    expect(roast('nope_not_a_type')).toBe('');
  });

  it('is deterministic', () => {
    expect(roast('invalid_email')).toBe(roast('invalid_email'));
  });
});
