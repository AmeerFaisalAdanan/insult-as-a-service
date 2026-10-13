import type { RoastEntry, RoastPackInput } from './types.js';

/**
 * Pack normalisation.
 *
 * Packs are plain data. This module never evaluates pack contents; it reads a
 * fixed set of fields off each entry and copies them into fresh, frozen objects.
 * Because fields are copied explicitly (never spread), prototype-polluting keys
 * such as `__proto__` or `constructor` in the input are ignored, and the
 * caller's objects are never mutated or retained.
 */

function isPlainEntryShape(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dangerous keys that must never be copied from untrusted pack data. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validate and copy a single raw entry into a safe, frozen RoastEntry.
 * Returns undefined if the entry is structurally invalid.
 */
export function normalizeEntry(raw: unknown): RoastEntry | undefined {
  if (!isPlainEntryShape(raw)) return undefined;

  const id = raw['id'];
  const errorType = raw['error_type'];
  const locale = raw['locale'];
  const severity = raw['severity'];
  const message = raw['message'];
  const tags = raw['tags'];

  if (typeof id !== 'string' || id.length === 0) return undefined;
  if (FORBIDDEN_KEYS.has(id)) return undefined;
  if (typeof errorType !== 'string' || errorType.length === 0) return undefined;
  if (typeof locale !== 'string' || locale.length === 0) return undefined;
  if (typeof severity !== 'number' || !Number.isInteger(severity)) return undefined;
  if (typeof message !== 'string' || message.trim().length === 0) return undefined;

  const entry: RoastEntry = {
    id,
    error_type: errorType,
    locale,
    severity,
    message,
  };

  if (Array.isArray(tags)) {
    const safeTags = tags.filter((t): t is string => typeof t === 'string');
    if (safeTags.length > 0) entry.tags = Object.freeze([...safeTags]) as string[];
  }

  return Object.freeze(entry);
}

/** Turn a pack input (array or wrapper) into a raw entry list without mutation. */
function extractRawEntries(pack: RoastPackInput): readonly unknown[] {
  if (Array.isArray(pack)) return pack;
  const wrapper = pack as { entries?: readonly unknown[] };
  return Array.isArray(wrapper.entries) ? wrapper.entries : [];
}

/**
 * Merge a pack into an existing id-keyed store, returning a NEW map. Later
 * entries with a duplicate id overwrite earlier ones (last wins). The input
 * store is not mutated.
 */
export function mergePack(
  store: ReadonlyMap<string, RoastEntry>,
  pack: RoastPackInput,
): Map<string, RoastEntry> {
  const next = new Map(store);
  for (const raw of extractRawEntries(pack)) {
    const entry = normalizeEntry(raw);
    if (entry) next.set(entry.id, entry);
  }
  return next;
}
