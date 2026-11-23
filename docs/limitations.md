# Delivered scope and known limitations

Morrow implements accepted recruiting **Phase 1**: a shared workspace, four staff
roles, sessions/manual invitation and reset flows, jobs/public careers,
applications with private PDF/DOCX resumes, candidates, per-application stages and
notes, search/filters and actor/time audit. Historical guides call its delivered
increments Stages 1–4; these are not later product phases. Placeholder schema
tables do not establish implemented features.

Interview scheduling/scorecards, tasks/reminders, offers/approvals,
reporting/CSV/retention and Google/Microsoft integrations are not implemented.
The template requires no additional paid service, provider or delivery account.

## Accounts and recovery

Invitation and password-reset delivery is **manual**. An Admin copies a one-time
link and shares it privately; no email is sent. Never put bearer links or tokens
in public issues, screenshots or logs.

If a signed-out sole Admin forgets their password, there is no self-service
recovery flow. Authorized support/database intervention is required. Delivery
included a proposed database-recovery procedure, but it has **not been
independently executed or verified**. This repository does not run that procedure.
Have an operational recovery plan before real use; template seeding is not a
password-recovery mechanism.

## Submissions and data

The public application throttle uses a signed browser cookie. It limits repeated
submissions with that cookie, but clients can obtain a new cookie and bypass it.
It is not a robust per-person or trusted-IP abuse boundary. Evaluate abuse
exposure before accepting real applicants; no new submission-cap service or proxy
integration is included.

There is no candidate/application delete route or retention workflow. Resume
bytes are private PostgreSQL records; deployments need an authorized backup and
data-lifecycle policy. Role checks alone do not establish compliance or a complete
production ATS.

Seeds contain fictional records only. Repeated seeding preserves subsequent edits
and passwords. Never point seeds or tests at an original/live customer workspace.
