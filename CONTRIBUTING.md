# Contributing to insult-as-a-service

Thanks for helping build the roast library! The most valuable contribution is
**new roast content**, and you can add it by editing JSON — no engine knowledge
or TypeScript required.

## Ways to contribute

- Add roasts to an existing error type / locale.
- Add a locale translation.
- Propose a new error type.
- Improve the engine, tests, or docs.

## Quick start for content contributors

1. **Fork** the repository and create a branch.
2. **Add entries** to the appropriate JSON file under `packs/default/<locale>/`:
   - `validation.json` — form/field validation errors
   - `application.json` — application / infrastructure errors
   - `developer.json` — developer / build-time errors
3. **Validate** your change:
   ```bash
   npm install
   npm run validate:roasts
   ```
4. **Run the tests:**
   ```bash
   npm test
   ```
5. **Open a pull request.** CI re-runs validation, tests, build, and package
   checks. A maintainer reviews humour quality, safety, and duplication.

You do **not** need npm publishing rights. Approved content ships with the next
release.

## Roast entry schema

Each entry is a JSON object. See [schema/roast.schema.json](./schema/roast.schema.json)
for the machine-readable definition.

```json
{
  "id": "invalid_email.en-MY.9",
  "error_type": "invalid_email",
  "locale": "en-MY",
  "severity": 3,
  "message": "Your email address is having an identity crisis.",
  "tags": ["email", "manglish"]
}
```

| Field        | Required | Rules                                                                                                    |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| `id`         | yes      | Unique across **all** packs. `^[A-Za-z0-9._:-]+$`, ≤ 128 chars. Convention: `<error_type>.<locale>.<n>`. |
| `error_type` | yes      | A registered error type. `^[a-z][a-z0-9_]*$`.                                                            |
| `locale`     | yes      | A supported locale: `en`, `en-MY`, `ms-MY`.                                                              |
| `severity`   | yes      | Integer 1–5 (1 gentle … 5 maximum playful roast).                                                        |
| `message`    | yes      | Non-empty, non-whitespace plain text. ≤ 280 chars. No lone surrogates.                                   |
| `tags`       | no       | Up to 12 tags, each `^[a-z0-9-]+$`, ≤ 32 chars.                                                          |

Unexpected fields are rejected. Pack files must be a JSON **array** of entries,
≤ 256 KB and ≤ 2000 entries per file.

The validator rejects: missing required fields, duplicate IDs, unknown error
types, unsupported locales, out-of-range severity, empty/whitespace messages,
malformed JSON, invalid Unicode, unexpected fields, and oversized files. A
**near-duplicate message** within the same locale/error_type produces a
**warning**, not a failure — please deduplicate when you see one.

## Content safety rules

These are enforced by review, not just by tooling. A roast must never:

- Target protected characteristics (race, religion, gender, sexuality,
  disability, nationality, etc.).
- Encourage self-harm, make threats, or mock genuine personal distress.
- Reveal or interpolate the user's actual input — **never** echo a password,
  token, secret, email value, or any PII into a roast message. The engine does
  not interpolate input; keep content free of it too.
- Imply a failed operation succeeded, or obscure what the user should do next.

Keep **payment failures, authentication/security incidents, destructive
operations, and serious infrastructure incidents neutral by default.** These
map to sensitive error types that are not roasted unless the integrator opts in.

### Severity guidance

- **1** gentle nudge · **2** light teasing · **3** sarcastic · **4** savage but
  playful · **5** maximum playful roast.
- Ordinary validation errors should sit around 2–3. Reserve 4–5 for clearly
  playful "savage mode" burns. Safety rules apply at **every** severity.

### Locale guidance

- `en` — general English. Avoid region-specific slang.
- `en-MY` — Malaysian English / Manglish. Natural, not forced.
- `ms-MY` — Bahasa Melayu. Do not submit machine-translated BM; write it
  natively or have it reviewed.

Do not duplicate the same joke across locales by translating it literally.

## Proposing a new error type

The registry is intentionally extensible. To propose a new error type:

1. Open an issue describing the error category, who raises it, and why existing
   types do not fit. Do not force a joke into an unrelated category.
2. If agreed, a maintainer adds it to `src/errors.ts` (and to the sensitive set
   if humour there would be inappropriate).
3. You then add content for the new type via the normal content PR flow.

Engine changes (anything under `src/`, `scripts/`, or `.github/`) require
code-owner review — see [CODEOWNERS](./.github/CODEOWNERS). Content-only changes
under `packs/` do not require engine review, only content review.

## Pull request expectations

- One focused change per PR.
- `npm run validate:roasts`, `npm test`, `npm run lint`, and
  `npm run format:check` all pass locally.
- New engine behaviour comes with tests.
- Describe what you changed and why.

## Attribution and licensing

By contributing, you agree your contribution is licensed under the project's
[MIT License](./LICENSE). Authorship is preserved in Git history; we do not
store contributor identity inside the runtime pack data (it stays clean data).

## Code of conduct

This project follows its [Code of Conduct](./CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.
