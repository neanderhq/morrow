import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const origin = process.argv[2];
const connectionString = process.env.DATABASE_URL;
assert.ok(origin, 'Pass the local app origin, for example http://localhost:3000');
assert.ok(connectionString, 'DATABASE_URL is required');
const originUrl = new URL(origin);
const databaseUrl = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname), 'This test only runs against a local app');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), 'This test only runs against a local database');
assert.equal(connectionString, process.env.NEANDER_TEMPLATE_TEST_DATABASE_URL, 'Use only the explicitly selected disposable test database');

const database = new Client({ connectionString });
await database.connect();
const existing = await database.query('SELECT id FROM workspace LIMIT 1');
assert.equal(existing.rowCount, 0, 'Use a clean local database; the test creates and removes the first workspace');

const suffix = randomUUID();
const password = 'PhaseOne-Test-Password!';
const newPassword = 'PhaseOne-New-Password!';
const accounts = [
  { role: 'admin', name: 'Phase One Admin', email: `phase-admin-${suffix}@example.invalid` },
  { role: 'recruiter', name: 'Phase One Recruiter', email: `phase-recruiter-${suffix}@example.invalid` },
  { role: 'hiring_manager', name: 'Phase One Hiring Manager', email: `phase-manager-${suffix}@example.invalid` },
  { role: 'interviewer', name: 'Phase One Interviewer', email: `phase-interviewer-${suffix}@example.invalid` },
];

async function call(path, { method = 'GET', body, cookie, redirect = 'follow', clientIp } = {}) {
  const response = await fetch(new URL(path, origin), {
    method,
    redirect,
    headers: {
      origin,
      ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function signIn(account, secret) {
  const { response, json } = await call('/api/auth/sign-in/email', {
    method: 'POST', body: { email: account.email, password: secret }, clientIp: `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 4)}:${randomUUID().replaceAll('-', '').slice(0, 4)}::1`,
  });
  const cookie = response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  return { response, json, cookie };
}

try {
  const health = await call('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal((await call('/api/staff')).response.status, 401);

  const setup = await call('/api/setup', {
    method: 'POST',
    body: { workspaceName: 'Phase One Test Workspace', name: accounts[0].name, email: accounts[0].email, password },
  });
  assert.equal(setup.response.status, 201, JSON.stringify(setup.json));
  const admin = await signIn(accounts[0], password);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.json));
  assert.ok(admin.cookie, 'Admin login should create a server session cookie');
  assert.equal((await call('/api/staff', { cookie: admin.cookie })).response.status, 200);
  assert.equal((await call('/api/profile', { cookie: admin.cookie })).response.status, 200);
  assert.equal((await call('/profile', { redirect: 'manual' })).response.status, 307, 'Private pages redirect anonymous visitors to login');

  for (const account of accounts.slice(1)) {
    const invitation = await call('/api/invitations', {
      method: 'POST', cookie: admin.cookie, body: { email: account.email, role: account.role },
    });
    assert.equal(invitation.response.status, 201, JSON.stringify(invitation.json));
    const pending = await call('/api/invitations', { cookie: admin.cookie });
    assert.equal(pending.response.status, 200);
    const link = pending.json.invitations.find(row => row.email === account.email)?.inviteUrl;
    assert.ok(link, 'Admin can retrieve the one-time invitation link');
    const token = new URL(link).pathname.split('/').at(-1);
    const accepted = await call('/api/invitations/accept', {
      method: 'POST', body: { token, name: account.name, password },
    });
    assert.equal(accepted.response.status, 201, JSON.stringify(accepted.json));
    assert.equal((await call('/api/invitations/accept', {
      method: 'POST', body: { token, name: account.name, password },
    })).response.status, 400, 'Invitation token must be single-use');
  }

  const sessions = new Map();
  for (const account of accounts.slice(1)) {
    const session = await signIn(account, password);
    assert.equal(session.response.status, 200, JSON.stringify(session.json));
    sessions.set(account.role, session.cookie);
    assert.equal((await call('/api/profile', { cookie: session.cookie })).response.status, 200);
    assert.equal((await call('/api/staff', { cookie: session.cookie })).response.status, 403);
    assert.equal((await call('/api/invitations', { method: 'POST', cookie: session.cookie, body: { email: `blocked-${suffix}@example.invalid`, role: 'recruiter' } })).response.status, 403);
    if (account.role === 'recruiter') {
      const privatePage = await call('/staff', { cookie: session.cookie, redirect: 'manual' });
      assert.equal(privatePage.response.status, 307, 'Non-Admin staff page requests are redirected');
      assert.equal(new URL(privatePage.response.headers.get('location'), origin).pathname, '/dashboard');
    }
  }

  const staff = await call('/api/staff', { cookie: admin.cookie });
  const recruiter = staff.json.staff.find((row) => row.email === accounts[1].email);
  assert.ok(recruiter);
  assert.equal((await call(`/api/staff/${recruiter.id}/role`, { method: 'PATCH', cookie: sessions.get('recruiter'), body: { role: 'admin' } })).response.status, 403);
  assert.equal((await call(`/api/staff/${recruiter.id}/role`, { method: 'PATCH', cookie: admin.cookie, body: { role: 'hiring_manager' } })).response.status, 200);
  assert.equal((await call(`/api/staff/${recruiter.id}/role`, { method: 'PATCH', cookie: admin.cookie, body: { role: 'recruiter' } })).response.status, 200);

  const reset = await call(`/api/staff/${recruiter.id}/reset-link`, { method: 'POST', cookie: admin.cookie });
  assert.equal(reset.response.status, 200, JSON.stringify(reset.json));
  const resetPage = await call(reset.json.resetUrl, { redirect: 'manual' });
  assert.ok([301, 302, 303, 307, 308].includes(resetPage.response.status));
  const callback = new URL(resetPage.response.headers.get('location'));
  assert.equal(callback.pathname, '/reset-password');
  const resetToken = callback.searchParams.get('token');
  assert.ok(resetToken);
  const passwordUpdate = await call('/api/auth/reset-password', { method: 'POST', body: { token: resetToken, newPassword } });
  assert.equal(passwordUpdate.response.status, 200, JSON.stringify(passwordUpdate.json));
  assert.equal((await signIn(accounts[1], password)).response.status, 401);
  assert.equal((await signIn(accounts[1], newPassword)).response.status, 200);
  assert.notEqual((await call('/api/auth/reset-password', { method: 'POST', body: { token: resetToken, newPassword: password } })).response.status, 200);

  const deactivate = await call(`/api/staff/${recruiter.id}/deactivate`, { method: 'POST', cookie: admin.cookie });
  assert.equal(deactivate.response.status, 200);
  assert.equal((await call('/api/profile', { cookie: sessions.get('recruiter') })).response.status, 401);
  assert.equal((await signIn(accounts[1], newPassword)).response.status, 401);
  const logout = await call('/api/auth/sign-out', { method: 'POST', cookie: admin.cookie, body: {} });
  assert.equal(logout.response.status, 200);
  assert.equal((await call('/api/profile', { cookie: admin.cookie })).response.status, 401);
  console.log('Phase 1 local integration passed: bootstrap, four roles, invite use, authorization, role edits, password reset, deactivation, logout, and public health.');
} finally {
  await database.query('DELETE FROM workspace WHERE singleton_key = $1', ['primary']);
  await database.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [accounts.map((account) => account.email)]);
  await database.end();
}
