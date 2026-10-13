import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'scripts', 'validate-roasts.ts');

function runValidator(target: string): { code: number; out: string } {
  try {
    const out = execFileSync('npx', ['tsx', script, target], { cwd: root, encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('validate:roasts CLI', () => {
  it('passes on the bundled default packs', () => {
    const { code, out } = runValidator('packs');
    expect(code).toBe(0);
    expect(out).toContain('Validation PASSED');
  });

  it('passes on a valid fixture pack', () => {
    const { code } = runValidator('tests/fixtures/valid/custom-pack.json');
    expect(code).toBe(0);
  });

  it('fails on malformed JSON', () => {
    const { code, out } = runValidator('tests/fixtures/invalid/malformed.json');
    expect(code).toBe(1);
    expect(out).toContain('malformed JSON');
  });

  it('reports every category of problem in a bad pack', () => {
    const { code, out } = runValidator('tests/fixtures/invalid/bad-entries.json');
    expect(code).toBe(1);
    expect(out).toContain('duplicate id');
    expect(out).toContain('unknown error_type');
    expect(out).toContain('unsupported locale');
    expect(out).toContain('out of range');
    expect(out).toContain('whitespace-only');
    expect(out).toContain('unexpected field');
  });
});
