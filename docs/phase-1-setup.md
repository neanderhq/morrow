# Phase 1 setup and review

This guide records delivered increments within recruiting Phase 1. See [known limitations](limitations.md) for what is not implemented. Stage 1 provides the workspace, Better Auth sign-in, staff roles, and session flows. Stage 2 adds jobs, public careers, applications, private resumes, and recruiting audit events. Stage 3 adds the application pipeline, history, notes, candidate view, and filters. The original briefs are preserved in [`phase-1-requirements.md`](phase-1-requirements.md), [`phase-2-requirements.md`](phase-2-requirements.md), and [`phase-3-requirements.md`](phase-3-requirements.md).

## Local setup

Use Node 24 and pnpm 11.18.0. The local database is the opt-in PostgreSQL container from the Drizzle block. Start it from the project root with a stable, unique Compose project name and explicit file:

```sh
docker compose -p morrow-dev -f compose.dev.yaml up -d --wait
```

`.env.local` is ignored by Git. The generated local file uses the Drizzle example's loopback-only database URL and a random `BETTER_AUTH_SECRET`; do not use those local database credentials in production. If the file is missing, create it with:

```dotenv
DATABASE_URL=postgresql://neander_dev:neander_dev_only@127.0.0.1:55432/neander_dev
BETTER_AUTH_SECRET=<a new random secret of at least 32 bytes>
BETTER_AUTH_URL=http://127.0.0.1:3000
```

Then migrate and launch:

```sh
unset DATABASE_URL
node --env-file=.env.local .neander/migrate.mjs
pnpm dev
```

Open `http://127.0.0.1:3000`. The first visit goes to setup when the database has no workspace; otherwise it goes to sign-in. Keep `.env.local` private. `pnpm db:migrate` is the convenience command for local migration and expects `.env.local`.

Stop the local database without deleting its data:

```sh
docker compose -p morrow-dev -f compose.dev.yaml down
```

## First Admin and role checks

1. Visit `/setup`, enter the company name, your name, a work email, and a password of at least 12 characters. The first successful setup creates the workspace and makes that account Admin.
2. Sign in at `/login`. From **Staff**, invite one test account for each of Recruiter, Hiring Manager, and Interviewer. Copy each generated link and open it in a separate browser profile to set a name and password. Links are single-use and expire after seven days.
3. Sign in as each role. All roles can use Dashboard, Jobs, Applications, and their own Profile. Only Admin sees Staff; entering `/staff` as another role returns to Dashboard, and staff APIs return `403`.
4. As Admin, change a test user's role and verify the new access on the next request. Deactivate a test user and verify their existing session ends and sign-in is rejected. The workspace always retains at least one active Admin.
5. Use **Reset password** on an active staff account. Copy and share the generated one-hour link through a trusted channel, then set a new password. The link is one-time; existing passwords are not shown.

For a clean local database, `pnpm test:phase1` runs an HTTP integration check across all four roles, invitations, access denial, reset, deactivation, logout, and health. It creates and removes its test workspace and must only be run against the documented disposable local database.

There is no email provider configured, so the app **does not send invite or password-reset emails**. Invitations and Admin-generated reset links are shown for copying instead. Do not paste those links into public channels.

## Stage 2 review

Apply the tracked Drizzle migration with `pnpm db:migrate`, then launch `pnpm dev`. Staff sign in at `/login`; the public careers page is `/careers` and does not require a staff account.

1. As Admin or Recruiter, open **Jobs**, create a job with its department, location, employment type, remote setting, description, hiring manager, and any Interviewers. Edit it, publish it, close it, and reopen it. The Jobs list supports status filtering and links to the job's applications.
2. Sign in as the assigned Hiring Manager and Interviewer. Confirm each sees only assigned jobs and related applications. Try job create/edit/status APIs as either role; they must return `403`.
3. Open `/careers` in a logged-out browser. Confirm only Published jobs appear. Open a Draft URL directly and confirm it is not found; open a Closed job URL and confirm the “no longer accepting applications” message.
4. Submit a PDF and a real DOCX. Also try a renamed non-document file, an empty file, a file larger than 5 MB, and a second application with the same email/job. Errors should be clear and preserve the typed form fields. The same email can apply to a different job.
5. Confirm the success page appears after submission. Open the application as Admin/Recruiter and as assigned staff, download its resume, then retry its direct download URL while logged out and as staff assigned to a different job; both must be denied.
6. As Admin, check **Recent audit activity** on Jobs after creating/editing/publishing/closing/reopening jobs and receiving an application. Confirm the actor and time appear; non-Admins cannot read `/api/audit`.

`pnpm test:phase2` runs the local database-backed API checks against the documented local app/database. Set `PHASE2_ADMIN_EMAIL` and `PHASE2_ADMIN_PASSWORD` in the shell to an existing local Admin account before running it. The script creates uniquely named temporary staff, jobs, candidates, applications, and audit events, then removes only those uniquely named test records; it does not reset or delete the workspace. The focused unit checks run with `pnpm test`.

## Stage 3 review

Apply the additive migration with `pnpm db:migrate` before previewing Stage 3. The migration adds per-application stage history and notes, constrains stage values, and backfills each existing application with its current stage and a null actor; it does not clear or reset Stage 2 data. Then launch the app with `pnpm dev`.

1. From **Applications**, search by a candidate name or email, and combine the search with job and stage filters. As a Hiring Manager or Interviewer, verify the choices and results include only assigned jobs even when searching for another job's candidate.
2. Open an application, move it through Applied, Screening, Interview, Offer, Hired, or Rejected as Admin or Recruiter. As a Hiring Manager, move only an assigned application's stage. As an Interviewer, confirm the stage control is unavailable and the API rejects direct changes. Open another application from the same candidate and confirm its stage/history remains separate.
3. Add notes as assigned staff. Confirm the author and time are shown, newest notes appear first, another user cannot delete them, and the author or an Admin can delete them. There is no note editing action.
4. Open a candidate from an application. Confirm the page shows only applications accessible to the signed-in staff member; a candidate with no accessible applications returns not found.
5. As Admin, check **Recent audit activity** for stage changes and notes added or deleted. Non-Admins must continue to receive `403` from `/api/audit`.

`pnpm test:phase3` runs the local database-backed API checks. Set `PHASE3_ADMIN_EMAIL` and `PHASE3_ADMIN_PASSWORD` in the shell for an existing local Admin. It creates uniquely named staff, jobs, candidates, applications, notes, and audit events and removes only its own test records. Run it only against the documented local database after applying migrations; it never resets the workspace. `pnpm test` includes the focused role and stage-policy tests.

## Stage 4 review

Stage 4 adds the Admin-only `/audit` page with action, actor, and inclusive date-range filters plus 25-entry pagination. It uses the existing `audit_event` table, so no database migration is required. Invitation acceptance and Admin-generated password reset links are now recorded alongside staff invitations, role changes, deactivations and reactivations, job actions, applications, stage changes, and note changes.

1. Sign in as Admin and open **Audit**. Combine action, user, and date filters; move between pages; verify each entry identifies the actor, affected record, and time. Follow links to records that still exist.
2. As another role, open `/audit` directly and request `/api/audit`; the page returns to Dashboard and the API returns `403`. While logged out, `/audit` redirects to sign-in and `/api/audit` returns `401`.
3. As Admin, create an invitation, accept it, change a staff role, generate a password reset link, and deactivate then reactivate a test account. Confirm each action appears in Audit. Existing job, application, stage, and note actions should also appear there.
4. At 375 px wide, check Dashboard, Jobs, Staff, Applications, application details, Candidate details, and public Careers/apply pages. Confirm the page itself does not scroll sideways and long names or email addresses wrap instead of being shortened.

`pnpm test:phase3` also checks audit action/user/date filtering, multi-page results, invitation acceptance and reset-link events, Admin-only page/API access, logged-out and unassigned resume denials, and the password-reset origin check. It uses the existing PHASE3 credentials and temporary local fixtures described above; it does not reset the workspace.

The permission matrix below describes the implemented behavior. Private page access is checked by the server-side private layout; record APIs and resume downloads independently enforce workspace and assignment access. `/api/health`, `/careers`, application submission, and unguessable invite/reset-token flows remain intentionally public.

Resume bytes are stored in PostgreSQL in the `application.resume_data` column. In production this is the managed Neon database declared by `.neander/compose.yaml`, not the web app's local filesystem, so application and resume records remain when the app is redeployed as long as the same persistent Neon database is retained. Local development data instead lives in the PostgreSQL Compose volume from `compose.dev.yaml`; publishing does not copy local database records to Neon. Back up the managed database under the organization's normal retention policy.

## Permission matrix

| Capability | Admin | Recruiter | Hiring Manager | Interviewer |
| --- | --- | --- | --- | --- |
| Workspace and staff roster | Manage workspace staff, roles, invitations, deactivation, and reactivation | Use own account; no roster access | Use own account; no roster access | Use own account; no roster access |
| Own profile and sign-in | View/update own profile; sign in/out; reset by Admin link | Same | Same | Same |
| Dashboard / Candidates | Workspace overview; all accessible candidates | Workspace overview; all accessible candidates | Assigned-job overview and candidate applications only | Assigned-job overview and candidate applications only |
| Jobs | Create/edit/publish/close/reopen; view all workspace jobs | Create/edit/publish/close/reopen; view all workspace jobs | View jobs assigned as hiring manager; no changes | View jobs assigned as interviewer; no changes |
| Public careers page and applications | Public page requires no login; Admin can view all workspace applications | Public page requires no login; Recruiter can view all workspace applications | View/download applications only for assigned jobs | View/download applications only for assigned jobs |
| Resume downloads | Private; server checks workspace/job access on every download | Same | Assigned jobs only | Assigned jobs only |
| Full audit page and API | View all workspace staff, job, application, stage, and note events; filter and paginate | No access | No access | No access |
| Application pipeline | Move stages for all workspace applications; add notes; delete any note; view application history and accessible candidate views | Move stages for all workspace applications; add notes; delete own notes; view application history and accessible candidate views | Move stages and add notes only for assigned jobs; delete own notes; view assigned candidate applications | View assigned applications; add notes; delete own notes; cannot change stages |
| Search and filters | Search/filter all applications by name, email, job, and stage | Same | Search/filter assigned applications only | Search/filter assigned applications only |

## Database and deployment notes

All recruiting-domain tables include `workspace_id`; application-to-job, application-to-candidate, job-to-assignment, and related domain links enforce matching workspace IDs; placeholder future-domain tables do not provide interview, scorecard or offer workflows. Same-job duplicate applications are prevented by a database uniqueness constraint on workspace, job, and normalized applicant email. Staff membership is unique to the one workspace. The migration is generated and tracked by Drizzle; Better Auth tables are generated by the pinned `auth` CLI. Do not hand-edit Better Auth's schema or use `auth migrate`.

Local Docker PostgreSQL checks prove local connectivity/migration only. They do not prove Neon provisioning or a production deployment. The production recipe declares provisioned Neon `DATABASE_URL`, provisioned public-origin `BETTER_AUTH_URL`, generated `BETTER_AUTH_SECRET` with `provider: null`, the public `/api/health` probe, and the `nextjs-drizzle` migration profile. Production migrations run as a separate deployment step, never during build or startup.

`/api/health` remains public and unauthenticated. Auth routes accept only sign-in, sign-out, session lookup, and token-based password reset; unauthenticated public account creation is not exposed. Invite/reset tokens are random, one-use credentials; invitations are stored by token hash, and generated reset URLs are encrypted at rest until the Admin copies them.
