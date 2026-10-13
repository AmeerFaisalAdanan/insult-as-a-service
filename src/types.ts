/**
 * Public type definitions for insult-as-a-service.
 *
 * The engine is intentionally small: an instance holds immutable configuration
 * plus an immutable set of data-only roast entries, and maps an
 * (original message, error type) pair to either a roast or the untouched
 * original message.
 */

/** Humour intensity. 1 = gentle nudge ... 5 = maximum playful roast. */
export type Severity = 1 | 2 | 3 | 4 | 5;

/** Locales shipped with the default content pack. */
export type SupportedLocale = 'en' | 'en-MY' | 'ms-MY';

/**
 * A single roast template. This is plain data — never executable code.
 * Mirrors the on-disk JSON schema (see `schema/roast.schema.json`).
 */
export interface RoastEntry {
  /** Unique, stable content identifier (e.g. `email_004`). */
  id: string;
  /** Registered error category this roast applies to. */
  error_type: string;
  /** Locale identifier (e.g. `en-MY`). */
  locale: string;
  /** Integer humour intensity, 1 through 5. */
  severity: number;
  /** Non-empty plain-text roast message. Never interpolated with user input. */
  message: string;
  /** Optional controlled metadata. */
  tags?: string[];
}

/** A data-only roast pack: either a bare array or a named wrapper. */
export type RoastPackInput =
  readonly RoastEntry[] | { name?: string; entries: readonly RoastEntry[] };

/** Deterministic selection picks the same roast for the same input; random rotates. */
export type SelectionStrategy = 'deterministic' | 'random';

/**
 * Instance / runtime configuration.
 *
 * `enabled`, `severity` and `locale` are the documented core options. The
 * remaining fields are documented extensions:
 *  - `allowSensitive` is the ONLY way to roast safety-protected error types,
 *    and it is deliberately instance-level, never per-call, so a routine call
 *    cannot bypass the safety policy.
 *  - `select` / `random` control selection determinism and are injectable so
 *    tests stay deterministic.
 *  - `packs` / `includeDefaultPack` control which content is loaded.
 */
export interface IaaSConfig {
  /** Master switch. When false, every call returns the original message. Default: true. */
  enabled?: boolean;
  /** Preferred humour intensity, 1..5. Values outside the range are clamped. Default: 3. */
  severity?: number;
  /** Preferred locale. Unsupported locales simply fall back to the original message. Default: 'en'. */
  locale?: string;
  /** Allow roasting of safety-protected (sensitive) error types. Default: false. */
  allowSensitive?: boolean;
  /** Selection strategy. Default: 'deterministic'. */
  select?: SelectionStrategy;
  /** Injectable RNG used only when `select` is 'random'. Default: Math.random. */
  random?: () => number;
  /** Additional data-only packs merged over the defaults. */
  packs?: readonly RoastPackInput[];
  /** Include the bundled default pack. Default: true. */
  includeDefaultPack?: boolean;
}

/** Per-call overrides. Note: `allowSensitive` is intentionally absent here. */
export interface MessageOptions {
  enabled?: boolean;
  severity?: number;
  locale?: string;
}

/** Why a call returned the original message instead of a roast. */
export type FallbackReason =
  'disabled' | 'invalid_input' | 'unknown_error_type' | 'sensitive_error_type' | 'no_match';

/** Structured result for debugging / analytics integrations. No data is collected automatically. */
export interface RoastResult {
  /** The string the caller should display. */
  message: string;
  /** True only when a roast template replaced the original message. */
  roasted: boolean;
  /** The normalized original message (see input contract). */
  original: string;
  /** The error type that was looked up. */
  errorType: string;
  /** The effective locale for this call. */
  locale: string;
  /** The effective severity for this call. */
  severity: number;
  /** The id of the selected template, when a roast was produced. */
  templateId?: string;
  /** Present only when `roasted` is false. */
  fallbackReason?: FallbackReason;
}

/** A configured IaaS instance. */
export interface IaaS {
  /** Return a roast for (original, errorType), or the original message on any fallback. */
  message(original: unknown, errorType: string, options?: MessageOptions): string;
  /** Like `message`, but returns the full structured result. */
  result(original: unknown, errorType: string, options?: MessageOptions): RoastResult;
  /** Apply a partial configuration change to this instance, effective immediately. */
  configure(partial: IaaSConfig): void;
  /** A read-only snapshot of the effective configuration. */
  getConfig(): ResolvedConfigSnapshot;
  /** Merge an additional data-only pack into this instance. */
  use(pack: RoastPackInput): void;
}

/** The fully-resolved configuration exposed by `getConfig`. */
export interface ResolvedConfigSnapshot {
  enabled: boolean;
  severity: Severity;
  locale: string;
  allowSensitive: boolean;
  select: SelectionStrategy;
}
