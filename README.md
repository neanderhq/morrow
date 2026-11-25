# Morrow

An open-source recruiting workspace inspired by Greenhouse. Manage jobs, public
applications and private candidate pipelines with role-based access for Admins,
Recruiters, Hiring Managers and Interviewers.

Morrow is a [Neander](https://neander.ai) template application. Use it as a starting
point, change the code in your own project and deploy through normal Publish.
The MIT-licensed app is independent of Greenhouse and has no affiliation with it.

## What works

- Workspace sign-in, staff invitations, roles, deactivation/reactivation and
  Admin-issued password-reset links.
- Job drafts, editing, publication, closing/reopening and public careers pages.
- Public applications with PDF/DOCX resumes; private, authorized resume downloads.
- Candidate/application search and filters, per-application stages, stage history
  and staff notes.
- Admin audit activity with actor/time, filters and pagination.
- Versioned interview scorecards, manual scheduling, and optional rejection email.
  See [recruiting workflows](docs/recruiting-workflows.md).

Tasks, reminders, offers, approvals, reporting, CSV export, retention and
external calendar integrations remain outside scope. See [limitations](docs/limitations.md)
before deploying for real applicants.

## Run locally

Use Node **24.22.3**, pnpm **11.18.0**, Docker and PostgreSQL. Versions are in
`mise.toml`; install dependencies with `pnpm install --frozen-lockfile`.

```sh
docker compose -p morrow-dev -f compose.dev.yaml up -d --wait
cp .env.example .env.local
```

Fill the ignored `.env.local` with the local PostgreSQL URL, an exact
`BETTER_AUTH_URL=http://127.0.0.1:3000`, a newly generated `BETTER_AUTH_SECRET` and
`DEMO_PASSWORD`. The opt-in Compose service uses database/user `neander_dev` and
development password `neander_dev_only` on loopback port `55432`; check for port
conflicts first. These are development fixtures, never production credentials.

```sh
pnpm db:migrate
node --env-file=.env.local --experimental-strip-types scripts/seed-template.ts
pnpm dev
```

Open the configured origin and sign in as `admin@morrow.test` with your generated
`DEMO_PASSWORD`. The fictional demo workspace has roles, jobs and candidates. A
repeat seed preserves later edits and passwords. For an empty database without
demo data, skip the seed and use the first-Admin setup screen.

Run `pnpm verify` for source tests, repository policy and the production build.
See [development](docs/development.md), [testing](docs/testing.md) and the
[role matrix](docs/phase-1-setup.md#permission-matrix) for details.

## Deploy and customize

The canonical recipe is `.neander/compose.yaml`: managed PostgreSQL, the deployment
origin, generated secrets and separately applied Drizzle migrations. Resume bytes
are stored privately in PostgreSQL, not in a public bucket or container filesystem.
The unprivileged standalone runtime exposes the public, database-free `/api/health`.

`.neander/template.yaml` owns the library description, committed screenshots and
fictional seed command. Neander's private publisher verifies the pinned GitHub
commit, scans its actual runtime image and registers immutable image digests and
public screenshots. Public app CI has no cloud credentials or private publisher
code. Source remains in GitHub; template publication does not host a user app or
copy an existing workspace/database. Users deploy and republish their own projects.

[Security reporting and maintenance](SECURITY.md) · [MIT license](LICENSE)
