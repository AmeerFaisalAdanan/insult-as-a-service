/**
 * Original-message input contract.
 *
 * The public API accepts `unknown` for the original message so that passing a
 * non-string (a thrown object, `undefined`, etc.) is a type error at the
 * boundary but never a crash at runtime. The contract:
 *
 *  - A string is preserved exactly, byte-for-byte (no trim / normalize / rewrite).
 *  - A `number`, `boolean` or `bigint` is a safe primitive and is coerced with
 *    `String()`.
 *  - Anything else (`null`, `undefined`, objects, arrays, functions, symbols) is
 *    treated as invalid input: the engine returns an empty string rather than
 *    risk leaking object internals such as `[object Object]` or enumerable
 *    properties that may hold sensitive values.
 */
export interface NormalizedOriginal {
  ok: boolean;
  value: string;
}

export function toSafeOriginal(original: unknown): NormalizedOriginal {
  const t = typeof original;
  if (t === 'string') {
    return { ok: true, value: original as string };
  }
  if (t === 'number' || t === 'boolean' || t === 'bigint') {
    return { ok: true, value: String(original) };
  }
  return { ok: false, value: '' };
}
