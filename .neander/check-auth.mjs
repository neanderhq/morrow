import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { Client } from 'pg';

const origin = process.argv[2];
assert.ok(origin, 'Pass the local test app origin');
const database = new Client({ connectionString: process.env.DATABASE_URL });
await database.connect();
const id = randomUUID();
const workspaceId = randomUUID();
const token = randomUUID();
const email = `${id}@example.invalid`;
const signed = encodeURIComponent(`${token}.${createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64')}`);
const cookie = `better-auth.session_token=${signed}`;

try {
  const existing = await database.query('SELECT id FROM workspace LIMIT 1');
  assert.equal(existing.rowCount, 0, 'Use a clean local database without an existing workspace');
  await database.query('INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)', [id, 'Session test', email]);
  await database.query('INSERT INTO workspace (id,name) VALUES ($1,$2)', [workspaceId, 'Auth check workspace']);
  await database.query('INSERT INTO workspace_member (workspace_id,user_id,role,active) VALUES ($1,$2,$3,true)', [workspaceId, id, 'interviewer']);
  await database.query('INSERT INTO "session" (id,token,user_id,expires_at,created_at,updated_at) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 day\',NOW(),NOW())', [randomUUID(), token, id]);
  assert.equal((await fetch(`${origin}/api/me`)).status, 401);
  assert.equal((await fetch(`${origin}/api/me`, { headers: { cookie: `${cookie}tampered` } })).status, 401);
  const me = await fetch(`${origin}/api/me`, { headers: { cookie } });
  assert.equal(me.status, 200, await me.text());
  const bad = await fetch(`${origin}/api/auth/sign-out`, { method: 'POST', headers: { cookie, origin: 'https://attacker.invalid', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 403);
  const logout = await fetch(`${origin}/api/auth/sign-out`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(logout.status, 200, await logout.text());
  assert.equal((await fetch(`${origin}/api/me`, { headers: { cookie } })).status, 401);
  console.log('Better Auth: anonymous, tampered cookie, database session, CSRF, and server logout passed');
} finally {
  await database.query('DELETE FROM workspace WHERE id = $1', [workspaceId]);
  await database.query('DELETE FROM "user" WHERE id = $1', [id]);
  await database.end();
}
