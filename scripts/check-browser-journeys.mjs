import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makePdf } from './fixtures/resume.mjs';

export async function checkBrowserJourneys(browser, admin, origin, jobId) {
  const fixture = randomUUID().slice(0, 8);
  const longName = 'Fictional ' + 'LongName'.repeat(10);
  const longEmail = 'fixture-' + 'manager'.repeat(6) + fixture + '@morrow.test';
  const longJob = 'Fixture-' + fixture + '-' + 'LongTitle'.repeat(12);
  const headers = { origin };
  const invited = await admin.request.post(origin + '/api/invitations', {
    headers, data: { email: longEmail, role: 'hiring_manager' },
  });
  assert.equal(invited.status(), 201);
  const { invitations } = await (await admin.request.get(origin + '/api/invitations')).json();
  const link = invitations.find(invitation => invitation.email === longEmail)?.inviteUrl;
  assert.ok(link);
  const accepted = await admin.request.post(origin + '/api/invitations/accept', {
    headers, data: { token: new URL(link).pathname.split('/').at(-1), name: longName, password: randomUUID() },
  });
  assert.equal(accepted.status(), 201);

  const viewport = { width: 375, height: 900 };
  const staff = await browser.newContext({ viewport, storageState: await admin.storageState(), reducedMotion: 'reduce' });
  const publicContext = await browser.newContext({ viewport });
  const auditRefresh = Promise.withResolvers();
  try {
    const page = await staff.newPage();
    await page.goto(origin + '/staff');
    await page.getByText(longEmail, { exact: true }).waitFor();
    await assertContained(page, 'staff roster');

    await page.goto(origin + '/jobs');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const current = nav.getByRole('link', { name: 'Jobs', exact: true });
    assert.equal(await current.getAttribute('aria-current'), 'page');
    assert.equal(await nav.getByRole('link').count(), 7);
    assert.ok(await nav.evaluate(el => el.scrollWidth === el.clientWidth), 'All staff sections fit inside the navigation');

    const create = page.getByRole('button', { name: 'Create job', exact: true });
    await page.getByLabel('Filter by status').selectOption('published');
    await create.press('Enter');
    const editor = page.getByRole('dialog', { name: 'Create a job' });
    await editor.waitFor();
    const title = editor.getByLabel('Job title');
    await page.waitForFunction(() => document.activeElement?.id === 'job-title');
    for (let index = 0; index < 16; index++) {
      await page.keyboard.press('Tab');
      assert.ok(await editor.evaluate(el => el.contains(document.activeElement)), 'Focus must stay in the editor');
    }
    await page.keyboard.press('Escape');
    await editor.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Create job');

    await create.press('Enter');
    await editor.waitFor();
    await editor.locator('option').filter({ hasText: longEmail }).waitFor({ state: 'attached' });
    await assertContained(page, 'open job editor');
    const submitJob = editor.getByRole('button', { name: 'Create draft' });
    await submitJob.scrollIntoViewIfNeeded();
    assert.ok(await editor.evaluate((el, width) => [...el.querySelectorAll('input, select, textarea, button')].every(field => {
      const { left, right } = field.getBoundingClientRect();
      return left >= 0 && right <= width;
    }), viewport.width), 'Editor controls fit horizontally');
    const submitBounds = await submitJob.boundingBox();
    assert.ok(submitBounds.y >= 0 && submitBounds.y + submitBounds.height <= viewport.height, 'The submit button can scroll into view');
    await title.fill(longJob);
    await editor.getByLabel('Location').fill('Remote');
    await editor.getByLabel('Hiring manager', { exact: true }).selectOption({ label: longName + ' (' + longEmail + ')' });
    await editor.getByLabel('Description').fill('A fictional opening for the verification workspace.');
    const auditUrl = origin + '/api/audit';
    await page.route(auditUrl, async route => {
      await auditRefresh.promise;
      await route.continue();
    });
    await Promise.all([
      page.waitForRequest(auditUrl),
      submitJob.click(),
    ]);
    await page.getByRole('status').filter({ hasText: 'Draft created.' }).waitFor();
    assert.equal(await page.getByLabel('Filter by status').inputValue(), 'draft');
    const editButton = page.getByRole('button', { name: 'Edit ' + longJob, exact: true });
    await editButton.waitFor();
    await assertContained(page, 'jobs with a long title');
    await editButton.press('Enter');
    const edit = page.getByRole('dialog', { name: 'Edit job', exact: true });
    await edit.getByLabel('Job title').waitFor();
    assert.equal(await edit.getByLabel('Job title').inputValue(), longJob);
    await page.waitForFunction(() => document.activeElement?.id === 'job-title');
    await page.keyboard.press('Escape');
    await edit.waitFor({ state: 'hidden' });
    await page.waitForFunction(name => document.activeElement?.getAttribute('aria-label') === name, 'Edit ' + longJob);
    auditRefresh.resolve();

    const job = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: longJob, exact: true }) });
    await job.getByRole('button', { name: 'Publish' }).click();
    const applicant = await publicContext.newPage();
    await applicant.goto(origin + '/careers');
    await applicant.getByRole('heading', { name: longJob, exact: true }).waitFor();
    await assertContained(applicant, 'public careers with a long title');

    await applicant.goto(origin + '/careers/' + jobId);
    await applicant.getByLabel('Full name', { exact: true }).fill('Fictional Browser Applicant');
    const email = 'browser-' + fixture + '@candidate.test';
    const emailField = applicant.getByLabel('Email address', { exact: true });
    await emailField.fill(email);
    const resume = applicant.getByLabel('Resume', { exact: true });
    await resume.setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Not a PDF') });
    const submit = applicant.getByRole('button', { name: 'Submit application' });
    await submit.press('Enter');
    await applicant.getByRole('alert').filter({ hasText: /valid PDF or DOCX/ }).waitFor();
    await applicant.waitForFunction(() => document.activeElement?.id === 'resume');
    assert.equal(await resume.getAttribute('aria-invalid'), 'true');
    const described = await resume.evaluate(el => el.getAttribute('aria-describedby')?.split(/\s+/)
      .some(id => document.getElementById(id)?.textContent?.includes('valid PDF or DOCX')));
    assert.ok(described, 'Resume announces its validation error');
    assert.equal(await emailField.inputValue(), email);
    assert.equal(await applicant.getByLabel('Full name', { exact: true }).inputValue(), 'Fictional Browser Applicant');
    await resume.setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: makePdf() });
    await submit.press('Enter');
    await applicant.getByRole('heading', { name: 'Application received' }).waitFor();
    await applicant.reload();
    await applicant.getByRole('heading', { name: 'Application received' }).waitFor();
    const stored = await admin.request.get(origin + '/api/applications?search=' + encodeURIComponent(email));
    assert.equal(stored.status(), 200);
    const { applications } = await stored.json();
    assert.equal(applications.length, 1);
    assert.equal(applications[0].jobId, jobId);
    console.log('PASS: Morrow phone layouts, workspace navigation, keyboard job editor, draft save, and accessible resume correction.');
  } finally {
    auditRefresh.resolve();
    await staff.close();
    await publicContext.close();
  }
}

async function assertContained(page, label) {
  const { width, contentWidth } = await page.evaluate(() => ({
    width: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(width, 375);
  assert.ok(contentWidth <= width, `${label} overflows ${width}px (measured ${contentWidth}px)`);
}
