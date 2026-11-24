# Verification

After [development setup](development.md), run `pnpm verify`. This preserves the
existing role-policy, recruiting, HTTP/origin, audit, clipboard, security-header,
resume-validation and reported-regression units, then checks repository policy
and builds standalone output. Build and health require no application credentials.

## Public CI

- **policy** checks project metadata, required docs, runtime pins, immutable Actions
  and the production verification entry point.
- **app** runs TypeScript, existing source tests, recipe tests and production build.
- **Runtime security** builds the actual image, scans packages and embedded secrets
  with checksum-verified Trivy, initializes disposable PostgreSQL and runs the
  production verification entry point.
- **Dependency audit** audits every committed lockfile, including the bundled
  starter and development dependencies. **Dependency review** rejects newly
  introduced known advisories.
- Extended CodeQL, secret scanning and push protection complement these checks.
  Daily jobs cover dependencies/runtime; weekly Dependabot covers npm, Actions
  and Docker bases.

`pnpm test:production` and `pnpm test:template` use the same built-image smoke suite.
CI supplies synthetic secrets and Chromium. The built-image suite also checks
long staff and job labels at 375 px, job editor focus and draft creation, and
resume error recovery through the public application form.

## Isolated runtime checks

Build `.neander/Dockerfile`, apply `.neander/migrate.mjs` and initialize fictional
seed data before runtime verification. `DATABASE_URL` and
`NEANDER_TEMPLATE_TEST_DATABASE_URL` must identify the same explicitly disposable
local PostgreSQL database. Set `NEANDER_TEMPLATE_IMAGE` to the built image and
`BETTER_AUTH_URL`/`NEANDER_TEMPLATE_TEST_ORIGIN` to its local HTTP origin. Supply
unique test-only `BETTER_AUTH_SECRET` and `DEMO_PASSWORD`. Never use live accounts,
resumes or provider keys. `.github/workflows/check.yml` is the executable setup.

Original API suites remain in `scripts/check-phase*.mjs`. Their fixtures may
create/delete their own disposable records; bootstrap requires an empty database.
Follow each script's local-database checks. Never run against customer projects.
Reports/screenshots belong in ignored `.cache/` unless sanitized, reviewed and
intentionally committed as gallery assets.

Passing checks does not prove managed Neon rollout, external delivery, production
abuse resistance or absence of unknown vulnerabilities. Known limitations remain
explicit and are not waived by a clean scan.
