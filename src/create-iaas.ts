import {
  DEFAULT_RESOLVED_CONFIG,
  resolveCall,
  resolveConfig,
  type ResolvedConfig,
} from './config.js';
import { DEFAULT_PACK } from './default-pack.js';
import { isKnownErrorType, isSensitiveErrorType } from './errors.js';
import { toSafeOriginal } from './fallback.js';
import { mergePack } from './packs.js';
import { select } from './selector.js';
import type {
  IaaS,
  IaaSConfig,
  MessageOptions,
  RoastEntry,
  RoastPackInput,
  RoastResult,
} from './types.js';

/**
 * Create a configured IaaS instance.
 *
 * Precedence applied per call (highest wins):
 *   1. Mandatory safety policy (sensitive error types are never roasted unless
 *      `allowSensitive: true` is configured on the instance).
 *   2. Explicit per-call opt-out (`options.enabled === false`).
 *   3. Explicit per-call opt-in (`options.enabled === true`), where permitted.
 *   4. Runtime instance configuration.
 *   5. Instance defaults.
 *   6. Safe fallback (original message).
 *
 * Configuration changes via {@link IaaS.configure} take effect immediately for
 * all subsequent calls on the same instance.
 */
export function createIaaS(config?: IaaSConfig): IaaS {
  let resolved: ResolvedConfig = resolveConfig(DEFAULT_RESOLVED_CONFIG, config);

  // Immutable, id-keyed content store. Each entry is a frozen copy; caller
  // objects are never retained or mutated.
  let store: ReadonlyMap<string, RoastEntry> = new Map();
  if (config?.includeDefaultPack !== false) {
    store = mergePack(store, DEFAULT_PACK as readonly RoastEntry[]);
  }
  if (config?.packs) {
    for (const pack of config.packs) {
      store = mergePack(store, pack);
    }
  }

  function buildResult(
    original: unknown,
    errorType: string,
    options?: MessageOptions,
  ): RoastResult {
    const normalized = toSafeOriginal(original);
    const call = resolveCall(resolved, options);

    const base: RoastResult = {
      message: normalized.value,
      roasted: false,
      original: normalized.value,
      errorType,
      locale: call.locale,
      severity: call.severity,
    };

    // Input contract: non-string, non-primitive input is never rendered.
    if (!normalized.ok) {
      return { ...base, fallbackReason: 'invalid_input' };
    }

    // (2)/(3) effective enable state, already incorporating per-call override.
    if (!call.enabled) {
      return { ...base, fallbackReason: 'disabled' };
    }

    // (1) Safety policy. `allowSensitive` is instance-level only, so a per-call
    // opt-in cannot bypass this.
    if (isSensitiveErrorType(errorType) && !resolved.allowSensitive) {
      return { ...base, fallbackReason: 'sensitive_error_type' };
    }

    // Unknown (neither roastable nor sensitive) -> original message.
    if (!isKnownErrorType(errorType) && !isSensitiveErrorType(errorType)) {
      return { ...base, fallbackReason: 'unknown_error_type' };
    }

    const candidates: RoastEntry[] = [];
    for (const entry of store.values()) {
      if (entry.error_type === errorType) candidates.push(entry);
    }

    const chosen = select({
      candidates,
      locale: call.locale,
      severity: call.severity,
      strategy: resolved.select,
      random: resolved.random,
      seed: normalized.value,
    });

    if (!chosen) {
      return { ...base, fallbackReason: 'no_match' };
    }

    return {
      message: chosen.entry.message,
      roasted: true,
      original: normalized.value,
      errorType,
      locale: chosen.locale,
      severity: chosen.severity,
      templateId: chosen.entry.id,
    };
  }

  return {
    message(original, errorType, options) {
      return buildResult(original, errorType, options).message;
    },
    result(original, errorType, options) {
      return buildResult(original, errorType, options);
    },
    configure(partial: IaaSConfig) {
      resolved = resolveConfig(resolved, partial);
      if (partial.packs) {
        for (const pack of partial.packs) {
          store = mergePack(store, pack);
        }
      }
    },
    getConfig() {
      return {
        enabled: resolved.enabled,
        severity: resolved.severity,
        locale: resolved.locale,
        allowSensitive: resolved.allowSensitive,
        select: resolved.select,
      };
    },
    use(pack: RoastPackInput) {
      store = mergePack(store, pack);
    },
  };
}
