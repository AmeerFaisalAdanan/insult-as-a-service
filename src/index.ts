/**
 * insult-as-a-service — turn ordinary application error messages into
 * context-aware roasts, with a reliable global and per-message opt-out.
 *
 * Your application owns the error. IaaS only changes how it is presented.
 */
export { createIaaS } from './create-iaas.js';
export { roast } from './roast.js';

export {
  KNOWN_ERROR_TYPES,
  SENSITIVE_ERROR_TYPES,
  VALIDATION_ERROR_TYPES,
  APPLICATION_ERROR_TYPES,
  DEVELOPER_ERROR_TYPES,
  isKnownErrorType,
  isSensitiveErrorType,
} from './errors.js';

export {
  SUPPORTED_LOCALES,
  MIN_SEVERITY,
  MAX_SEVERITY,
  DEFAULT_SEVERITY,
  DEFAULT_LOCALE,
} from './config.js';

export { DEFAULT_PACK } from './default-pack.js';

export type {
  IaaS,
  IaaSConfig,
  MessageOptions,
  RoastEntry,
  RoastPackInput,
  RoastResult,
  FallbackReason,
  Severity,
  SupportedLocale,
  SelectionStrategy,
  ResolvedConfigSnapshot,
} from './types.js';
