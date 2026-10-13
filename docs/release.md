# Release process

> **Status: not yet enabled for publication.** The release workflow is present
> and can run every check up to (but not including) publishing. Publication must
> stay disabled until npm Trusted Publishing and the repository protections in
> the checklist below are verified. No package has been published.

insult-as-a-service uses **npm Trusted Publishing (OIDC)**. No long-lived npm
token is stored anywhere. The publish job is the only job granted
`id-token: write`, and it runs only from a reviewed release tag on the protected
branch.

## Versioning

Semantic Versioning. Content-only additions are a minor bump; engine-breaking
changes are a major bump; fixes are a patch bump. Pre-1.0, minor bumps may
include small breaking changes, called out in the changelog.

## Release sequence (automated in `.github/workflows/release.yml`)

1. **Verify the tag** points at a reviewed commit on the protected branch.
2. Start a fresh GitHub-hosted ephemeral runner.
3. Check out the exact release commit.
4. `npm ci` from the committed lockfile.
5. Run all mandatory checks: format, lint, typecheck, tests, `validate:roasts`.
6. `npm run build` from source.
7. `npm run verify:package` — inspect tarball contents against the allowlist.
8. **Consumer smoke test** — pack the tarball, install it into a clean temporary
   project, import ESM + CJS, and assert a roast and a disabled passthrough.
9. Generate a **CycloneDX SBOM** (`npx @cyclonedx/cyclonedx-npm`).
10. **Publish** via npm Trusted Publishing with provenance
    (`npm publish --provenance --access public`).
11. **Verify** the published version and provenance.

The publish step is gated behind a protected GitHub **environment** with a
required reviewer, and must never run from a pull request, an arbitrary branch,
or an unreviewed commit.

## Doing a release (maintainer)

```bash
# 1. Ensure main is green and up to date.
# 2. Bump the version and update the changelog on a PR; merge it.
# 3. Tag the reviewed commit and push the tag:
git tag -s v0.1.0 -m "v0.1.0"
git push origin v0.1.0
# 4. Approve the protected 'release' environment when prompted.
# 5. Verify the published package and provenance (step below).
```

## Provenance verification

```bash
npm view insult-as-a-service     # confirm the new version
npm audit signatures             # verify registry signatures
# Provenance is visible on the npm package page (built via GitHub OIDC).
```

## First-release prerequisites (must be verified before enabling publish)

- [ ] npm **Trusted Publisher** configured for this repo + `release.yml`
      (npm package settings → Trusted Publishing). Until then, the publish step
      stays disabled.
- [ ] No npm automation/classic token stored as a repo/org secret.
- [ ] npm account has **2FA** enabled; package access reviewed.
- [ ] GitHub **protected environment** `release` with a required reviewer.
- [ ] `main` branch protection: required PRs, required status checks, code-owner
      review, linear history, restricted direct pushes.
- [ ] **Release tag protection** (only maintainers can create `v*` tags).
- [ ] Secret scanning + push protection enabled.
- [ ] Dependabot alerts + security updates enabled.
- [ ] Private vulnerability reporting enabled.

See the full maintainer checklist in [security.md](./security.md) and the repo
hardening section of the handover.

## Rollback

```bash
npm deprecate insult-as-a-service@<bad-version> "Deprecated: <reason>; use <good-version>"
```

Publish a fixed version through the normal gated flow. Unpublish only within
npm's allowed window and only when strictly necessary (it breaks installs that
pinned the version).

## Incident response & credential revocation

- **Suspected release compromise:** follow the "Compromised release response" in
  [SECURITY.md](../SECURITY.md).
- **Trusted Publishing:** disable the `release.yml` workflow and remove/rotate
  the npm Trusted Publisher trust relationship. Because no long-lived token
  exists, there is no static credential to leak — revoking trust is immediate.
- **If a legacy token was ever introduced (it should not be):** revoke it in npm
  account settings immediately and rotate any dependent secrets.
- Record the incident, affected versions, and remediation in a GitHub Security
  Advisory.
