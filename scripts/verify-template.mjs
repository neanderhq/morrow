// Exercise only a built image and an explicitly selected disposable database.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import pg from 'pg';
import { makePdf, makeDocx } from './fixtures/resume.mjs';
import { checkBrowserJourneys } from './check-browser-journeys.mjs';
import { checkNextRecruiting } from './check-next-recruiting.mjs';
import { checkRejectionDelivery, controlledEmailProvider, fixtureCredential, fixturePort, fixtureSender } from './check-rejection-delivery.mjs';

const exec = promisify(execFile);
const JOB = 'b1000000-0000-4000-8000-000000000001';
const DRAFT = 'b1000000-0000-4000-8000-000000000003';
const APPLICATION = 'd1000000-0000-4000-8000-000000000001';
async function run(command, args, options = {}) {
  try { const r = await exec(command, args, { timeout: 240000, maxBuffer: 16 * 1024 * 1024, ...options }); process.stdout.write(r.stdout); process.stderr.write(r.stderr); }
  catch (error) { process.stdout.write(error.stdout || ''); process.stderr.write(error.stderr || ''); throw error; }
}
async function main() {
  const image = process.env.NEANDER_TEMPLATE_IMAGE, databaseUrl = process.env.NEANDER_TEMPLATE_TEST_DATABASE_URL;
  const password = process.env.DEMO_PASSWORD, secret = process.env.BETTER_AUTH_SECRET;
  assert.ok(image && databaseUrl && password && secret, 'Use a built image, explicitly disposable database and generated test secrets');
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  const origin = new URL(process.env.BETTER_AUTH_URL);
  assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname));
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname));
  const directory = await mkdtemp(join(tmpdir(), 'morrow-check-')), name = `morrow-check-${randomUUID().slice(0, 12)}`;
  const db = new pg.Client({ connectionString: databaseUrl });
  let browser, connected = false;
  const names = [];
  async function ready(url) {
    for (let attempt = 0; attempt < 120; attempt++) {
      try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {}
      await delay(500);
    }
    throw new Error('Morrow production image did not become ready');
  }
  async function start(containerName, url, connection, extraEnvironment = "") {
    const runtimeDb = new URL(connection);
    if (process.platform === 'darwin') runtimeDb.hostname = 'host.docker.internal';
    const file = join(directory, `${containerName}.env`);
    await writeFile(file, `DATABASE_URL=${runtimeDb.href}\nBETTER_AUTH_URL=${url}\nBETTER_AUTH_SECRET=${secret}\n${extraEnvironment}`, { mode: 0o644 });
    const port = new URL(url).port || 80;
    const network = process.platform === 'linux' ? ['--network', 'host', '--env', `PORT=${port}`] : ['--publish', `127.0.0.1:${port}:8080`];
    await exec('docker', ['run', '--detach', '--name', containerName, '--mount', `type=bind,src=${file},dst=/run/secrets/neander_environment,readonly`, ...network, image], { timeout: 60000 });
    names.push(containerName); await ready(url);
  }
  async function json(response, status = 200) { assert.equal(response.status(), status, await response.text()); return response.json(); }
  try {
    await db.connect(); connected = true;
    await start(name, origin.origin, databaseUrl);
    const snapshot = (await db.query('SELECT id,title,state FROM job ORDER BY id')).rows;
    assert.equal(snapshot.length, 3);
    const hashes = (await db.query('SELECT id,password FROM account ORDER BY id')).rows;
    await run('pnpm', ['db:seed']);
    assert.deepEqual((await db.query('SELECT id,title,state FROM job ORDER BY id')).rows, snapshot);
    assert.deepEqual((await db.query('SELECT id,password FROM account ORDER BY id')).rows, hashes);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM application')).rows[0].n, 5);
    await run('pnpm', ['exec', 'playwright', 'install', ...(process.platform === 'linux' ? ['--with-deps'] : []), 'chromium']);
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } }), page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(origin.origin); assert.match(await page.title(), /Morrow/);
    await page.getByLabel('Email address', { exact: true }).fill('admin@morrow.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Good to see you, Avery', exact: true }).waitFor();
    const capture = process.env.MORROW_CAPTURE_DIRECTORY;
    if (capture) { await mkdir(join(capture, 'screenshots'), { recursive: true }); await page.screenshot({ path: join(capture, 'thumbnail.png') }); }
    await page.goto(`${origin.origin}/jobs`);
    await page.getByRole('heading', { name: 'Jobs', exact: true }).waitFor();
    await page.getByText('Senior Product Engineer', { exact: true }).first().waitFor();
    if (capture) await page.screenshot({ path: join(capture, 'screenshots/jobs.png') });
    await page.goto(`${origin.origin}/applications/${APPLICATION}`);
    await page.getByRole('heading', { name: 'Alex Rivera', exact: true }).waitFor();
    await page.getByText('Sample review note: discuss this fictional candidate at the next hiring sync.', { exact: true }).waitFor();
    if (capture) await page.screenshot({ path: join(capture, 'screenshots/application.png') });
    const anonymous = await browser.newContext(), publicPage = await anonymous.newPage();
    await publicPage.goto(`${origin.origin}/careers`);
    await publicPage.getByText('Senior Product Engineer', { exact: true }).first().waitFor();
    await publicPage.getByText('Product Designer', { exact: true }).first().waitFor();
    assert.equal(await publicPage.getByText('Customer Success Lead', { exact: true }).count(), 0);
    if (capture) await publicPage.screenshot({ path: join(capture, 'screenshots/careers.png') });
    assert.equal((await anonymous.request.get(`${origin.origin}/api/applications`)).status(), 401);
    assert.equal((await anonymous.request.get(`${origin.origin}/api/applications/${APPLICATION}/resume`)).status(), 401);
    assert.equal((await anonymous.request.get(`${origin.origin}/careers/${DRAFT}`)).status(), 404);
    const resume = await context.request.get(`${origin.origin}/api/applications/${APPLICATION}/resume`);
    assert.equal(resume.status(), 200); assert.deepEqual(await resume.body(), makePdf());
    assert.equal(resume.headers()['content-type'], 'application/pdf');
    assert.equal(resume.headers()['x-content-type-options'], 'nosniff');
    assert.match(resume.headers()['content-disposition'], /^attachment;/);
    const detail = await json(await context.request.get(`${origin.origin}/api/jobs`));
    const editedTitle = `Template edit ${randomUUID().slice(0, 8)}`;
    const job = detail.jobs.find(item => item.id === JOB);
    await json(await context.request.patch(`${origin.origin}/api/jobs/${JOB}`, {
      headers: { origin: origin.origin },
      data: { ...job, title: editedTitle, interviewerIds: ['morrow-demo-interviewer'] },
    }));
    // Real uploads; fresh browser identity for this independent applicant fixture.
    await json(await anonymous.request.post(`${origin.origin}/api/application-client`, { headers: { origin: origin.origin } }));
    const uploaded = [];
    for (const [extension, bytes, mimeType] of [['pdf', makePdf(), 'application/pdf'], ['docx', makeDocx(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]) {
      const email = `smoke-${randomUUID()}@candidate.test`;
      const fields = { fullName: 'Fictional Upload Candidate', email, resume: { name: `sample.${extension}`, mimeType, buffer: bytes } };
      const applied = await json(await anonymous.request.post(`${origin.origin}/api/careers/${JOB}/applications`, { headers: { origin: origin.origin }, multipart: fields }), 201);
      uploaded.push(applied.applicationId);
      assert.equal((await anonymous.request.post(`${origin.origin}/api/careers/${JOB}/applications`, { headers: { origin: origin.origin }, multipart: fields })).status(), 409);
      const saved = await context.request.get(`${origin.origin}/api/applications/${applied.applicationId}/resume`);
      assert.equal(saved.status(), 200); assert.deepEqual(await saved.body(), bytes);
    }
    // The retained cookie limit must still reject the sixth valid submission attempt.
    const throttled = await anonymous.request.post(`${origin.origin}/api/careers/${JOB}/applications`, {
      headers: { origin: origin.origin }, multipart: { fullName: 'Throttled Fixture', email: `throttled-${randomUUID()}@candidate.test`, resume: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: makePdf() } },
    });
    // Four attempts above (two duplicates count), fifth accepted, sixth must be 429.
    const fifth = await json(throttled, 201); uploaded.push(fifth.applicationId);
    assert.equal((await anonymous.request.post(`${origin.origin}/api/careers/${JOB}/applications`, {
      headers: { origin: origin.origin }, multipart: { fullName: 'Throttled Fixture', email: `blocked-${randomUUID()}@candidate.test`, resume: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: makePdf() } },
    })).status(), 429);
    await run('pnpm', ['db:seed']); await exec('docker', ['restart', name], { timeout: 60000 }); await ready(origin.origin);
    assert.equal((await json(await context.request.get(`${origin.origin}/api/jobs`))).jobs.find(item => item.id === JOB).title, editedTitle);
    for (const id of uploaded) assert.equal((await context.request.get(`${origin.origin}/api/applications/${id}`)).status(), 200);
    // Prove authentication throttling still applies to one client. Independent
    // role fixtures below use separate synthetic /64s rather than one shared IP.
    const loginClient = `2001:db8:${randomUUID().replaceAll('-', '').slice(0,4)}:abcd::1`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const limited = await anonymous.request.post(`${origin.origin}/api/auth/sign-in/email`, {
        headers: { origin: origin.origin, 'x-forwarded-for': loginClient },
        data: { email: 'unknown@morrow.test', password: 'Fictional-wrong-password!' },
      });
      assert.equal(limited.status(), attempt < 3 ? 401 : 429);
    }
    await checkBrowserJourneys(browser, context, origin.origin, JOB);
    await anonymous.close();
    const integrationEnv = { ...process.env, PHASE2_ADMIN_EMAIL: 'admin@morrow.test', PHASE2_ADMIN_PASSWORD: password, PHASE3_ADMIN_EMAIL: 'admin@morrow.test', PHASE3_ADMIN_PASSWORD: password };
    await run(process.execPath, ['scripts/check-phase2.mjs', origin.origin], { env: integrationEnv });
    await run(process.execPath, ['scripts/check-phase3.mjs', origin.origin], { env: integrationEnv });
    const restart = async () => {
      await exec('docker', ['restart', name], { timeout: 60000 });
      await ready(origin.origin);
    };
    const featureCaptures = capture ? join(capture, 'next-recruiting') : null;
    await checkNextRecruiting(browser, context, origin.origin, password, featureCaptures, db, restart);
    await context.close();

    const emailOrigin = new URL(origin);
    emailOrigin.port = String(Number(origin.port || 80) + 2);
    const emailName = name + '-email';
    const fixtureEndpoint = 'http://127.0.0.1:' + fixturePort;
    const fixtureEnv = [
      'MORROW_TEST_EMAIL_ENDPOINT=' + fixtureEndpoint + '/emails',
      'MORROW_RESEND_API_KEY=' + fixtureCredential,
      'MORROW_EMAIL_FROM=' + fixtureSender, '',
    ].join('\n');
    await start(emailName, emailOrigin.origin, databaseUrl, fixtureEnv);
    await exec('docker', ['exec', '-d', emailName, 'node', '-e', ...controlledEmailProvider]);
    const providerAttempts = async () => {
      const { stdout } = await exec('docker', ['exec', emailName, 'node', '-e',
        'fetch(process.argv[1]).then(r => r.text()).then(console.log)', fixtureEndpoint + '/stats']);
      return JSON.parse(stdout);
    };
    for (let i = 0; i < 20; i++) {
      try { await providerAttempts(); break; } catch (error) {
        if (i === 19) throw error;
        await delay(250);
      }
    }
    await checkRejectionDelivery(browser, emailOrigin.origin, password, featureCaptures, providerAttempts, async () => {
      await exec('docker', ['restart', emailName], { timeout: 60000 });
      await ready(emailOrigin.origin);
    });
    await browser.close(); browser = undefined;
    // Exercise first-workspace bootstrap in a separate disposable database, retaining all phase1 assertions.
    const bootstrapName = `morrow_phase1_${randomUUID().replaceAll('-', '')}`;
    const bootstrapUrl = new URL(databaseUrl); bootstrapUrl.pathname = `/${bootstrapName}`;
    const bootstrapOrigin = new URL(origin); bootstrapOrigin.port = String(Number(origin.port || 80) + 1);
    await db.query(`CREATE DATABASE "${bootstrapName}"`);
    try {
      const env = { ...process.env, DATABASE_URL: bootstrapUrl.href, NEANDER_TEMPLATE_TEST_DATABASE_URL: bootstrapUrl.href };
      await run(process.execPath, ['.neander/migrate.mjs'], { env });
      await start(`${name}-bootstrap`, bootstrapOrigin.origin, bootstrapUrl.href);
      await run(process.execPath, ['scripts/check-phase1.mjs', bootstrapOrigin.origin], { env });
    } finally {
      await exec('docker', ['rm', '--force', `${name}-bootstrap`], { timeout: 30000 }).catch(() => {});
      await db.query(`DROP DATABASE "${bootstrapName}" WITH (FORCE)`);
    }
    console.log('PASS: Morrow built-image/browser, fictional data, repeat seed preservation, real PDF/DOCX uploads/private resumes, duplicate and submission limit, persistent edits; retained four-role bootstrap and phase2/3 recruiting/API suites.');
  } finally {
    await browser?.close();
    if (connected) await db.end();
    for (const container of names) await exec('docker', ['rm', '--force', container], { timeout: 30000 }).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
