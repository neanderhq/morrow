# Development

Morrow uses Next.js App Router, React/TypeScript, Better Auth, Drizzle and
PostgreSQL. Routes live in `app/`, UI in `components/`, authorization and database
services in `server/`, and committed SQL/metadata in `drizzle/`.
`project.json` records repository identity; deployment belongs to the recipe.

Use Node 24.22.3 and pnpm 11.18.0. Install locked packages with
`pnpm install --frozen-lockfile`; policy checks need Python 3 and
`PyYAML==6.0.3`. Copy `.env.example` to ignored `.env.local` and fill local values.
Generate unique `BETTER_AUTH_SECRET` and `DEMO_PASSWORD`; never reuse production
credentials. The configured origin must match the browser URL exactly.

Start only your own opt-in database with an explicit Compose project/file:
`docker compose -p morrow-dev -f compose.dev.yaml up -d --wait`. Its named volume
is persistent. Check port availability and preserve existing volumes. Never use
an existing customer workspace as a fixture.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local Next.js server at `http://127.0.0.1:3000` |
| `pnpm check` | TypeScript checks |
| `pnpm test` | Existing policy, recruiting, HTTP, upload, audit and regression units |
| `pnpm test:policy` | Technical repository and public CI contract |
| `pnpm build` | Standalone production build |
| `pnpm verify` | Source tests, policy and build |
| `pnpm db:migrate` | Apply committed Drizzle migrations |
| `pnpm db:seed` | Fictional demo initialization; explicit environment required |
| `pnpm test:production` | Built-image/database/browser verification |

The migration convenience command reads `.env.local` if present. The seed expects
environment variables; locally run
`node --env-file=.env.local --experimental-strip-types scripts/seed-template.ts`.
Use [setup and permissions](phase-1-setup.md) for empty-database Admin bootstrap
and role checks. [Limitations](limitations.md) describe operational boundaries.

Better Auth's schema is generated with the pinned `auth` CLI and exported from
`server/schema.ts`; generate/review Drizzle migrations with metadata. Do not
hand-author auth tables or use `auth migrate` with the Drizzle adapter. Migrations
are separate from image build/startup; `/api/health` and builds remain
credential-free. Read [deployment contract](deployment-contract.md) and installed
Next.js documentation before modifying those boundaries.

Keep authorization in server code. Private records and resumes require active
membership and workspace/job access; cookie mutations require the configured
Origin. Render untrusted text safely, preserve document validation and private
download headers, and never log credentials, tokens or applicant documents.

PRs require policy/app/runtime/security checks and maintainer/code-owner review.
Public CI uses SHA-pinned Actions, read-only permissions and no retained checkout
credentials or cloud secrets. Tests never configure real delivery/provider keys.
