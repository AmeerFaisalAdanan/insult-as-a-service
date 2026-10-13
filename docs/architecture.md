# Architecture

insult-as-a-service is deliberately small. An instance holds immutable
configuration plus an immutable, id-keyed set of data-only roast entries, and
maps an `(original message, error type)` pair to either a roast or the untouched
original message.

## Modules (`src/`)

| File              | Responsibility                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| `index.ts`        | Public API surface (re-exports only).                                             |
| `types.ts`        | All public type definitions.                                                      |
| `config.ts`       | Defaults, severity clamping, config resolution, per-call resolution.              |
| `errors.ts`       | Error-type registry: roastable, sensitive, and the known/sensitive predicates.    |
| `fallback.ts`     | The original-message input contract (`toSafeOriginal`).                           |
| `packs.ts`        | Pack normalisation — validate and copy entries into frozen objects, no mutation.  |
| `selector.ts`     | Deterministic selection + locale/severity fallback (dependency-free FNV-1a hash). |
| `default-pack.ts` | Imports the bundled JSON content and assembles the default pack.                  |
| `create-iaas.ts`  | The engine: ties config + store + selection + fallback together.                  |
| `roast.ts`        | The `roast()` convenience function over a shared default instance.                |

## Request flow (`message` / `result`)

```
original, errorType, options
        │
        ▼
 toSafeOriginal(original)         ── invalid input ─────────────► original = "" , fallback: invalid_input
        │ ok
        ▼
 resolveCall(config, options)     (per-call enabled/severity/locale over instance)
        │
        ▼
 effective.enabled === false ? ───────────────────────────────► original, fallback: disabled
        │ enabled
        ▼
 sensitive(errorType) && !allowSensitive ? ───────────────────► original, fallback: sensitive_error_type
        │ not blocked
        ▼
 known(errorType) || sensitive(errorType) ? ── neither ───────► original, fallback: unknown_error_type
        │ known
        ▼
 select(candidates, locale, severity, strategy, seed)
        │ none                                                   └► original, fallback: no_match
        ▼
 roast  ──────────────────────────────────────────────────────► roast message, roasted: true
```

## Precedence

Highest wins:

1. **Mandatory safety policy** — sensitive error types are never roasted unless
   `allowSensitive` is set on the instance (not per call).
2. **Explicit per-call opt-out** — `options.enabled === false`.
3. **Explicit per-call opt-in** — `options.enabled === true`, where permitted.
4. **Runtime instance configuration** — via `createIaaS` / `configure`.
5. **Instance defaults** — `enabled: true`, `severity: 3`, `locale: 'en'`,
   `allowSensitive: false`, `select: 'deterministic'`.
6. **Safe fallback** — the original message.

Because a disabled result and a safety-blocked result both return the original
message, the only case where safety (1) must outrank opt-in (3) is a sensitive
type with per-call `enabled: true`: since `allowSensitive` is instance-only, the
opt-in cannot reach sensitive content. This is covered by regression test #5.

## Selection determinism

Candidates for an error type are filtered by the locale fallback chain, then by
nearest severity within that locale group. The remaining pool is sorted by `id`
for stable ordering, and an index is chosen:

- **deterministic** (default): `FNV-1a(seed) % pool.length`, where `seed` is the
  original message. Same input → same roast; different inputs vary.
- **random**: `floor(random() * pool.length)`, using an injectable RNG so tests
  stay deterministic.

The hash is a small, pure, 32-bit FNV-1a — no crypto, no dependency, identical
across Node and browsers.

## Immutability and safety

- Pack entries are validated field-by-field and copied into **frozen** objects.
  Fields are copied explicitly (never spread), so prototype-polluting keys like
  `__proto__` in input are ignored, and caller objects are never retained or
  mutated.
- The content store is an id-keyed `Map` rebuilt (never mutated in place) on
  `use()` / `configure({ packs })`; later duplicate ids overwrite earlier ones.
- Config resolution always returns a new object; the caller's config is never
  mutated.

## Browser / offline guarantee

The core uses no Node-only APIs and no `process.env`. The default content is
inlined into the bundle at build time (`tsup`, `platform: neutral`), so the
published package needs no filesystem or network access. ESM and CJS entry
points are produced with declarations for both.

## What is intentionally _not_ here

No hosted API, no LLM, no database, no telemetry, no remote template downloads,
no framework adapters, no marketplace. V1 is a dependable message wrapper plus a
contribution workflow. The planned interactive demo lives in a **separate**
repository (`iaas-demo`) and is out of scope here.
