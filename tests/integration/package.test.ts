import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'dist');

beforeAll(() => {
  if (!existsSync(join(dist, 'index.js'))) {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'ignore' });
  }
});

describe('built ESM entry point', () => {
  it('imports and roasts from the built bundle', async () => {
    const mod = await import(join(dist, 'index.js'));
    expect(typeof mod.createIaaS).toBe('function');
    const iaas = mod.createIaaS({ enabled: true, locale: 'en', severity: 3 });
    expect(iaas.message('Email is invalid', 'invalid_email')).not.toBe('Email is invalid');
    expect(mod.createIaaS({ enabled: false }).message('X', 'invalid_email')).toBe('X');
  });

  it('exposes the documented public surface', async () => {
    const mod = await import(join(dist, 'index.js'));
    for (const name of [
      'createIaaS',
      'roast',
      'KNOWN_ERROR_TYPES',
      'SUPPORTED_LOCALES',
      'DEFAULT_PACK',
    ]) {
      expect(mod[name]).toBeDefined();
    }
  });
});

describe('built CJS entry point', () => {
  it('require()s and roasts from the built bundle', () => {
    const script = `const { createIaaS } = require(${JSON.stringify(join(dist, 'index.cjs'))});
const i = createIaaS({ enabled: true });
if (i.message('X', 'invalid_email') === 'X') { console.error('not roasted'); process.exit(1); }
process.stdout.write('ok');`;
    const out = execFileSync('node', ['--input-type=commonjs', '-e', script], { encoding: 'utf8' });
    expect(out).toBe('ok');
  });
});

describe('type declarations and exports', () => {
  it('ships both ESM and CJS type declarations', () => {
    expect(existsSync(join(dist, 'index.d.ts'))).toBe(true);
    expect(existsSync(join(dist, 'index.d.cts'))).toBe(true);
    const dts = readFileSync(join(dist, 'index.d.ts'), 'utf8');
    expect(dts).toContain('createIaaS');
    expect(dts).toContain('IaaSConfig');
  });

  it('package.json exports map points at real files', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const dot = pkg.exports['.'];
    for (const key of ['types', 'import', 'require']) {
      const rel = dot[key].replace(/^\.\//, '');
      expect(existsSync(join(root, rel))).toBe(true);
    }
  });
});

describe('offline guarantee', () => {
  it('the built bundle references no network or Node-only runtime APIs', () => {
    const esm = readFileSync(join(dist, 'index.js'), 'utf8');
    const cjs = readFileSync(join(dist, 'index.cjs'), 'utf8');
    for (const src of [esm, cjs]) {
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
      expect(/XMLHttpRequest/.test(src)).toBe(false);
      expect(/require\(['"]node:/.test(src)).toBe(false);
      expect(/from\s*['"]node:/.test(src)).toBe(false);
      expect(/process\.env/.test(src)).toBe(false);
    }
  });
});
