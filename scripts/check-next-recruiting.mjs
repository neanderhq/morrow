import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const JOB = 'b1000000-0000-4000-8000-000000000001';
const APPLICATION = 'd1000000-0000-4000-8000-000000000001';
const INTERVIEWER = 'morrow-demo-interviewer';

export async function json(response, status = 200) {
  assert.equal(response.status(), status, await response.text());
  return response.json();
}

export async function signIn(browser, origin, email, password, viewport = { width: 375, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await json(await context.request.post(origin + '/api/auth/sign-in/email', {
    headers: { origin, 'x-forwarded-for': '2001:db8:' + randomUUID().slice(0,4) + ':ef12::1' },
    data: { email, password },
  }));
  return context;
}

export async function screen(page, section, name, output) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(widths.document, widths.viewport, name + ' document must not overflow');
  const box = await section.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= widths.viewport + 1, name + ' section fits');
  if (output) {
    await mkdir(output, { recursive: true });
    await section.screenshot({ path: join(output, name + '.png') });
  }
}

async function keyFocus(page, locator) {
  for (let count = 0; count < 40; count++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail('Tab did not reach ' + await locator.getAttribute('id'));
}

export async function checkNextRecruiting(browser, admin, origin, password, capture, db, restart) {
  const paths = (part, id = APPLICATION) => origin + '/api/applications/' + id + '/' + part;
  const options = { origin };
  const post = (ctx, part, data, id) => ctx.request.post(paths(part, id), { headers: options, data });
  const get = (ctx, part, id) => ctx.request.get(paths(part, id));
  const appPath = origin + '/applications/' + APPLICATION;
  const peerEmail = 'feedback-' + randomUUID().slice(0,8) + '@morrow.test';
  const peerName = 'Fictional Panel Interviewer';

  await json(await admin.request.post(origin + '/api/invitations', { headers: options, data: { email: peerEmail, role: 'interviewer' } }), 201);
  const { invitations } = await json(await admin.request.get(origin + '/api/invitations'));
  const invite = invitations.find((item) => item.email === peerEmail);
  assert.ok(invite?.inviteUrl);
  await json(await admin.request.post(origin + '/api/invitations/accept', {
    headers: options, data: { name: peerName, password, token: new URL(invite.inviteUrl).pathname.split('/').at(-1) },
  }), 201);
  const { staff } = await json(await admin.request.get(origin + '/api/staff'));
  const peerId = staff.find((item) => item.email === peerEmail)?.userId;
  assert.ok(peerId);
  const { jobs } = await json(await admin.request.get(origin + '/api/jobs'));
  const job = jobs.find((item) => item.id === JOB);
  await json(await admin.request.patch(origin + '/api/jobs/' + JOB, {
    headers: options, data: { ...job, interviewerIds: [INTERVIEWER, peerId] },
  }));

  const manager = await signIn(browser, origin, 'manager@morrow.test', password);
  const interviewer = await signIn(browser, origin, 'interviewer@morrow.test', password);
  const peer = await signIn(browser, origin, peerEmail, password);
  const mobileAdmin = await browser.newContext({ viewport: { width: 375, height: 900 }, storageState: await admin.storageState(),
    reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const unsubscribed = await browser.newContext();
  try {
    for (const part of ['scorecards','interviews','rejection-email']) {
      assert.equal((await get(unsubscribed, part)).status(), 401);
      assert.equal((await get(admin, part, randomUUID())).status(), 404);
      const crossWorkspaceId = randomUUID();
      const workspaceId = randomUUID();
      const foreignUserId = 'fixture-other-' + randomUUID();
      const foreignJobId = randomUUID();
      const foreignCandidateId = randomUUID();
      await db.query('INSERT INTO workspace(id,name,singleton_key) VALUES ($1,$2,$3)', [workspaceId, 'Separate fictional workspace', workspaceId]);
      await db.query('INSERT INTO "user"(id,name,email) VALUES ($1,$2,$3)', [foreignUserId, 'Fictional Workspace Owner', foreignUserId + '@morrow.test']);
      await db.query('INSERT INTO job(id,workspace_id,title,created_by) VALUES ($1,$2,$3,$4)', [foreignJobId, workspaceId, 'Other workspace job', foreignUserId]);
      await db.query('INSERT INTO candidate(id,workspace_id,name) VALUES ($1,$2,$3)', [foreignCandidateId, workspaceId, 'Other workspace candidate']);
      await db.query('INSERT INTO application(id,workspace_id,job_id,candidate_id) VALUES ($1,$2,$3,$4)', [crossWorkspaceId, workspaceId, foreignJobId, foreignCandidateId]);
      assert.equal((await get(admin, part, crossWorkspaceId)).status(), 404);
      assert.equal((await post(admin, part, {}, crossWorkspaceId)).status(), 404);
      await db.query('DELETE FROM application WHERE id=$1', [crossWorkspaceId]);
      await db.query('DELETE FROM workspace WHERE id=$1', [workspaceId]);
      await db.query('DELETE FROM "user" WHERE id=$1', [foreignUserId]);
    }

    const page = await mobileAdmin.newPage();
    await page.goto(appPath);
    const score = page.locator('#interview-feedback');
    const criteria = score.getByLabel('Rubric criteria', { exact: true });
    await criteria.fill('Explains a design tradeoff');
    await score.getByRole('button', { name: 'Save job rubric' }).press('Enter');
    await score.getByRole('alert').getByText(/enter 2–8 distinct criteria/i).waitFor();
    assert.equal(await criteria.inputValue(), 'Explains a design tradeoff');
    await criteria.fill('Explains a design tradeoff\nUses evidence to validate a change');
    await criteria.focus();
    await keyFocus(page, score.getByRole('button', { name: 'Save job rubric' }));
    await page.keyboard.press('Enter');
    await score.getByText('Job rubric saved.', { exact: true }).waitFor();
    await score.getByRole('checkbox', {name:'Casey Brooks'}).press('Space');
    await score.getByRole('checkbox', {name:peerName}).press('Space');
    await score.getByRole('button', {name:'Assign scorecards'}).press('Enter');
    await score.getByText('Rubric version 1 · 0 of 2 submitted', {exact:true}).waitFor();
    await screen(page, score, 'scorecard-assignment-phone', capture);

    assert.equal((await post(manager,'scorecards',{ action:'assign',interviewerIds:[INTERVIEWER] })).status(), 403);
    assert.equal((await post(admin,'scorecards',{ action:'assign',interviewerIds:['morrow-demo-manager'] })).status(), 400);
    const interviewerPage = await interviewer.newPage();
    await interviewerPage.goto(appPath);
    const editor = interviewerPage.locator('#interview-feedback');
    assert.equal(await editor.getByText(peerName, { exact: true }).count(),0);
    await editor.getByRole('button', {name:'Submit scorecard'}).press('Enter');
    await editor.getByRole('alert').getByText(/rate every criterion/i).waitFor();
    await editor.getByLabel('Explains a design tradeoff', {exact:true}).selectOption('4');
    const notes = editor.getByLabel('Written evidence', {exact:true});
    await notes.focus();
    await interviewerPage.keyboard.type('Fictional evidence on design tradeoffs.');
    await keyFocus(interviewerPage, editor.getByRole('button', {name:'Save draft'}));
    await interviewerPage.keyboard.press('Enter');
    await editor.getByText('Scorecard draft saved.', {exact:true}).waitFor();
    await interviewerPage.reload();
    await notes.waitFor();
    assert.equal(await notes.inputValue(), 'Fictional evidence on design tradeoffs.');
    const peerState = await json(await get(peer,'scorecards'));
    assert.equal(peerState.cards.length, 1);
    assert.equal(peerState.yourCard.notes, '');
    const managerPending = await json(await get(manager,'scorecards'));
    assert.equal(managerPending.cards.length, 2);
    assert.ok(managerPending.cards.every((row) => row.notes === null && row.ratings === null));
    await json(await post(admin,'scorecards',{ action:'rubric',version:1,criteria:['New job-related prompt','Another specific criterion'] }));
    assert.equal((await json(await get(peer,'scorecards'))).round.version, 1);
    await screen(interviewerPage, editor, 'scorecard-draft-phone', capture);

    const savedDraft = await json(await get(interviewer,'scorecards'));
    const submission = { action:'submit', revision:savedDraft.yourCard.revision, ratings:[4,3], notes:'Fictional evidence on design tradeoffs.', recommendation:'debrief' };
    assert.equal((await post(interviewer,'scorecards',{ ...submission, action:'draft',revision:0 })).status(),409);
    await editor.getByLabel('Uses evidence to validate a change',{exact:true}).selectOption('3');
    await editor.getByLabel('Recommendation',{exact:true}).selectOption('debrief');
    await keyFocus(interviewerPage, editor.getByRole('button',{name:'Submit scorecard'}));
    await interviewerPage.keyboard.press('Enter');
    await editor.getByText('Scorecard submitted.',{exact:true}).waitFor();
    assert.ok((await json(await post(interviewer,'scorecards',submission))).yourCard.submittedAt);
    assert.equal((await post(interviewer,'scorecards',{...submission,notes:'Different replay'})).status(),409);
    const jobStatus = (action) => admin.request.post(origin + '/api/jobs/' + JOB + '/status', { headers:options, data:{action} });
    await json(await jobStatus('close'));
    assert.equal((await post(peer,'scorecards',{action:'draft',revision:0,ratings:[null,null],notes:'',recommendation:''})).status(),409);
    await json(await jobStatus('reopen'));
    await json(await post(peer,'scorecards',{action:'draft',revision:0,ratings:[null,null],notes:'Peer private draft',recommendation:''}));
    assert.equal((await json(await get(manager,'scorecards'))).cards.find((row)=>row.interviewerId===peerId).notes,null);
    assert.equal((await json(await get(manager,'scorecards'))).cards.find((row)=>row.interviewerId===INTERVIEWER).notes,submission.notes);

    await page.reload();
    const schedule = page.locator('#manual-interviews');
    await schedule.getByRole('button',{name:'Schedule interview'}).press('Enter');
    const form = schedule.getByRole('form',{name:'New interview'});
    const interviewerField = form.getByLabel('Interviewer',{exact:true});
    await interviewerField.waitFor();
    assert.ok(await interviewerField.evaluate((element)=>element===document.activeElement));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Schedule interview');
    await schedule.getByRole('button',{name:'Schedule interview'}).press('Enter');
    await interviewerField.selectOption(INTERVIEWER);
    await form.getByLabel('Time zone').fill('Asia/Kolkata');
    await form.getByLabel('Start time').fill('2030-02-12T15:30');
    await form.getByLabel('End time').fill('2030-02-12T15:00');
    const location = form.getByLabel('Location or meeting link');
    await location.fill('Fictional recruiting room');
    await form.getByRole('button',{name:'Save interview'}).press('Enter');
    await schedule.getByRole('alert').getByText(/end time must follow/i).waitFor();
    assert.equal(await location.inputValue(),'Fictional recruiting room');
    await form.getByLabel('End time').fill('2030-02-12T16:15');
    await screen(page, schedule, 'interview-editor-phone', capture);
    await location.focus();
    await keyFocus(page, form.getByRole('button',{name:'Save interview'}));
    await page.keyboard.press('Enter');
    await schedule.getByText('Interview scheduled.',{exact:true}).waitFor();
    const booking = (await json(await get(admin,'interviews'))).bookings[0];
    assert.equal(booking.startsAt,'2030-02-12T10:00:00.000Z');
    assert.equal(booking.endsAt,'2030-02-12T10:45:00.000Z');
    assert.equal((await json(await get(interviewer,'interviews'))).bookings.length,1);
    assert.equal((await json(await get(peer,'interviews'))).bookings.length,0);
    assert.equal((await post(manager,'interviews',{action:'cancel',id:booking.id,revision:0})).status(),403);
    const overlap = { action:'schedule', interviewerId:INTERVIEWER, start:'2030-02-12T05:00',end:'2030-02-12T05:45',timeZone:'America/New_York',location:'Other room' };
    assert.equal((await post(admin,'interviews',{...overlap,id:randomUUID()})).status(),409);
    const date = await json(await post(admin,'interviews',{...overlap,id:booking.id,action:'reschedule',revision:0}));
    assert.equal(date.bookings[0].startsAt,booking.startsAt);
    assert.equal((await post(admin,'interviews',{...overlap,id:booking.id,action:'reschedule',revision:0})).status(),409);
    await page.reload();
    await schedule.getByRole('button',{name:'Copy interview details'}).press('Enter');
    await schedule.getByText('Interview details copied. Share them with the candidate.',{exact:true}).waitFor();
    assert.match(await page.evaluate(()=>navigator.clipboard.readText()), /America\/New_York \(45 minutes\)/);
    await schedule.getByRole('button',{name:'Cancel interview',exact:true}).press('Enter');
    await schedule.getByRole('button',{name:'Confirm cancellation'}).press('Enter');
    await schedule.getByText('Interview cancelled.',{exact:true}).waitFor();
    await screen(page,schedule,'interview-cancelled-phone',capture);
    await restart();
    assert.equal((await json(await get(admin,'interviews'))).bookings[0].status,'cancelled');
    assert.equal((await json(await get(admin,'interviews'))).history.length,3);
    assert.ok((await json(await get(interviewer,'scorecards'))).yourCard.submittedAt);

    const desktopPage = await admin.newPage();
    await desktopPage.goto(appPath);
    await desktopPage.locator('#interview-feedback').getByText('Feedback progress',{exact:true}).waitFor();
    await screen(desktopPage,desktopPage.locator('#interview-feedback'),'scorecard-progress-desktop',capture);
    await desktopPage.locator('#manual-interviews').getByText('Cancelled',{exact:true}).waitFor();
    await screen(desktopPage,desktopPage.locator('#manual-interviews'),'interview-details-desktop',capture);
    const email = await json(await get(admin,'rejection-email'));
    assert.equal(email.configured,false);
    assert.equal((await post(admin,'rejection-email',{action:'prepare',id:randomUUID(),subject:'Fictional',body:'Fictional',stageEventId:email.stageEventId})).status(),409);
    assert.equal((await get(manager,'rejection-email')).status(),403);
    await desktopPage.locator('#rejection-email').getByText(/rejection email is unconfigured/i).waitFor();
    await desktopPage.close();
    console.log('PASS: Built scorecard rubric snapshot, isolated drafts, roles, replay and job-close recovery; manual time zone, role, replay, clipboard and restart; unconfigured email state; keyboard and 375 px.');
  } finally {
    await Promise.all([manager,interviewer,peer,mobileAdmin,unsubscribed].map((context)=>context.close()));
  }
}
