import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { makePdf } from './fixtures/resume.mjs';

const origin = process.argv[2];
const connectionString = process.env.DATABASE_URL;
const adminEmail = process.env.PHASE2_ADMIN_EMAIL;
const adminPassword = process.env.PHASE2_ADMIN_PASSWORD;
assert.ok(origin, 'Pass the local app origin, for example http://localhost:3000');
assert.ok(connectionString, 'DATABASE_URL is required');
assert.ok(adminEmail && adminPassword, 'Set PHASE2_ADMIN_EMAIL and PHASE2_ADMIN_PASSWORD to an existing local Admin account');
const originUrl = new URL(origin);
const databaseUrl = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname), 'This test only runs against a local app');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), 'This test only runs against a local database');
assert.equal(connectionString, process.env.NEANDER_TEMPLATE_TEST_DATABASE_URL, 'Use only the explicitly selected disposable test database');

const database = new Client({ connectionString });
const suffix = randomUUID();
const password = `PhaseTwo!${suffix}`;
const prefix = `phase2-${suffix}`;
const accounts = [
  { role: 'recruiter', name: `${prefix} Recruiter`, email: `${prefix}-recruiter@example.invalid` },
  { role: 'hiring_manager', name: `${prefix} Manager One`, email: `${prefix}-manager-one@example.invalid` },
  { role: 'hiring_manager', name: `${prefix} Manager Two`, email: `${prefix}-manager-two@example.invalid` },
  { role: 'interviewer', name: `${prefix} Interviewer`, email: `${prefix}-interviewer@example.invalid` },
];
const testEmails = accounts.map((account) => account.email);
const jobTitles = [`${prefix} Platform Engineer`, `${prefix} Product Designer`];
const candidateEmails = [`${prefix}-candidate@example.invalid`, `${prefix}-returning@example.invalid`];
const jobIds = [];
const applicationIds = [];
let adminUserId;
let connected = false;

async function call(path, { method = 'GET', body, cookie, formData, redirect = 'follow', clientIp } = {}) {
  const headers = { origin };
  if (clientIp) headers['x-forwarded-for'] = clientIp;
  if (cookie) headers.cookie = cookie;
  if (body) headers['content-type'] = 'application/json';
  if (formData) {
    const identity = await fetch(new URL('/api/application-client', origin), { method: 'POST', headers: { origin } });
    assert.equal(identity.status, 200);
    headers.cookie = identity.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
  }
  const response = await fetch(new URL(path, origin), {
    method,
    redirect,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(formData ? { body: formData } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function signIn(account, accountPassword) {
  const { response, json } = await call('/api/auth/sign-in/email', {
    method: 'POST', body: { email: account.email, password: accountPassword }, clientIp: `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 4)}:${randomUUID().replaceAll('-', '').slice(0, 4)}::1`,
  });
  const cookie = response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  return { response, json, cookie };
}

function applicationForm(email, resume = makePdf()) {
  const form = new FormData();
  form.set('fullName', 'Stage Two Candidate');
  form.set('email', email);
  form.set('phone', '555-0100');
  form.set('portfolioUrl', 'https://example.invalid/portfolio');
  form.set('coverNote', 'I would be glad to speak with the team.');
  form.set('resume', new Blob([resume], { type: 'application/pdf' }), 'candidate.pdf');
  return form;
}

async function createJob(adminCookie, title, hiringManagerId, interviewerIds = []) {
  const { response, json } = await call('/api/jobs', {
    method: 'POST', cookie: adminCookie, body: {
      title, department: 'Engineering', location: 'Remote', employmentType: 'full_time', remote: true,
      description: 'Build great products with this team.', hiringManagerId, interviewerIds,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(json));
  jobIds.push(json.job.id);
  return json.job.id;
}

async function changeStatus(cookie, jobId, action) {
  return call(`/api/jobs/${jobId}/status`, { method: 'POST', cookie, body: { action } });
}

async function apply(jobId, email, fileBytes) {
  return call(`/api/careers/${jobId}/applications`, { method: 'POST', formData: applicationForm(email, fileBytes) });
}

try {
  await database.connect();
  connected = true;
  const admin = await signIn({ email: adminEmail, password: adminPassword }, adminPassword);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.json));
  assert.ok(admin.cookie, 'Existing Admin account should create a session cookie');
  const whoami = await call('/api/me', { cookie: admin.cookie });
  assert.equal(whoami.response.status, 200);
  assert.equal(whoami.json.role, 'admin');
  adminUserId = whoami.json.id;

  const staff = new Map();
  for (const account of accounts) {
    const invitation = await call('/api/invitations', { method: 'POST', cookie: admin.cookie, body: { email: account.email, role: account.role } });
    assert.equal(invitation.response.status, 201, JSON.stringify(invitation.json));
    const pending = await call('/api/invitations', { cookie: admin.cookie });
    assert.equal(pending.response.status, 200);
    const link = pending.json.invitations.find(row => row.email === account.email)?.inviteUrl;
    assert.ok(link, 'Admin can retrieve the one-time invitation link');
    const token = new URL(link).pathname.split('/').at(-1);
    const accepted = await call('/api/invitations/accept', { method: 'POST', body: { token, name: account.name, password } });
    assert.equal(accepted.response.status, 201, JSON.stringify(accepted.json));
    const session = await signIn(account, password);
    assert.equal(session.response.status, 200, JSON.stringify(session.json));
    staff.set(account.role === 'hiring_manager' ? account.email : account.role, { account, cookie: session.cookie });
  }

  const staffRows = (await call('/api/staff', { cookie: admin.cookie })).json.staff;
  const managerOne = accounts[1];
  const managerTwo = accounts[2];
  const interviewer = staff.get('interviewer');
  const recruiter = staff.get('recruiter');
  const managerOneId = staffRows.find((row) => row.email === managerOne.email)?.userId;
  const managerTwoId = staffRows.find((row) => row.email === managerTwo.email)?.userId;
  const interviewerId = staffRows.find((row) => row.email === interviewer.account.email)?.userId;
  assert.ok(managerOneId && managerTwoId && interviewerId);

  const firstJob = await createJob(admin.cookie, jobTitles[0], managerOneId, [interviewerId]);
  const secondJob = await createJob(admin.cookie, jobTitles[1], managerTwoId);
  const draftListing = await call('/api/careers');
  assert.equal(draftListing.response.status, 200);
  assert.equal(draftListing.json.jobs.some((job) => job.id === firstJob || job.id === secondJob), false, 'Draft jobs must stay off public listings');
  assert.equal((await apply(firstJob, candidateEmails[0])).response.status, 404, 'Draft jobs must reject submissions');

  const managerSession = await signIn(managerOne, password);
  assert.equal(managerSession.response.status, 200);
  let visibleJobs = (await call('/api/jobs', { cookie: managerSession.cookie })).json.jobs;
  assert.ok(visibleJobs.some((job) => job.id === firstJob));
  assert.equal(visibleJobs.some((job) => job.id === secondJob), false);
  assert.equal((await call('/api/jobs', { method: 'POST', cookie: managerSession.cookie, body: {} })).response.status, 403);
  assert.equal((await call(`/api/jobs/${firstJob}`, { method: 'PATCH', cookie: managerSession.cookie, body: {} })).response.status, 403);
  assert.equal((await changeStatus(managerSession.cookie, firstJob, 'publish')).response.status, 403);

  const editData = {
    title: jobTitles[0], department: 'Engineering', location: 'Remote', employmentType: 'full_time', remote: true,
    description: 'Build great products with this team.', hiringManagerId: managerOneId, interviewerIds: [interviewerId],
  };
  assert.equal((await call(`/api/jobs/${firstJob}`, { method: 'PATCH', cookie: recruiter.cookie, body: editData })).response.status, 200);
  assert.equal((await changeStatus(admin.cookie, firstJob, 'publish')).response.status, 200);
  assert.equal((await changeStatus(admin.cookie, secondJob, 'publish')).response.status, 200);
  const published = await call('/api/careers');
  assert.equal(published.json.jobs.some((job) => job.id === firstJob), true);

  const invalid = await apply(firstJob, candidateEmails[0], Buffer.from('not a real PDF'));
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.json.error, /valid PDF or DOCX/i);
  const empty = await apply(firstJob, candidateEmails[0], Buffer.alloc(0));
  assert.equal(empty.response.status, 400);
  assert.match(empty.json.error, /empty/i);
  const tooLarge = await apply(firstJob, candidateEmails[0], Buffer.alloc(5 * 1024 * 1024 + 1, 65));
  assert.equal(tooLarge.response.status, 400);
  assert.match(tooLarge.json.error, /5 MB/i);

  const firstApplication = await apply(firstJob, candidateEmails[0]);
  assert.equal(firstApplication.response.status, 201, JSON.stringify(firstApplication.json));
  applicationIds.push(firstApplication.json.applicationId);
  const duplicate = await apply(firstJob, candidateEmails[0].toUpperCase());
  assert.equal(duplicate.response.status, 409);
  assert.match(duplicate.json.error, /already applied/i);
  const sameCandidateOtherJob = await apply(secondJob, candidateEmails[0]);
  assert.equal(sameCandidateOtherJob.response.status, 201, JSON.stringify(sameCandidateOtherJob.json));
  applicationIds.push(sameCandidateOtherJob.json.applicationId);

  const managerApps = await call('/api/applications', { cookie: managerSession.cookie });
  assert.equal(managerApps.response.status, 200);
  assert.deepEqual(managerApps.json.applications.map((application) => application.jobId), [firstJob]);
  assert.equal((await call(`/api/applications/${sameCandidateOtherJob.json.applicationId}`, { cookie: managerSession.cookie })).response.status, 403);
  assert.equal((await call(`/api/applications/${sameCandidateOtherJob.json.applicationId}/resume`, { cookie: managerSession.cookie })).response.status, 403);
  assert.equal((await call(`/api/applications/${firstApplication.json.applicationId}/resume`)).response.status, 401);
  const managerDownload = await fetch(new URL(`/api/applications/${firstApplication.json.applicationId}/resume`, origin), { headers: { origin, cookie: managerSession.cookie } });
  assert.equal(managerDownload.status, 200);
  assert.equal(managerDownload.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await managerDownload.arrayBuffer()), makePdf());

  const interviewerDownload = await call(`/api/applications/${firstApplication.json.applicationId}`, { cookie: interviewer.cookie });
  assert.equal(interviewerDownload.response.status, 200);
  const managerTwoSession = await signIn(managerTwo, password);
  assert.equal(managerTwoSession.response.status, 200);
  assert.equal((await call(`/api/applications/${sameCandidateOtherJob.json.applicationId}`, { cookie: managerTwoSession.cookie })).response.status, 200);
  assert.equal((await call(`/api/applications/${firstApplication.json.applicationId}`, { cookie: managerTwoSession.cookie })).response.status, 403);
  assert.equal((await call('/api/applications', { cookie: recruiter.cookie })).json.applications.length >= 2, true);

  assert.equal((await changeStatus(admin.cookie, firstJob, 'close')).response.status, 200);
  const closedList = await call('/api/careers');
  assert.equal(closedList.json.jobs.some((job) => job.id === firstJob), false);
  const closedPage = await fetch(new URL(`/careers/${firstJob}`, origin));
  assert.match(await closedPage.text(), /no longer accepting applications/i);
  const closedSubmit = await apply(firstJob, candidateEmails[1]);
  assert.equal(closedSubmit.response.status, 410);
  assert.match(closedSubmit.json.error, /no longer accepting applications/i);
  assert.equal((await changeStatus(admin.cookie, firstJob, 'reopen')).response.status, 200);
  assert.equal((await call('/api/careers')).json.jobs.some((job) => job.id === firstJob), true);
  const reopenedApplication = await apply(firstJob, candidateEmails[1]);
  assert.equal(reopenedApplication.response.status, 201, JSON.stringify(reopenedApplication.json));
  applicationIds.push(reopenedApplication.json.applicationId);
  const retained = await call(`/api/applications?job=${firstJob}`, { cookie: admin.cookie });
  assert.equal(retained.json.applications.length, 2, 'Applications received before closing remain after reopen');

  const audit = await call('/api/audit', { cookie: admin.cookie });
  assert.equal(audit.response.status, 200);
  const actions = audit.json.events.filter((event) => jobIds.some(id => event.recordHref === `/jobs#job-${id}`)).map((event) => event.action);
  for (const action of ['job.created', 'job.edited', 'job.published', 'job.closed', 'job.reopened']) assert.ok(actions.includes(action), `Audit should include ${action}`);
  assert.ok(audit.json.events.some((event) => event.action === 'application.received' && applicationIds.some(id => event.recordHref === `/applications/${id}`)));
  assert.equal((await call('/api/audit', { cookie: recruiter.cookie })).response.status, 403);
  console.log('Phase 2 local integration passed: job permissions and lifecycle, public visibility, PDF validation and duplicate prevention, workspace-scoped application/resume access, reopen retention, and Admin audit activity.');
} finally {
  if (connected) {
    try {
      await database.query('BEGIN');
      await database.query(
        `DELETE FROM audit_event
         WHERE entity_id = ANY($1::text[])
            OR details->>'jobId' = ANY($1::text[])
            OR details->>'email' = ANY($2::text[])`,
        [ [...jobIds, ...applicationIds], testEmails ],
      );
      await database.query('DELETE FROM application WHERE id = ANY($1::uuid[]) OR job_id = ANY($2::uuid[]) OR applicant_email = ANY($3::text[])', [applicationIds, jobIds, candidateEmails]);
      await database.query('DELETE FROM job_assignment WHERE job_id = ANY($1::uuid[])', [jobIds]);
      await database.query('DELETE FROM job WHERE id = ANY($1::uuid[]) OR (created_by = $2 AND title = ANY($3::text[]))', [jobIds, adminUserId, jobTitles]);
      await database.query('DELETE FROM candidate WHERE email = ANY($1::text[])', [candidateEmails]);
      await database.query('DELETE FROM staff_invitation WHERE email = ANY($1::text[])', [testEmails]);
      await database.query('DELETE FROM workspace_member WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1::text[]))', [testEmails]);
      await database.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [testEmails]);
      await database.query('COMMIT');
    } catch (cleanupError) {
      await database.query('ROLLBACK').catch(() => {});
      console.error('Phase 2 test cleanup failed; remove only the uniquely named phase2 test data:', cleanupError);
      process.exitCode = 1;
    }
    await database.end();
  }
}
