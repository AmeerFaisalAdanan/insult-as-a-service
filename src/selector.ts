import type { RoastEntry, SelectionStrategy, Severity } from './types.js';

/**
 * Deterministic, dependency-free selection.
 *
 * Given a set of candidate roast entries for one error type, the selector
 * applies the documented locale -> severity fallback chain and then picks a
 * single entry. The default strategy is deterministic: the same (seed, candidate
 * set) always yields the same roast, while different seeds vary the choice.
 * Random selection is supported via an injected RNG so tests stay deterministic.
 */

export interface SelectInput {
  /** Candidate entries already filtered to a single error type. */
  candidates: readonly RoastEntry[];
  locale: string;
  severity: Severity;
  strategy: SelectionStrategy;
  random: () => number;
  /** Seed used for deterministic selection (normally the original message). */
  seed: string;
}

export interface SelectOutput {
  entry: RoastEntry;
  locale: string;
  severity: number;
}

/**
 * Build the locale fallback chain for a requested locale.
 * `en-MY` -> ['en-MY', 'en']; `en` -> ['en']; `ms-MY` -> ['ms-MY', 'ms'].
 * We never cross to an unrelated locale.
 */
export function localeChain(locale: string): string[] {
  const chain = [locale];
  const dash = locale.indexOf('-');
  if (dash > 0) {
    const parent = locale.slice(0, dash);
    if (parent && parent !== locale) chain.push(parent);
  }
  return chain;
}

/** Non-cryptographic 32-bit string hash (FNV-1a). Deterministic across runtimes. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in uint32 range.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Pick the entries at the requested severity, or — if none exist at that exact
 * severity within this locale group — the entries at the nearest available
 * severity (ties resolve to the lower severity).
 */
function entriesAtNearestSeverity(
  entries: readonly RoastEntry[],
  severity: number,
): { entries: RoastEntry[]; severity: number } | undefined {
  if (entries.length === 0) return undefined;

  const exact = entries.filter((e) => e.severity === severity);
  if (exact.length > 0) return { entries: exact, severity };

  let bestSeverity: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const e of entries) {
    const distance = Math.abs(e.severity - severity);
    if (
      distance < bestDistance ||
      (distance === bestDistance && e.severity < (bestSeverity ?? Infinity))
    ) {
      bestDistance = distance;
      bestSeverity = e.severity;
    }
  }
  if (bestSeverity === undefined) return undefined;
  return { entries: entries.filter((e) => e.severity === bestSeverity), severity: bestSeverity };
}

export function select(input: SelectInput): SelectOutput | undefined {
  const { candidates, locale, severity, strategy, random, seed } = input;
  if (candidates.length === 0) return undefined;

  for (const loc of localeChain(locale)) {
    const inLocale = candidates.filter((e) => e.locale === loc);
    const atSeverity = entriesAtNearestSeverity(inLocale, severity);
    if (!atSeverity) continue;

    // Stable ordering so selection is reproducible regardless of pack order.
    const pool = [...atSeverity.entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const index =
      strategy === 'random'
        ? Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
        : hashString(seed) % pool.length;

    const entry = pool[index];
    if (!entry) continue;
    return { entry, locale: loc, severity: atSeverity.severity };
  }

  return undefined;
}
