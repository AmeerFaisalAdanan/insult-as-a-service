/**
 * Error-type registry.
 *
 * Matching is driven by an explicit, stable `error_type` string supplied by the
 * caller — never by parsing the text of an English sentence. There are three
 * kinds of error type:
 *
 *  - ROASTABLE (in {@link KNOWN_ERROR_TYPES}): eligible for a roast.
 *  - SENSITIVE (in {@link SENSITIVE_ERROR_TYPES}): recognised, but never roasted
 *    unless the instance is explicitly configured with `allowSensitive: true`.
 *    These cover categories where humour is inappropriate — failed payments,
 *    credential/login failures, account security and destructive actions.
 *  - UNKNOWN (anything else): always returns the original message.
 *
 * Note on `unauthorized` / `forbidden`: these are treated as ordinary HTTP
 * authorization errors (classic, harmless "you shall not pass" territory) and
 * are roastable. They are distinct from credential/login *failures*, which live
 * in the sensitive set.
 */

/** Roastable validation error types. */
export const VALIDATION_ERROR_TYPES = [
  'required_field',
  'invalid_email',
  'invalid_url',
  'invalid_format',
  'invalid_number',
  'out_of_range',
  'password_too_short',
  'password_too_weak',
  'password_mismatch',
  'invalid_date',
  'invalid_phone',
  'invalid_input',
] as const;

/** Roastable application / infrastructure error types. */
export const APPLICATION_ERROR_TYPES = [
  'not_found',
  'unauthorized',
  'forbidden',
  'rate_limited',
  'network_error',
  'request_timeout',
  'server_error',
] as const;

/**
 * Roastable developer / build-time error types. Added so developer-facing jokes
 * are not forced into unrelated validation categories. `dev_error` is the
 * general-purpose catch-all for production/developer humour.
 */
export const DEVELOPER_ERROR_TYPES = [
  'missing_config',
  'build_failed',
  'merge_conflict',
  'syntax_error',
  'type_error',
  'dev_error',
] as const;

/** The full set of roastable (non-sensitive) error types. */
export const KNOWN_ERROR_TYPES: ReadonlySet<string> = new Set<string>([
  ...VALIDATION_ERROR_TYPES,
  ...APPLICATION_ERROR_TYPES,
  ...DEVELOPER_ERROR_TYPES,
]);

/**
 * Safety-protected error types. Recognised by the engine, but never roasted
 * unless `allowSensitive: true` is configured on the instance. This set is not
 * exhaustive; it is a reserved, conservative baseline. Contributors propose
 * additions via the process in CONTRIBUTING.md.
 */
export const SENSITIVE_ERROR_TYPES: ReadonlySet<string> = new Set<string>([
  // Payment / billing
  'payment_failed',
  'payment_declined',
  'card_declined',
  'insufficient_funds',
  'billing_error',
  // Credential / login / account security
  'invalid_credentials',
  'login_failed',
  'account_locked',
  'account_disabled',
  'mfa_required',
  'mfa_failed',
  // Destructive / data-loss operations
  'delete_failed',
  'destructive_action',
  'data_loss',
]);

export function isKnownErrorType(errorType: string): boolean {
  return KNOWN_ERROR_TYPES.has(errorType);
}

export function isSensitiveErrorType(errorType: string): boolean {
  return SENSITIVE_ERROR_TYPES.has(errorType);
}
