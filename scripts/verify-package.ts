/**
 * Package-content verification.
 *
 *   npm run verify:package
 *
 * Runs `npm pack --dry-run --json` and checks that the tarball contains ONLY
 * approved files and all required artifacts. Fails (non-zero exit) if anything
 * unexpected would be published (e.g. source, tests, env files) or if a
 * required build output is missing. Run `npm run build` first.
 */
import { execFileSync } from 'node:child_process';

// Every published path must match one of these (anchored) patterns.
const ALLOWED: RegExp[] = [
  /^package\.json$/,
  /^README\.md$/i,
  /^LICENSE$/i,
  /^SECURITY\.md$/i,
  /^schema\/roast\.schema\.json$/,
  /^dist\/.+/,
];

// These must be present.
const REQUIRED = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.d.ts',
];

// Patterns that must NEVER appear, even if some future `files` change is wrong.
const FORBIDDEN: RegExp[] = [
  /^src\//,
  /^tests?\//,
  /(^|\/)\.env/,
  /\.test\.(t|j)s$/,
  /(^|\/)node_modules\//,
];

interface PackFile {
  path: string;
}
interface PackResult {
  files: PackFile[];
  size?: number;
  unpackedSize?: number;
}

function main(): void {
  // --ignore-scripts keeps the prepack build logs out of the --json stdout.
  // The build must already exist (run `npm run build` first).
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
  });
  const parsed = JSON.parse(raw) as PackResult[];
  const result = parsed[0];
  if (!result || !Array.isArray(result.files)) {
    console.error('Could not read npm pack output.');
    process.exit(1);
  }

  const paths = result.files.map((f) => f.path).sort();
  const problems: string[] = [];

  for (const p of paths) {
    if (FORBIDDEN.some((re) => re.test(p))) {
      problems.push(`FORBIDDEN file would be published: ${p}`);
      continue;
    }
    if (!ALLOWED.some((re) => re.test(p))) {
      problems.push(`unexpected file (not on allowlist): ${p}`);
    }
  }

  for (const req of REQUIRED) {
    if (!paths.includes(req)) problems.push(`required file missing from package: ${req}`);
  }

  console.log(`Package contains ${paths.length} file(s):`);
  for (const p of paths) console.log(`  ${p}`);
  if (typeof result.unpackedSize === 'number') {
    console.log(`\nUnpacked size: ${(result.unpackedSize / 1024).toFixed(1)} KB`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  [error] ${p}`);
    console.error('\nPackage verification FAILED.');
    process.exit(1);
  }

  console.log('\nPackage verification PASSED.');
}

main();
