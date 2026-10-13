import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIaaS, type RoastEntry } from '../../src/index.js';
import { mergePack, normalizeEntry } from '../../src/packs.js';

describe('roast data is inert, not code', () => {
  it('never evaluates message content', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    const dangerous = [
      '${global.LEAK = 1}',
      '<script>window.x=1</script>',
      '`touch /tmp/pwned`',
      '{{constructor.constructor("return process")()}}',
    ];
    (globalThis as Record<string, unknown>)['LEAK'] = undefined;
    dangerous.forEach((message, i) => {
      iaas.use([
        { id: `d.en.${i}`, error_type: 'invalid_email', locale: 'en', severity: 3, message },
      ]);
      const out = iaas.message('x', 'invalid_email', { severity: 3 });
      expect(typeof out).toBe('string');
    });
    expect((globalThis as Record<string, unknown>)['LEAK']).toBeUndefined();
  });

  it('returns HTML-looking strings verbatim without rendering or escaping', () => {
    const iaas = createIaaS({ enabled: true, includeDefaultPack: false });
    const html = '<img src=x onerror="alert(1)"> & <b>bold</b>';
    iaas.use([
      { id: 'h.en.1', error_type: 'invalid_email', locale: 'en', severity: 3, message: html },
    ]);
    expect(iaas.message('x', 'invalid_email')).toBe(html);
  });
});

describe('prototype pollution resistance', () => {
  afterEach(() => {
    // Ensure no test polluted the global prototype.
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(([] as unknown as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('ignores a __proto__ key in pack data and does not pollute Object.prototype', () => {
    const malicious = JSON.parse(
      '{"id":"p.en.1","error_type":"invalid_email","locale":"en","severity":3,"message":"ok","__proto__":{"polluted":"yes"}}',
    );
    const entry = normalizeEntry(malicious);
    expect(entry).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(entry, 'polluted')).toBe(false);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('rejects entries whose id is a dangerous key', () => {
    expect(
      normalizeEntry({
        id: '__proto__',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3,
        message: 'x',
      }),
    ).toBeUndefined();
    expect(
      normalizeEntry({
        id: 'constructor',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3,
        message: 'x',
      }),
    ).toBeUndefined();
  });

  it('a pack containing a polluting entry loads the benign entries only', () => {
    const store = mergePack(new Map(), [
      JSON.parse(
        '{"id":"__proto__","error_type":"invalid_email","locale":"en","severity":3,"message":"bad"}',
      ),
      { id: 'good.en.1', error_type: 'invalid_email', locale: 'en', severity: 3, message: 'good' },
    ] as RoastEntry[]);
    expect(store.has('good.en.1')).toBe(true);
    expect(store.has('__proto__')).toBe(false);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('malformed structures are rejected safely', () => {
  it('rejects wrong-typed or missing fields', () => {
    expect(normalizeEntry(null)).toBeUndefined();
    expect(normalizeEntry(42)).toBeUndefined();
    expect(normalizeEntry([])).toBeUndefined();
    expect(normalizeEntry({})).toBeUndefined();
    expect(
      normalizeEntry({ id: 'a', error_type: 'invalid_email', locale: 'en', severity: 3 }),
    ).toBeUndefined();
    expect(
      normalizeEntry({
        id: 'a',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3.5,
        message: 'x',
      }),
    ).toBeUndefined();
    expect(
      normalizeEntry({
        id: 'a',
        error_type: 'invalid_email',
        locale: 'en',
        severity: 3,
        message: '   ',
      }),
    ).toBeUndefined();
  });
});

describe('no logging of inputs, errors or configuration', () => {
  it('normal operation writes nothing to the console', () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'debug').mockImplementation(() => {}),
    ];
    try {
      const iaas = createIaaS({ enabled: true });
      iaas.message('a secret value the app passed in', 'invalid_email');
      iaas.result({ password: 'hunter2' } as unknown as string, 'invalid_email');
      iaas.configure({ enabled: false });
      iaas.use([
        { id: 'z.en.1', error_type: 'invalid_email', locale: 'en', severity: 3, message: 'x' },
      ]);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
