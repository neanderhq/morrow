import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { json, screen, signIn } from './check-next-recruiting.mjs';

const APPLICATION = 'd1000000-0000-4000-8000-000000000001';
const CANCEL = 'd1000000-0000-4000-8000-000000000002';
const FAIL = 'd1000000-0000-4000-8000-000000000003';
const UNKNOWN = 'd1000000-0000-4000-8000-000000000004';
const SIBLING = 'd1000000-0000-4000-8000-000000000005';

export const fixturePort = 9183;
export const fixtureSender = 'recruiting@morrow.test';
export const fixtureCredential = 'morrow-fixture-disposable-runtime';

// Executed in the network namespace of the built app container, on loopback.
export const controlledEmailProvider = [String.raw`
const http = require('node:http');
const attempts = [];
const byRequest = new Map();
http.createServer(async (req, res) => {
  const send = (status, value) => {
    res.writeHead(status, {'content-type': 'application/json'});
    res.end(JSON.stringify(value));
  };
  if (req.url === '/stats' && req.method === 'GET') return send(200, attempts);
  if (req.method !== 'POST' || req.url !== '/emails' || req.headers.authorization !== 'Bearer ' + process.argv[1])
    return send(401, {name:'unauthorized'});
  let raw = '';
  for await (const part of req) raw += part;
  const body = JSON.parse(raw);
  const key = req.headers['idempotency-key'];
  if (!key?.startsWith('morrow-rejection/') || body.from !== process.argv[2] ||
      !body.to.every(x => /@candidate\.test$/.test(x)))
    return send(400, {name:'validation_error'});
  const previous = byRequest.get(key) || 0;
  byRequest.set(key, previous + 1);
  attempts.push({key, body});
  if (body.subject === 'Fixture definite failure' && !previous) return send(422, {name:'validation_error'});
  if (body.subject === 'Fixture uncertain outcome') return send(503, {name:'application_error'});
  return send(200, {id:'fixture-provider-' + key.split('/')[1]});
}).listen(Number(process.argv[3]), '127.0.0.1');
`, fixtureCredential, fixtureSender, String(fixturePort)];

export async function checkRejectionDelivery(browser, origin, password, capture, providerAttempts, restart) {
  const admin = await signIn(browser, origin, 'admin@morrow.test', password);
  const recruiter = await signIn(browser, origin, 'recruiter@morrow.test', password);
  const restricted = await signIn(browser, origin, 'interviewer@morrow.test', password);
  const desktop = await signIn(browser, origin, 'admin@morrow.test', password, { width: 1440, height: 1000 });
  const path = (id) => origin + '/api/applications/' + id + '/rejection-email';
  const read = async (id) => json(await admin.request.get(path(id)));
  const post = (id, data, ctx = admin) => ctx.request.post(path(id), { headers: {origin}, data });
  const stage = (id, value) => admin.request.patch(origin + '/api/applications/' + id + '/stage', {
    headers:{origin},data:{stage:value},
  });
  const draft = async (id, subject) => ({action:'prepare',id:randomUUID(),stageEventId:(await read(id)).stageEventId,
    subject,body:'Fictional candidate update with a job-specific outcome.',recipient:'wrong@example.test'});
  try {
    const page = await admin.newPage();
    await page.goto(origin + '/applications/' + APPLICATION);
    const email = page.locator('#rejection-email');
    const open = email.getByRole('button',{name:'Prepare rejection email'});
    await open.press('Enter');
    const preview = email.getByRole('form',{name:'Rejection email preview'});
    const subjectField = preview.getByLabel('Subject',{exact:true});
    await subjectField.waitFor();
    await page.waitForFunction(()=>document.activeElement?.id==='rejection-subject');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Prepare rejection email');
    await open.press('Enter');
    await preview.getByText('alex@candidate.test',{exact:false}).waitFor();
    await subjectField.fill('Fixture candidate decision');
    const message = preview.getByLabel('Message',{exact:true});
    await message.fill('Fictional candidate message from the built runtime.');
    await screen(page,email,'rejection-preview-phone',capture);
    await message.focus();
    await page.keyboard.press('Tab');
    assert.ok(await preview.getByRole('button',{name:'Reject and prepare email'}).evaluate((node)=>node===document.activeElement));
    await page.keyboard.press('Enter');
    await email.getByText('Ready to send',{exact:true}).waitFor();
    const queued = (await read(APPLICATION)).messages[0];
    assert.equal(queued.status,'queued');
    assert.equal(queued.recipient,'alex@candidate.test');
    assert.equal((await providerAttempts()).length,0);
    assert.equal((await read(SIBLING)).stage,'applied');
    assert.equal((await read(SIBLING)).messages.length,0);
    assert.equal((await post(APPLICATION,{action:'send',id:queued.id},restricted)).status(),403);
    await page.reload();
    await email.getByRole('button',{name:'Send email',exact:true}).press('Enter');
    await email.getByText('Accepted by provider',{exact:true}).waitFor();
    assert.equal((await json(await post(APPLICATION,{action:'send',id:queued.id},recruiter))).messages[0].status,'accepted');
    let attempts = await providerAttempts();
    assert.equal(attempts.length,1);
    assert.equal(attempts[0].body.text,'Fictional candidate message from the built runtime.');
    assert.deepEqual(attempts[0].body.to,['alex@candidate.test']);
    assert.equal(attempts[0].body.from,fixtureSender);
    await screen(page,email,'rejection-accepted-phone',capture);
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(origin + '/applications/' + APPLICATION);
    await desktopPage.locator('#rejection-email').getByText('Accepted by provider',{exact:true}).waitFor();
    await screen(desktopPage,desktopPage.locator('#rejection-email'),'rejection-accepted-desktop',capture);

    const toCancel = await draft(CANCEL,'Fixture revoke before dispatch');
    const [first, second] = await Promise.all([post(CANCEL,toCancel),post(CANCEL,toCancel)]);
    for (const response of [first,second]) assert.equal((await json(response)).messages[0].id,toCancel.id);
    assert.equal((await read(CANCEL)).messages.length,1);
    await json(await stage(CANCEL,'interview'));
    assert.equal((await read(CANCEL)).messages[0].status,'cancelled');
    assert.equal((await post(CANCEL,{action:'send',id:toCancel.id})).status(),409);
    assert.equal((await providerAttempts()).length,1);

    const failDraft = await draft(FAIL,'Fixture definite failure');
    assert.equal((await post(FAIL,{...failDraft,subject:' '})).status(),400);
    await json(await post(FAIL,failDraft));
    const failure = await json(await post(FAIL,{action:'send',id:failDraft.id}));
    assert.equal(failure.messages[0].status,'failed');
    assert.equal((await post(FAIL,{action:'send',id:failDraft.id})).status(),409);
    assert.equal((await json(await post(FAIL,{action:'retry',id:failDraft.id}))).messages[0].status,'accepted');
    attempts = await providerAttempts();
    assert.equal(attempts.length,3);
    assert.equal(attempts[1].key,attempts[2].key);
    assert.deepEqual(attempts[1].body,attempts[2].body);

    const unknown = await draft(UNKNOWN,'Fixture uncertain outcome');
    await json(await post(UNKNOWN,unknown));
    assert.equal((await json(await post(UNKNOWN,{action:'send',id:unknown.id}))).messages[0].status,'unknown');
    assert.equal((await post(UNKNOWN,{action:'retry',id:unknown.id})).status(),409);
    assert.equal((await providerAttempts()).length,4);
    await restart();
    assert.equal((await read(APPLICATION)).messages[0].status,'accepted');
    assert.equal((await read(CANCEL)).messages[0].status,'cancelled');
    assert.equal((await read(UNKNOWN)).messages[0].status,'unknown');
    await json(await stage(SIBLING,'rejected'));
    assert.equal((await read(SIBLING)).messages.length,0);
    await json(await stage(SIBLING,'applied'));
    console.log('PASS: Built rejection email with controlled receiver, fixed recipient, provider acceptance, definite failure and retry, uncertainty, replay, restore-before-dispatch, restart and phone keyboard.');
  } finally {
    await Promise.all([admin,recruiter,restricted,desktop].map((context)=>context.close()));
  }
}
