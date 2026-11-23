# Security

Report vulnerabilities through this repository's **Security → Report a
vulnerability** page. This creates a private advisory for maintainers. Avoid
posting exploit details, credentials or applicant records in public issues.
Include the affected revision, reproduction steps and impact.

The maintained version is current `main`. Dependency alerts/updates, extended
CodeQL, secret scanning/push protection and private reporting form the repository
baseline. PR and daily checks audit every dependency lockfile, including bundled
examples and development dependencies. Dependency review rejects newly introduced
advisories; weekly Dependabot covers npm, Actions and Docker. Updates still need
application verification and review.

Neander's private publisher verifies and scans the actual runtime image before
registration; daily scans also check registered immutable digests. Findings need
remediation and republication. Updating source does not patch an existing release
or deployment. Scanners cannot prove an absence of vulnerabilities.

Preserve server-side workspace/job authorization, Origin checks, private resume
downloads and document validation. Read [known limitations](docs/limitations.md):
manual link delivery, sole-Admin recovery, an evadable cookie-based submission
limit and missing record deletion are scope limits, not security features.

Use fictional fixtures and generated deployment secrets. Never commit real
resumes, workspace exports, credentials, `.env` files or provider tokens. Configure
operational security, backups and data-lifecycle controls before real use.
