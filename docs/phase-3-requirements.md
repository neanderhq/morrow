Next stage of the recruiting app: the candidate pipeline. Keep everything from stages 1 and 2 working. PR #1 was squash-merged into main, so first make sure your working branch is up to date with main before you change anything.

1. Pipeline stages

- Each application moves through these stages: Applied, Screening, Interview, Offer, Hired, Rejected.
- Admins and Recruiters can move any application. Hiring Managers can move applications only for jobs they are assigned to. Interviewers can view their assigned applications but cannot change stages.
- Every stage change is saved with who changed it and when, and shown as a history on the application page. Each application has its own history: if the same candidate applied to two jobs, moving one application must not change the other.

2. Notes

- Staff who can see an application can add notes to it. Notes show the author and the time, newest first.
- Notes cannot be edited by other users. Only the author or an Admin can delete a note.

3. Search and filters

- On the Applications page: search by candidate name or email, and filter by job and by stage. Filters can be combined, and the results must respect each role's access (a Hiring Manager or Interviewer never sees applications from jobs they are not assigned to, even through search).

4. Candidate view

- A candidate page that lists all applications of that candidate (one per job) with the current stage of each, visible only to staff who can see at least one of those applications, and showing only the applications that user is allowed to see.

5. Audit trail

- Record stage changes and notes added or deleted in the audit trail.

When you finish:

- Commit and push first, before any long verification, so the work is saved. Then run the checks, verify the pages in the preview, and open a PR into main.
- Tell me how to test each part and list any limitation.

Implementation expectations: Every API query must be workspace scoped and authorize on server. Access to an application (including candidate page and mutation) must use existing `canAccessApplication` access rules. Stage transitions only allowed in exact enum set; record immutable audit/history actor+timestamp and ensure history is by application id, never candidate. New notes belong to workspace and application; GET visible to all who can access, POST add note (same), DELETE only author/admin, no edit endpoint/UI. Stage change Admin/Recruiter anywhere; Hiring Manager only assigned job (not interviewer); verify with server check not client role. Filter by stage/job/search combined in DB query after assignment scope to avoid information leaks. Candidate detail must show only accessible applications and 404 when none; don't expose inaccessible app count or other-job details. Add safe API errors and CSRF/origin protection for writes in line with project. Stage 3 migration is additive and preserves Stage 2/applicant data; backfill existing applications into stage_history with current stage/actor null, plus created stage when new public application is submitted (consider capturing applicant or a neutral initial actor); no destructive SQL. Add focused policy tests + full isolated-DB integration covering stages, two applications for same candidate, change isolation, roles/assignment, notes, deletion rules, composed search/filter, candidate visibility and audit. Update project docs/role matrix, stage setup/testing guidance, and maintain stages 1/2. Do not create competing starter or unrelated refactor.

Target paths:
- docs/**
- app/(private)/applications/**
- app/(private)/candidates/**
- app/api/applications/**
- app/api/candidates/**
- app/api/audit/route.ts
- components/applications-list.tsx
- components/application-pipeline.tsx
- server/schema.ts
- server/policy.ts
- server/recruiting.ts
- drizzle/**
- scripts/check-phase3.mjs
- package.json
- tests/**

Follow existing project style. Keep changes scoped to the request.
