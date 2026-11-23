# Stack

Morrow uses Next.js App Router, React/TypeScript, Better Auth email/password
sessions, Drizzle and PostgreSQL. The existing app grew from Neander's Next.js
starter; its reusable UI foundation/design-pack source and third-party notices
remain included.

`.neander/Dockerfile` produces one unprivileged standalone Node.js runtime. The
canonical `.neander/compose.yaml` requires a provisioned database/public origin
and generated runtime secrets. Migrations run separately from image startup.
Resume documents remain private database records rather than container files.
Local PostgreSQL Compose is distinct from managed Neon provisioning.

Server services authorize active membership and workspace/job access on each
private request. Cookie mutations check Origin. Invitations and password-reset
links are manual; no external delivery provider is configured. See
[limitations](../limitations.md) for the delivered Phase 1 scope and recovery,
submission-abuse and data-lifecycle boundaries.

Maintained reference blocks in `.neander/blocks/` are excluded from the runtime
image until installed. Their presence does not imply Google/Microsoft OAuth,
future recruiting workflows or other provider integrations are implemented.
