Next stage of the recruiting app: jobs, the public careers page and applications with resume upload. Keep everything from stage 1 working (workspace, roles, login, reset links, permissions). Keep working in this same project and branch.

1. Jobs (staff side)
- Admins and Recruiters can create and edit jobs: title, department, location, employment type (full time, part time, contract), remote option, description, and the hiring manager assigned to the job.
- Job status: Draft, Published, Closed. Admins and Recruiters can publish, close and reopen a job. Reopening puts it back to Published.
- Hiring Managers and Interviewers can only see the jobs they are assigned to, and cannot create, edit, publish, close or reopen jobs.
- The Jobs page lists jobs with their status and number of applications, with a filter by status.

2. Public careers page
- A public page, no login needed, listing only Published jobs, and a page for each job with its details and an Apply form.
- Draft and Closed jobs must not be visible on the public page, and must not accept applications even if someone opens the job URL or calls the API directly. A Closed job shows a clear "no longer accepting applications" message.
- When a Closed job is reopened, it appears again and accepts new applications. Applications received before closing are kept.

3. Application form
- Fields: full name, email, phone (optional), LinkedIn or portfolio link (optional), resume file (required), short cover note (optional).
- Resume must be PDF or DOCX, maximum 5 MB. Check the real file type, not only the file name. Show a clear error for a wrong type, an empty file or a file that is too big, and keep the other fields filled in.
- One candidate (identified by email) cannot apply twice to the same job: show a clear message on the second attempt. The same candidate can apply to different jobs, and each application keeps its own status and history.
- After applying, show a confirmation page.

4. Resume privacy and storage
- Resumes are private. There must be no public link to a resume file. Only logged-in staff who are allowed to see that application can view or download it, and the server checks this on every download. Logged-out users and staff without access must be denied, even with the direct URL.
- Resumes and applications must survive restarts and future redeploys of the published app. Tell me where resumes are stored and why they will not be lost when the app is published again.

5. Audit trail
- Record who did what and when for job actions (created, edited, published, closed, reopened) and for new applications. A simple list for Admins is enough for now; a full audit page will come later.

When you finish:
- Make sure the preview runs with the database, then commit and push. Also merge this work into the main branch so it can be published, and tell me if anything blocks that.
- Tell me how to test each part, and list any limitation.

Technical scope and safety: retain existing Stage 1 auth/roles/session/invite/reset flows; use tenant/workspace scoping and server-side authorization on every new private page/API. Admins/Recruiters manage jobs. Hiring Managers and Interviewers can only view jobs to which they are assigned; if the existing job model only stores a hiring manager, extend it safely with assignment(s) for interviewer access while retaining the selected hiring manager field. Admin/Recruiter may see all workspace applications; other roles may view/download only applications for assigned jobs. Public endpoints must query Published jobs only and independently reject application submissions for Draft/Closed jobs. Validate actual file bytes (PDF signature and DOCX ZIP contents/required document structure), not file extension or client MIME alone; reject empty and >5 MiB. Preserve form input when upload validation fails. Prevent duplicate same-job applications with a database uniqueness constraint and clear response. Store resume bytes in the durable PostgreSQL database (not local filesystem), enforcing access for every download; explain in docs that this uses the persistent managed database across app redeploys, and distinguish local dev DB data. Capture actor and timestamp for each listed job transition/edit/create and each successful application. Keep a proper Drizzle migration; do not hand-edit generated Better Auth schema or weaken deployment contract. Update docs setup/permission matrix appropriately. Add database-backed integration tests plus focused unit tests. Read the relevant installed Next.js 16.3.4 documentation in node_modules/next/dist/docs before code edits per AGENTS.md. Maintain the existing Next/app design system and mobile layout. Do not run destructive database commands on the existing project data. Preserve pre-existing setup files and unrelated worktree edits (notably next-env.d.ts). At completion report checks performed, note any unverified behavior honestly, and return launch command, cwd and expected local preview URL; the parent agent will start/review preview and handle Git operations.

Target paths:
- app/**
- components/**
- server/**
- drizzle/**
- docs/**
- package.json
- pnpm-lock.yaml
- scripts/**
- tests/**
- .neander/**

Follow existing project style. Keep changes scoped to the request.
