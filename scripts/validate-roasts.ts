/**
 * Roast-pack validation CLI.
 *
 *   npm run validate:roasts            # validate packs/ (default)
 *   npm run validate:roasts -- path…   # validate specific files or directories
 *
 * Validation is intentionally dependency-free: the schema is small and fixed,
 * so a bespoke validator keeps the toolchain minimal and fully under our
 * control. The JSON Schema in schema/roast.schema.json documents the same rules
 * for editors and external tooling.
 *
 * Exits non-zero if any error is found. Warnings do not fail the run.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { KNOWN_ERROR_TYPES, SENSITIVE_ERROR_TYPES } from '../src/errors.js';
import { SUPPORTED_LOCALES } from '../src/config.js';

// Documented limits (see CONTRIBUTING.md).
const LIMITS = {
  maxFileBytes: 256 * 1024,
  maxEntriesPerFile: 2000,
  idMaxLength: 128,
  errorTypeMaxLength: 64,
  messageMaxLength: 280,
  tagsMaxItems: 12,
  tagMaxLength: 32,
};

const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const ERROR_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
const TAG_PATTERN = /^[a-z0-9-]+$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const ALLOWED_FIELDS = new Set(['id', 'error_type', 'locale', 'severity', 'message', 'tags']);

const VALID_ERROR_TYPES = new Set<string>([...KNOWN_ERROR_TYPES, ...SENSITIVE_ERROR_TYPES]);
const VALID_LOCALES = new Set<string>(SUPPORTED_LOCALES);

interface Issue {
  file: string;
  where: string;
  message: string;
}

const errors: Issue[] = [];
const warnings: Issue[] = [];
const seenIds = new Map<string, string>(); // id -> file
const seenMessages = new Map<string, string>(); // `${locale}|${error_type}|${normalizedMessage}` -> file
const counts = new Map<string, number>(); // `${locale}|${error_type}` -> count

function addError(file: string, where: string, message: string): void {
  errors.push({ file, where, message });
}
function addWarning(file: string, where: string, message: string): void {
  warnings.push({ file, where, message });
}

function collectJsonFiles(target: string): string[] {
  const st = statSync(target);
  if (st.isFile()) return target.endsWith('.json') ? [target] : [];
  const out: string[] = [];
  for (const name of readdirSync(target, { recursive: true }) as string[]) {
    if (typeof name === 'string' && name.endsWith('.json')) out.push(join(target, name));
  }
  return out;
}

function validateEntry(file: string, index: number, entry: unknown): void {
  const where = `entry[${index}]`;
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    addError(file, where, 'entry must be a JSON object');
    return;
  }
  const obj = entry as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_FIELDS.has(key)) addError(file, where, `unexpected field "${key}"`);
  }

  // id
  const id = obj['id'];
  if (typeof id !== 'string' || id.length === 0) {
    addError(file, where, 'missing or empty "id"');
  } else if (id.length > LIMITS.idMaxLength) {
    addError(file, where, `"id" exceeds ${LIMITS.idMaxLength} chars`);
  } else if (!ID_PATTERN.test(id)) {
    addError(file, where, `"id" has invalid characters: ${JSON.stringify(id)}`);
  } else {
    const prior = seenIds.get(id);
    if (prior) addError(file, `${where} id="${id}"`, `duplicate id (also in ${prior})`);
    else seenIds.set(id, file);
  }

  // error_type
  const errorType = obj['error_type'];
  if (typeof errorType !== 'string' || errorType.length === 0) {
    addError(file, where, 'missing or empty "error_type"');
  } else if (errorType.length > LIMITS.errorTypeMaxLength) {
    addError(file, where, `"error_type" exceeds ${LIMITS.errorTypeMaxLength} chars`);
  } else if (!ERROR_TYPE_PATTERN.test(errorType)) {
    addError(file, where, `"error_type" malformed: ${JSON.stringify(errorType)}`);
  } else if (!VALID_ERROR_TYPES.has(errorType)) {
    addError(file, where, `unknown error_type "${errorType}" (not in the registry)`);
  }

  // locale
  const locale = obj['locale'];
  if (typeof locale !== 'string' || locale.length === 0) {
    addError(file, where, 'missing or empty "locale"');
  } else if (!LOCALE_PATTERN.test(locale)) {
    addError(file, where, `"locale" malformed: ${JSON.stringify(locale)}`);
  } else if (!VALID_LOCALES.has(locale)) {
    addError(
      file,
      where,
      `unsupported locale "${locale}" (supported: ${[...VALID_LOCALES].join(', ')})`,
    );
  }

  // severity
  const severity = obj['severity'];
  if (typeof severity !== 'number' || !Number.isInteger(severity)) {
    addError(file, where, 'missing or non-integer "severity"');
  } else if (severity < 1 || severity > 5) {
    addError(file, where, `"severity" ${severity} out of range 1..5`);
  }

  // message
  const message = obj['message'];
  if (typeof message !== 'string' || message.length === 0) {
    addError(file, where, 'missing or empty "message"');
  } else if (message.trim().length === 0) {
    addError(file, where, '"message" is whitespace-only');
  } else if (message.length > LIMITS.messageMaxLength) {
    addError(file, where, `"message" exceeds ${LIMITS.messageMaxLength} chars`);
  } else if (LONE_SURROGATE.test(message)) {
    addError(file, where, '"message" contains invalid Unicode (lone surrogate)');
  } else if (typeof errorType === 'string' && typeof locale === 'string') {
    const key = `${locale}|${errorType}|${message.trim().toLowerCase()}`;
    const prior = seenMessages.get(key);
    if (prior)
      addWarning(file, where, `duplicate message for ${locale}/${errorType} (also in ${prior})`);
    else seenMessages.set(key, file);
    const ckey = `${locale}|${errorType}`;
    counts.set(ckey, (counts.get(ckey) ?? 0) + 1);
  }

  // tags
  const tags = obj['tags'];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      addError(file, where, '"tags" must be an array');
    } else {
      if (tags.length > LIMITS.tagsMaxItems)
        addError(file, where, `"tags" exceeds ${LIMITS.tagsMaxItems} items`);
      for (const tag of tags) {
        if (
          typeof tag !== 'string' ||
          tag.length === 0 ||
          tag.length > LIMITS.tagMaxLength ||
          !TAG_PATTERN.test(tag)
        ) {
          addError(file, where, `invalid tag ${JSON.stringify(tag)}`);
        }
      }
    }
  }
}

function validateFile(file: string): void {
  const rel = relative(process.cwd(), file);
  const st = statSync(file);
  if (st.size > LIMITS.maxFileBytes) {
    addError(rel, 'file', `file is ${st.size} bytes, exceeds limit of ${LIMITS.maxFileBytes}`);
    return;
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    addError(rel, 'file', `could not read file: ${(err as Error).message}`);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    addError(rel, 'file', `malformed JSON: ${(err as Error).message}`);
    return;
  }

  if (!Array.isArray(parsed)) {
    addError(rel, 'file', 'pack root must be a JSON array of entries');
    return;
  }
  if (parsed.length > LIMITS.maxEntriesPerFile) {
    addError(rel, 'file', `${parsed.length} entries exceeds limit of ${LIMITS.maxEntriesPerFile}`);
    return;
  }

  parsed.forEach((entry, i) => validateEntry(rel, i, entry));
}

function main(): void {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ['packs'];

  const files: string[] = [];
  for (const target of targets) {
    try {
      files.push(...collectJsonFiles(target));
    } catch (err) {
      addError(target, 'path', `cannot access: ${(err as Error).message}`);
    }
  }

  for (const file of files.sort()) validateFile(file);

  // Report
  console.log(
    `Validated ${files.length} pack file(s), ${seenIds.size} unique entr${seenIds.size === 1 ? 'y' : 'ies'}.`,
  );

  if (counts.size > 0) {
    console.log('\nContent counts (locale / error_type):');
    const rows = [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [key, n] of rows) {
      const [locale, errorType] = key.split('|');
      console.log(`  ${locale!.padEnd(6)} ${errorType!.padEnd(22)} ${n}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  [warn] ${w.file} ${w.where}: ${w.message}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  [error] ${e.file} ${e.where}: ${e.message}`);
    console.error('\nValidation FAILED.');
    process.exit(1);
  }

  console.log('\nValidation PASSED.');
}

main();
