import type { IaaSConfig, SelectionStrategy, Severity, SupportedLocale } from './types.js';

/** Locales that the bundled default pack provides content for. */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'en-MY', 'ms-MY'];

export const MIN_SEVERITY = 1;
export const MAX_SEVERITY = 5;
export const DEFAULT_SEVERITY: Severity = 3;
export const DEFAULT_LOCALE = 'en';

/**
 * The fully-resolved internal configuration. Every field has a concrete value;
 * there are no optionals, so selection logic never has to re-apply defaults.
 */
export interface ResolvedConfig {
  enabled: boolean;
  severity: Severity;
  locale: string;
  allowSensitive: boolean;
  select: SelectionStrategy;
  random: () => number;
}

export const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = Object.freeze({
  enabled: true,
  severity: DEFAULT_SEVERITY,
  locale: DEFAULT_LOCALE,
  allowSensitive: false,
  select: 'deterministic',
  random: Math.random,
});

/** Clamp an arbitrary number to a valid integer severity in [1, 5]. */
export function clampSeverity(value: number): Severity {
  if (!Number.isFinite(value)) return DEFAULT_SEVERITY;
  const rounded = Math.round(value);
  if (rounded < MIN_SEVERITY) return MIN_SEVERITY;
  if (rounded > MAX_SEVERITY) return MAX_SEVERITY;
  return rounded as Severity;
}

/**
 * Merge a partial config over a base, producing a new ResolvedConfig.
 * The input `partial` object is never mutated or retained.
 */
export function resolveConfig(base: ResolvedConfig, partial?: IaaSConfig): ResolvedConfig {
  if (!partial) return { ...base };
  return {
    enabled: partial.enabled ?? base.enabled,
    severity: partial.severity === undefined ? base.severity : clampSeverity(partial.severity),
    locale: partial.locale ?? base.locale,
    allowSensitive: partial.allowSensitive ?? base.allowSensitive,
    select: partial.select ?? base.select,
    random: partial.random ?? base.random,
  };
}

/**
 * Resolve the effective per-call values from instance config plus per-call
 * overrides. `allowSensitive` is intentionally not overridable per call.
 */
export function resolveCall(
  config: ResolvedConfig,
  options?: { enabled?: boolean; severity?: number; locale?: string },
): { enabled: boolean; severity: Severity; locale: string } {
  return {
    enabled: options?.enabled ?? config.enabled,
    severity: options?.severity === undefined ? config.severity : clampSeverity(options.severity),
    locale: options?.locale ?? config.locale,
  };
}
