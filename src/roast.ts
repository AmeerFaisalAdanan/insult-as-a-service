import { createIaaS } from './create-iaas.js';
import type { IaaS, MessageOptions } from './types.js';

/**
 * A lazily-created shared instance backing the {@link roast} convenience
 * function. It is created once with default configuration and is never mutated
 * by `roast()` (the function does not call `configure`), so the public API does
 * not depend on hidden mutable global state.
 */
let shared: IaaS | undefined;

function sharedInstance(): IaaS {
  if (!shared) shared = createIaaS();
  return shared;
}

/**
 * Return a roast for the given error type using a default-configured instance
 * (enabled, severity 3, locale 'en', deterministic selection).
 *
 * Returns an empty string when the error type is unknown, sensitive, or has no
 * matching content. There is no original message to preserve here; use
 * {@link createIaaS} and `message(original, errorType)` when you need fallback
 * to a real message.
 */
export function roast(errorType: string, options?: MessageOptions): string {
  const result = sharedInstance().result('', errorType, options);
  return result.roasted ? result.message : '';
}
