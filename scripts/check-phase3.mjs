import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { makePdf } from './fixtures/resume.mjs';

const origin = process.argv[2];
const connectionString = process.env.DATABASE_URL;
const adminEmail = process.env.PHASE3_ADMIN_EMAIL;
const adminPassword = process.env.PHASE3_ADMIN_PASSWORD;
assert.ok(origin, 'Pass the local app origin, for example http://localhost:3000');
assert.ok(connectionString, 'DATABASE_URL is required');
assert.ok(adminEmail && adminPassword, 'Set PHASE3_ADMIN_EMAIL and PHASE3_ADMIN_PASSWORD to an existing local Admin account');
const originUrl = new URL(origin);
const databaseUrl = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname), 'This test only runs against a local app');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), 'This test only runs against a local database');
assert.equal(connectionString, process.env.NEANDER_TEMPLATE_TEST_DATABASE_URL, 'Use only the explicitly selected disposable test database');

const database = new Client({ connectionString });
const suffix = randomUUID();
const prefix = `phase3-${suffix}`;
const password = `PhaseThree!${suffix}`;
const accounts = [
  { role: 'recruiter', name: `${prefix} Recruiter`, email: `${prefix}-recruiter@example.invalid` },
  { role: 'hiring_manager', name: `${prefix} Manager One`, email: `${prefix}-manager-one@example.invalid` },
  { role: 'hiring_manager', name: `${prefix} Manager Two`, email: `${prefix}-manager-two@example.invalid` },
  { role: 'interviewer', name: `${prefix} Interviewer`, email: `${prefix}-interviewer@example.invalid` },
];
const testEmails = accounts.map(({ email }) => email);
const candidateEmail = `${prefix}-candidate@example.invalid`;
const privateCandidateEmail = `${prefix}-private@example.invalid`;
const jobIds = [];
const applicationIds = [];
const noteIds = [];
let connected = false;

async function call(path, { method = 'GET', body, cookie, formData, clientIp } = {}) {
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
    method, headers, ...(body ? { body: JSON.stringify(body) } : {}), ...(formData ? { body: formData } : {}),
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

async function createJob(cookie, title, hiringManagerId, interviewerIds = []) {
  const result = await call('/api/jobs', { method: 'POST', cookie, body: {
    title, department: 'Engineering', location: 'Remote', employmentType: 'full_time', remote: true,
    description: 'A synthetic Stage 3 pipeline integration job.', hiringManagerId, interviewerIds,
  } });
  assert.equal(result.response.status, 201, JSON.stringify(result.json));
  jobIds.push(result.json.job.id);
  return result.json.job.id;
}

async function publishJob(cookie, jobId) {
  return call(`/api/jobs/${jobId}/status`, { method: 'POST', cookie, body: { action: 'publish' } });
}

async function apply(jobId, email, name) {
  const form = new FormData();
  form.set('fullName', name);
  form.set('email', email);
  form.set('resume', new Blob([makePdf()], { type: 'application/pdf' }), 'resume.pdf');
  return call(`/api/careers/${jobId}/applications`, { method: 'POST', formData: form });
}

async function addNote(cookie, applicationId, body) {
  const result = await call(`/api/applications/${applicationId}/notes`, { method: 'POST', cookie, body: { body } });
  assert.equal(result.response.status, 201, JSON.stringify(result.json));
  noteIds.push(result.json.note.id);
  return result.json.note;
}

try {
  await database.connect();
  connected = true;
  const admin = await signIn({ email: adminEmail }, adminPassword);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.json));
  assert.ok(admin.cookie);

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
  const recruiter = staff.get('recruiter');
  const managerOne = staff.get(accounts[1].email);
  const managerTwo = staff.get(accounts[2].email);
  const interviewer = staff.get('interviewer');
  const staffRows = (await call('/api/staff', { cookie: admin.cookie })).json.staff;
  const memberId = (email) => staffRows.find((row) => row.email === email)?.userId;
  recruiter.account.id = memberId(recruiter.account.email);
  const jobOne = await createJob(admin.cookie, `${prefix} Job One`, memberId(accounts[1].email), [memberId(accounts[3].email)]);
  const jobTwo = await createJob(admin.cookie, `${prefix} Job Two`, memberId(accounts[2].email));
  assert.equal((await publishJob(admin.cookie, jobOne)).response.status, 200);
  assert.equal((await publishJob(admin.cookie, jobTwo)).response.status, 200);

  const first = await apply(jobOne, candidateEmail, 'Shared Stage Three Candidate');
  const second = await apply(jobTwo, candidateEmail, 'Shared Stage Three Candidate');
  const privateApplication = await apply(jobOne, privateCandidateEmail, 'Private Search Fixture');
  for (const result of [first, second, privateApplication]) {
    assert.equal(result.response.status, 201, JSON.stringify(result.json));
    applicationIds.push(result.json.applicationId);
  }
  const [firstId, secondId, privateId] = applicationIds;
  const firstDetail = await call(`/api/applications/${firstId}`, { cookie: admin.cookie });
  const secondDetail = await call(`/api/applications/${secondId}`, { cookie: admin.cookie });
  const candidateId = firstDetail.json.application.candidateId;
  assert.equal(firstDetail.response.status, 200);
  assert.equal(secondDetail.json.application.candidateId, candidateId);

  const initialHistory = firstDetail.json.stageHistory;
  assert.equal(initialHistory.length, 1);
  assert.equal(initialHistory[0].toStage, 'applied');
  assert.equal(initialHistory[0].actorName, null);
  assert.equal((await call(`/api/applications/${firstId}/stage`, { method: 'PATCH', cookie: admin.cookie, body: { stage: 'screening' } })).response.status, 200);
  const isolated = await call(`/api/applications/${secondId}`, { cookie: admin.cookie });
  assert.equal(isolated.json.application.stage, 'applied');
  assert.equal(isolated.json.stageHistory.length, 1, 'Stage history belongs to application, not candidate');

  assert.equal((await call(`/api/applications/${firstId}/stage`, { method: 'PATCH', cookie: managerOne.cookie, body: { stage: 'interview' } })).response.status, 200);
  assert.equal((await call(`/api/applications/${secondId}/stage`, { method: 'PATCH', cookie: managerOne.cookie, body: { stage: 'offer' } })).response.status, 403);
  assert.equal((await call(`/api/applications/${firstId}/stage`, { method: 'PATCH', cookie: interviewer.cookie, body: { stage: 'offer' } })).response.status, 403);
  assert.equal((await call(`/api/applications/${firstId}/stage`, { method: 'PATCH', cookie: recruiter.cookie, body: { stage: 'offer' } })).response.status, 200);
  assert.equal((await call(`/api/applications/${firstId}/stage`, { method: 'PATCH', cookie: admin.cookie, body: { stage: 'withdrawn' } })).response.status, 400);

  const candidateForManagerTwo = await call(`/api/candidates/${candidateId}`, { cookie: managerTwo.cookie });
  assert.equal(candidateForManagerTwo.response.status, 200);
  assert.equal(candidateForManagerTwo.json.applications.length, 1);
  assert.equal(candidateForManagerTwo.json.applications[0].id, secondId);
  const inaccessibleCandidate = await call(`/api/applications/${privateId}`, { cookie: managerTwo.cookie });
  assert.equal(inaccessibleCandidate.response.status, 403);
  const privateDetail = await call(`/api/applications/${privateId}`, { cookie: admin.cookie });
  assert.equal((await call(`/api/candidates/${privateDetail.json.application.candidateId}`, { cookie: managerTwo.cookie })).response.status, 404);

  const recruiterNote = await addNote(recruiter.cookie, firstId, 'Recruiter review note');
  const managerNote = await addNote(managerOne.cookie, firstId, 'Hiring manager follow-up');
  const notes = await call(`/api/applications/${firstId}/notes`, { cookie: interviewer.cookie });
  assert.equal(notes.response.status, 200);
  assert.equal(notes.json.notes[0].id, managerNote.id, 'Notes are listed newest first');
  assert.equal((await call(`/api/applications/${firstId}/notes/${recruiterNote.id}`, { method: 'DELETE', cookie: managerOne.cookie })).response.status, 403);
  assert.equal((await call(`/api/applications/${firstId}/notes/${managerNote.id}`, { method: 'DELETE', cookie: managerOne.cookie })).response.status, 200);
  assert.equal((await call(`/api/applications/${firstId}/notes/${recruiterNote.id}`, { method: 'DELETE', cookie: recruiter.cookie })).response.status, 200);

  const filtered = await call(`/api/applications?job=${jobOne}&stage=offer&search=${encodeURIComponent('Shared Stage Three Candidate')}`, { cookie: recruiter.cookie });
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.json.applications.length, 1);
  assert.equal(filtered.json.applications[0].id, firstId);
  const hiddenSearch = await call(`/api/applications?search=${encodeURIComponent('Shared Stage Three Candidate')}`, { cookie: managerOne.cookie });
  assert.equal(hiddenSearch.response.status, 200);
  assert.equal(hiddenSearch.json.applications.some((application) => application.id === secondId), false);
  assert.equal((await call(`/api/applications?job=${jobTwo}&stage=applied&search=${encodeURIComponent('Shared Stage Three Candidate')}`, { cookie: managerOne.cookie })).json.applications.length, 0);

  const adminHistory = await call(`/api/applications/${firstId}`, { cookie: admin.cookie });
  assert.equal(adminHistory.json.stageHistory.at(-1).toStage, 'offer');
  assert.equal(adminHistory.json.stageHistory.at(-1).actorName, recruiter.account.name);
  const adminProfile = await call('/api/me', { cookie: admin.cookie });
  const adminWorkspace = await database.query('SELECT workspace_id FROM workspace_member WHERE user_id = $1 AND active = true', [adminProfile.json.id]);
  assert.equal(adminWorkspace.rowCount, 1);
  for (let index = 0; index < 27; index += 1) {
    await database.query(
      `INSERT INTO audit_event (workspace_id, actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'application.note_added', 'application', $3, $4::jsonb)`,
      [adminWorkspace.rows[0].workspace_id, recruiter.account.id, firstId, JSON.stringify({ noteId: randomUUID(), testMarker: prefix })],
    );
  }
  const auditPage = await call('/api/audit', { cookie: admin.cookie });
  assert.equal(auditPage.response.status, 200);
  assert.equal(auditPage.json.pagination.pageSize, 25);
  for (const action of ['application.stage_changed', 'application.note_added', 'application.note_deleted']) {
    const history = await call(`/api/audit?action=${action}`, { cookie: admin.cookie });
    assert.equal(history.response.status, 200);
    assert.ok(history.json.events.some(event => event.recordHref === `/applications/${firstId}` && event.action === action));
  }
  const today = new Date().toISOString().slice(0, 10);
  const filteredAudit = await call(`/api/audit?action=application.note_added&userId=${recruiter.account.id}&from=${today}&to=${today}`, { cookie: admin.cookie });
  assert.equal(filteredAudit.response.status, 200);
  assert.ok(filteredAudit.json.pagination.total >= 27);
  assert.equal(filteredAudit.json.events.length, 25);
  const nextAuditPage = await call(`/api/audit?action=application.note_added&userId=${recruiter.account.id}&from=${today}&to=${today}&page=2`, { cookie: admin.cookie });
  assert.equal(nextAuditPage.json.pagination.page, 2);
  assert.ok(nextAuditPage.json.events.length > 0);
  assert.equal(new Set([...filteredAudit.json.events, ...nextAuditPage.json.events].map((event) => event.id)).size, filteredAudit.json.events.length + nextAuditPage.json.events.length);
  const inviteAccepted = await call(`/api/audit?action=staff.invitation_accepted&userId=${recruiter.account.id}`, { cookie: admin.cookie });
  assert.equal(inviteAccepted.json.events.some((event) => event.action === 'staff.invitation_accepted'), true);
  const recruiterMembership = staffRows.find((row) => row.email === recruiter.account.email);
  const resetLink = await call(`/api/staff/${recruiterMembership.id}/reset-link`, { method: 'POST', cookie: admin.cookie });
  assert.equal(resetLink.response.status, 200, JSON.stringify(resetLink.json));
  const resetAudit = await call(`/api/audit?action=staff.reset_link_created&userId=${adminProfile.json.id}`, { cookie: admin.cookie });
  assert.equal(resetAudit.json.events.some((event) => event.action === 'staff.reset_link_created' && event.recordHref === `/staff#staff-${recruiterMembership.id}`), true);
  assert.equal((await call('/api/audit')).response.status, 401);
  assert.equal((await call('/api/audit', { cookie: recruiter.cookie })).response.status, 403);
  const crossOriginReset = await fetch(new URL('/api/auth/reset-password', origin), {
    method: 'POST',
    headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'invalid-token', newPassword: password }),
  });
  assert.equal(crossOriginReset.status, 403);
  const loggedOutAuditPage = await fetch(new URL('/audit', origin), { redirect: 'manual' });
  assert.equal(loggedOutAuditPage.status, 307);
  assert.equal(new URL(loggedOutAuditPage.headers.get('location'), origin).pathname, '/login');
  const recruiterAuditPage = await fetch(new URL('/audit', origin), { headers: { cookie: recruiter.cookie }, redirect: 'manual' });
  assert.equal(recruiterAuditPage.status, 307);
  assert.equal(new URL(recruiterAuditPage.headers.get('location'), origin).pathname, '/dashboard');
  const loggedOutApplicationPage = await fetch(new URL(`/applications/${privateId}`, origin), { redirect: 'manual' });
  assert.equal(loggedOutApplicationPage.status, 307);
  assert.equal(new URL(loggedOutApplicationPage.headers.get('location'), origin).pathname, '/login');
  const inaccessibleApplicationPage = await fetch(new URL(`/applications/${privateId}`, origin), { headers: { cookie: managerTwo.cookie }, redirect: 'manual' });
  assert.equal(inaccessibleApplicationPage.status, 404);
  assert.equal((await call(`/api/applications/${privateId}/resume`)).response.status, 401);
  assert.equal((await call(`/api/applications/${privateId}/resume`, { cookie: managerTwo.cookie })).response.status, 403);
  console.log('Stage 3–4 local integration passed: pipeline permissions and isolation, notes, filters, candidate access, full Admin audit filters and pagination, staff audit events, and private access denials.');
} finally {
  if (connected) {
    try {
      await database.query('BEGIN');
      await database.query(
        `DELETE FROM audit_event
         WHERE entity_id = ANY($1::text[])
            OR entity_id = ANY($2::text[])
            OR details->>'noteId' = ANY($3::text[])
            OR details->>'email' = ANY($4::text[])
            OR actor_user_id IN (SELECT id FROM "user" WHERE email = ANY($4::text[]))`,
        [applicationIds, jobIds, noteIds, testEmails],
      );
      await database.query('DELETE FROM application WHERE id = ANY($1::uuid[])', [applicationIds]);
      await database.query('DELETE FROM job_assignment WHERE job_id = ANY($1::uuid[])', [jobIds]);
      await database.query('DELETE FROM job WHERE id = ANY($1::uuid[])', [jobIds]);
      await database.query('DELETE FROM candidate WHERE email = ANY($1::text[])', [[candidateEmail, privateCandidateEmail]]);
      await database.query('DELETE FROM staff_invitation WHERE email = ANY($1::text[])', [testEmails]);
      await database.query('DELETE FROM workspace_member WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1::text[]))', [testEmails]);
      await database.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [testEmails]);
      await database.query('COMMIT');
    } catch (cleanupError) {
      await database.query('ROLLBACK').catch(() => {});
      console.error('Stage 3 test cleanup failed; remove only the uniquely named phase3 test data:', cleanupError);
      process.exitCode = 1;
    }
    await database.end();
  }
}
