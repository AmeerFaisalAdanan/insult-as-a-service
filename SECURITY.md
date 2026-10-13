# Security Policy

## Supported versions

insult-as-a-service is pre-1.0. During this phase, only the latest published
`0.x` minor line receives security fixes. Once `1.0.0` is released, this table
will be updated to list supported major/minor lines.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's **private vulnerability reporting**:
[Security advisories › Report a vulnerability](https://github.com/AmeerFaisalAdanan/insult-as-a-service/security/advisories/new).

> Maintainer setup note: private vulnerability reporting must be enabled for the
> repository (Settings → Code security and analysis). If it is not yet enabled,
> this is the placeholder for the reporting channel and must be configured
> before release. No security email address is published; use the GitHub channel.

When reporting, please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal proof of concept where possible).
- Affected version(s) and environment.

Please describe the **class** of problem rather than attaching a weaponised
exploit.

## Response process

- **Acknowledgement:** we aim to acknowledge a report within 5 business days.
- **Assessment:** we triage severity and confirm the affected versions.
- **Fix & disclosure:** we prepare a fix, publish a patched release, and credit
  the reporter (unless anonymity is requested). We coordinate disclosure timing
  with the reporter and publish a GitHub Security Advisory.

Timelines are best-effort for a volunteer-maintained open-source project.

## Scope and threat model

This is a zero-runtime-dependency, offline library. Its runtime surface is
small and is designed so that:

- Roast content is **data**, never executed. There is no `eval`, no dynamic
  `Function`, no template execution, no HTML rendering, and no network access.
- Pack data cannot pollute `Object.prototype` (dangerous keys are ignored).
- Caller-supplied objects are never mutated and never stringified blindly, so
  the library does not leak object internals or sensitive values.
- The library performs no logging, telemetry, or persistence of inputs.

The primary supply-chain surface is the **development toolchain** and the
**release pipeline**, not the shipped code. See [docs/security.md](./docs/security.md)
for the full set of controls, the dependency/vulnerability policy, and residual
risks, and [docs/release.md](./docs/release.md) for the gated release process.

## Compromised release response

If a published release is suspected to be compromised:

1. **Revoke** the compromising credential/token immediately (or, under Trusted
   Publishing, disable the publishing workflow and rotate the OIDC trust).
2. **Deprecate** the affected npm version(s) with a clear message
   (`npm deprecate`), and unpublish only within npm's allowed window if warranted.
3. **Publish** a patched version from a verified, reviewed commit through the
   normal gated release workflow.
4. **Advise** users via a GitHub Security Advisory with affected versions and
   remediation steps.
5. **Verify** provenance on the replacement release and confirm the published
   artifact matches the reviewed source.

Credential revocation and incident contacts are documented for maintainers in
[docs/release.md](./docs/release.md).
