# insult-as-a-service (IaaS)

> Turn ordinary application error messages into context-aware roasts — offline, zero runtime dependencies, framework-independent, with a reliable global and per-message opt-out.

**Your application owns the error. IaaS only changes how the error is presented.** When disabled, IaaS returns your original message unchanged. When an error is unknown, unsupported, sensitive, or has no matching roast, IaaS falls back to the original message. Remove IaaS entirely and your app still works.

- **Offline.** No network at runtime. No API key. No backend.
- **Zero runtime dependencies.** The published package depends on nothing.
- **Framework-independent.** Plain TypeScript/JavaScript. Works in Node and the browser (ESM + CJS).
- **Data-driven.** Roasts are curated, version-controlled JSON — not code, not an LLM.
- **Safe by default.** Payment, credential, and destructive error types are never roasted unless you explicitly opt in.

---

## Installation

```bash
npm install insult-as-a-service
```

Requires Node.js >= 18.18 for development; the runtime bundle targets ES2021 and runs in any modern browser or Node version.

## Quick start

```ts
import { createIaaS } from 'insult-as-a-service';

const iaas = createIaaS({
  enabled: true,
  severity: 3,
  locale: 'en-MY',
});

iaas.message('Email is invalid', 'invalid_email');
// => "Bro typed `gmail.con` and called it a day. 💀"
```

The first argument is **your** original message; the second is a stable, explicit **error type**. If anything prevents a roast, you get your original message back, untouched.

## Global enable / disable

```ts
const iaas = createIaaS({ enabled: false });
iaas.message('Email is invalid', 'invalid_email');
// => "Email is invalid"  (exactly, byte-for-byte)
```

Toggle at runtime without changing your validation logic:

```ts
iaas.configure({ enabled: false });
```

Configuration changes take effect immediately for all subsequent calls on that instance.

## Per-message opt-out

An explicit per-call opt-out always preserves the original message:

```ts
iaas.message('Email is invalid', 'invalid_email', { enabled: false });
// => "Email is invalid"
```

A per-call opt-in enables roasting for a single call, **but cannot override the safety policy** (see below):

```ts
createIaaS({ enabled: false }).message('Email is invalid', 'invalid_email', { enabled: true });
// => a roast
```

## Supported error types

Matching is driven by an explicit `errorType` string — IaaS never guesses a category by parsing your sentence. Unknown types always return the original message.

**Validation:** `required_field`, `invalid_email`, `invalid_url`, `invalid_format`, `invalid_number`, `out_of_range`, `password_too_short`, `password_too_weak`, `password_mismatch`, `invalid_date`, `invalid_phone`, `invalid_input`

**Application / infrastructure:** `not_found`, `unauthorized`, `forbidden`, `rate_limited`, `network_error`, `request_timeout`, `server_error`

**Developer / build:** `missing_config`, `build_failed`, `merge_conflict`, `syntax_error`, `type_error`, `dev_error`

```ts
import { KNOWN_ERROR_TYPES } from 'insult-as-a-service';
```

### Safety policy (sensitive types)

Some categories are never roasted by default because humour there is inappropriate or could obscure what the user must do next — failed payments, credential/login failures, account security, and destructive operations (e.g. `payment_declined`, `invalid_credentials`, `account_locked`, `delete_failed`). For these, IaaS returns the original message unless you explicitly and knowingly opt in at the **instance** level:

```ts
const iaas = createIaaS({ allowSensitive: true });
```

This cannot be enabled per call, so a routine call can never bypass it. Note that HTTP authorization errors `unauthorized` (401) and `forbidden` (403) are treated as ordinary, roastable errors — they are distinct from credential/login _failures_.

## Locale and severity

Locales shipped with the default pack: `en` (general English), `en-MY` (Malaysian English / Manglish), `ms-MY` (Bahasa Melayu).

**Locale fallback chain:**

1. Exact locale at the requested severity.
2. Exact locale at the nearest available severity.
3. Parent language (e.g. `en-MY` → `en`) with the same severity rules.
4. Original message.

IaaS never crosses to an unrelated locale just because content exists there.

**Severity** is humour intensity from 1 (gentle nudge) to 5 (maximum playful roast). The default is 3. Values outside 1–5 are clamped. If the exact severity is missing within a locale group, the nearest severity is used (ties resolve to the lower severity). Severity is intensity only — safety rules apply at every level.

## Custom packs

Packs are **data only** — arrays of roast entries, never code:

```ts
import { createIaaS, type RoastEntry } from 'insult-as-a-service';

const myPack: RoastEntry[] = [
  {
    id: 'myteam.en.1',
    error_type: 'invalid_email',
    locale: 'en',
    severity: 3,
    message: 'Try again, legend.',
  },
];

const iaas = createIaaS({ enabled: true, packs: [myPack] });
// or at runtime:
iaas.use(myPack);
```

Pass `includeDefaultPack: false` to start from an empty content set. See [schema/roast.schema.json](./schema/roast.schema.json) for the entry schema and [CONTRIBUTING.md](./CONTRIBUTING.md) for the rules.

## Structured result

`message()` always returns a plain string, synchronously. For debugging or analytics, `result()` returns details without IaaS collecting anything:

```ts
iaas.result('Email is invalid', 'invalid_email');
// {
//   message: '...', roasted: true, original: 'Email is invalid',
//   errorType: 'invalid_email', locale: 'en-MY', severity: 3,
//   templateId: 'invalid_email.en-MY.1'
// }
```

When `roasted` is `false`, a `fallbackReason` explains why (`disabled`, `invalid_input`, `unknown_error_type`, `sensitive_error_type`, or `no_match`).

## Convenience function

```ts
import { roast } from 'insult-as-a-service';
roast('network_error'); // a default-locale roast string, or '' if none applies
```

`roast()` uses a shared, default-configured instance and is deterministic. It never mutates global state. Use `createIaaS` when you need a real original-message fallback.

## Determinism

By default, selection is deterministic: the same original message and content set always produce the same roast, while different messages vary. For rotation, set `select: 'random'` and optionally inject your own RNG via `random` (so tests stay deterministic):

```ts
createIaaS({ select: 'random', random: () => 0.5 });
```

## Input contract

The original message should be a string, preserved exactly. Safe primitives (`number`, `boolean`, `bigint`) are coerced with `String()`. Any other input (`null`, `undefined`, objects, arrays, functions, symbols) is treated as invalid and yields an empty string — IaaS never stringifies arbitrary objects, so it cannot leak internals or sensitive values.

## Browser compatibility and offline behaviour

The core uses no Node-only APIs and no `process.env`. The default content pack is inlined into the bundle at build time, so the package works fully offline with no filesystem or network access. It ships ESM (`import`) and CJS (`require`) entry points with TypeScript declarations for both.

## Security

Roast data is inert — never evaluated, never rendered as HTML by IaaS, and prototype-polluting keys in pack data are ignored. IaaS does no logging, telemetry, or collection of user input. See [SECURITY.md](./SECURITY.md) and [docs/security.md](./docs/security.md).

## Contributing

Add roasts by editing JSON — no engine changes required. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Development

```bash
npm install
npm run build            # bundle ESM + CJS + types
npm run typecheck        # strict tsc
npm test                 # unit + regression + security + integration
npm run validate:roasts  # validate all packs
npm run verify:package   # check the publishable tarball contents
npm run lint             # eslint
npm run format:check     # prettier
```

## License

[MIT](./LICENSE) © Ameer Faisal Adanan
