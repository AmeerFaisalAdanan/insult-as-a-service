# Security & supply-chain controls

This library is zero-runtime-dependency and offline, so its **runtime** attack
surface is small. The meaningful surface is the **development toolchain** and
the **release pipeline**. This document records which controls are implemented
in this repository and which require maintainer action on the GitHub/npm account.

## Runtime security properties (implemented, tested)

- **Data, not code.** Roast content is plain JSON. No `eval`, no `Function`, no
  template execution, no HTML rendering, no network, no filesystem at runtime.
- **Prototype-pollution resistant.** Pack entries are copied field-by-field into
  frozen objects; `__proto__` / `constructor` / `prototype` keys are ignored and
  entries whose `id` is a dangerous key are rejected.
- **No input leakage.** Non-string, non-primitive inputs yield `''`; objects are
  never stringified. The engine never interpolates user input into a roast.
- **No logging / telemetry / persistence.** Verified by a test that spies on all
  console methods during normal operation.
- **No mutation.** Caller config and pack objects are never mutated (regression
  test #7).

See `tests/security/` and `tests/regression/` for the enforcing tests.

## Supply-chain controls

### Implemented in-repo

- **Zero runtime dependencies.** `npm audit --omit=dev` reports 0 findings.
- **Committed lockfile** (`package-lock.json`) for reproducible installs.
- **Pinned dev dependencies** — exact versions in `package.json`, fully resolved
  by the lockfile.
- **Pinned GitHub Actions** — every third-party action is pinned to a
  full-length commit SHA (see `.github/workflows/`), resolved from upstream tags
  and recorded in a trailing comment.
- **Least-privilege workflows** — top-level `permissions: contents: read`; jobs
  elevate only what they need. PR validation requests no secrets and no write
  scopes.
- **Package allowlist + tarball inspection** — `scripts/verify-package.ts`
  fails if anything outside the allowlist (or any `src/`, test, or `.env` file)
  would be published, or if a required artifact is missing.
- **Dependency review, CodeQL, and scheduled audits** — wired in CI (see below).
- **SBOM generation** — the release workflow generates a CycloneDX SBOM via
  `@cyclonedx/cyclonedx-npm` (run with `npx`, not added as a dependency).
- **`.npmrc` hardening guidance** — the release flow installs with
  `npm ci --ignore-scripts` where practical and does not disable integrity checks.

### CI/CD workflows (`.github/workflows/`)

| Workflow       | Trigger                   | Purpose                                                                                                                  |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pr.yml`       | pull requests             | install, format, lint, typecheck, test, validate packs, build, verify package, dependency review                         |
| `main.yml`     | push to `main`            | re-run the required checks after merge                                                                                   |
| `security.yml` | schedule + manual         | `npm audit`, CodeQL, dependency review, OpenSSF Scorecard                                                                |
| `release.yml`  | release tag + manual gate | verify tag → clean build → verify tarball → consumer smoke → SBOM → provenance publish via npm Trusted Publishing (OIDC) |

Only `release.yml`'s publish job receives `id-token: write`. No long-lived npm
token is used anywhere. See [release.md](./release.md).

## Dependency / vulnerability policy

- **Runtime (production) vulnerabilities:** any newly introduced **critical** or
  **high** advisory fails the security gate. The published package has zero
  runtime dependencies, so this surface is expected to stay empty.
- **Development vulnerabilities:** advisories in dev-only tooling (test runner,
  bundler, linters) do **not** ship to consumers. They are tracked and reduced
  by keeping tooling current, but a single known dev-only advisory does not block
  a release. Any exception is time-bounded and documented here rather than
  silently suppressed.
- Dependency additions/updates are reviewed; lifecycle (install) scripts are
  scrutinised and not added casually. Integrity checks are never disabled for
  convenience.

### Known residual risks (as of 0.1.0)

- **Dev-only, low severity:** an esbuild advisory (dev-server arbitrary file read
  on Windows, GHSA-g7r4-m6w7-qqqr) is present transitively via the build/test
  toolchain. It affects only the esbuild dev server, which this project never
  runs, on Windows only. It is not in the published artifact. Tracked; will clear
  on the next compatible toolchain bump. Verify current state with
  `npm audit` and `npm audit --omit=dev`.

No project can claim immunity to supply-chain attacks. These controls reduce and
contain the risk; they do not eliminate it.

## Maintainer account actions (NOT configurable from this repo's files)

These must be set by a maintainer in GitHub/npm settings. They are **not**
enabled merely because this document lists them — see
[release.md](./release.md) for the full checklist. In brief: protect `main` and
release tags, require PRs + CI + code-owner review, enable secret scanning +
push protection, Dependabot alerts/updates, private vulnerability reporting,
configure npm Trusted Publishing (OIDC), enable npm 2FA, and configure a
protected release environment with required reviewers.
