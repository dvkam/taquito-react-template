import { expect, test } from '@playwright/test';
import { verifyTransaction } from '../tools/sapling-verify.mjs';
import { writeFile } from 'node:fs/promises';

test('opens the Sapling lab without downloading proving parameters', async ({ page }) => {
  const params: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('.params')) params.push(request.url());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click({ timeout: 3_000 });
  await expect(page.getByRole('heading', { name: 'Sapling proof lab' })).toBeVisible();
  await expect(page.getByText('No proof parameters loaded.')).toBeVisible();
  expect(params).toEqual([]);
});

test('prepares a real worker proof and independently verifies it with Octez', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(300_000);
  const workerErrors: string[] = [];
  page.on('pageerror', (error) => workerErrors.push(error.message));
  const parameterRequests: string[] = [];
  page.on('request', (item) => {
    if (item.url().includes('.params')) parameterRequests.push(item.url());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click();
  await page.getByLabel('Private memo').fill('é');
  await page.getByRole('button', { name: 'Prepare proof', exact: true }).click();
  await expect(page.locator('.sapling-status')).toHaveAttribute('data-phase', 'proving', {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'What is public?' }).click();
  await expect(page.getByRole('button', { name: 'What is public?' })).toHaveAttribute(
    'aria-expanded',
    'true',
    { timeout: 1_000 },
  );
  await expect(page.locator('.sapling-status')).toHaveAttribute('data-phase', 'proving');
  await expect(page.getByText('Proof prepared. Not yet verified.')).toBeVisible({
    timeout: 180_000,
  });
  const transactionHex = await page.getByLabel('Prepared transaction bytes').inputValue();
  const bytes = Buffer.from(transactionHex, 'hex');
  // Literal protocol fixtures. No SDK encoder computes these expected bytes.
  expect(bytes.length).toBe(615);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('00000000000001f3');
  expect(bytes.subarray(-44, -36).toString('hex')).toBe('ffffffffffffffff');
  expect(bytes.subarray(-36, -4).toString('hex')).toBe(
    'fbc2f4300c01f0b7820d00e3347c8da4ee614674376cbc45359daa54f9b5493e',
  );
  expect(bytes.subarray(-4).toString('hex')).toBe('00000000');
  expect(parameterRequests.filter((url) => url.endsWith('spend.params'))).toHaveLength(1);
  expect(parameterRequests.filter((url) => url.endsWith('output.params'))).toHaveLength(1);
  const verification = page.waitForResponse((response) =>
    response.url().endsWith('/__sapling/verify'),
  );
  await page.getByRole('button', { name: 'Verify with Octez' }).click();
  await expect(page.getByText('Octez accepted this proof.')).toBeVisible({ timeout: 60_000 });
  expect(await (await verification).json()).toMatchObject({
    accepted: true,
    balance: '-1',
    boundData: '',
    protocol: 'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu',
  });
  if (testInfo.project.name === 'chromium') {
    expect(
      await verifyTransaction({
        transactionHex,
        contractAddress: 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton',
      }),
    ).toMatchObject({ accepted: false, reason: 'verification-failed' });
  }
  const corruptedProof = Buffer.from(bytes);
  corruptedProof.fill(0, 40, 232);
  const rejected = await request.post('./__sapling/verify', {
    data: { transactionHex: corruptedProof.toString('hex') },
  });
  expect(rejected.ok()).toBe(true);
  expect(await rejected.json()).toMatchObject({ accepted: false, reason: 'verification-failed' });
  const corruptedSignature = Buffer.from(bytes);
  corruptedSignature[8 + 499] = (corruptedSignature[8 + 499] ?? 0) ^ 1;
  const rejectedSignature = await request.post('./__sapling/verify', {
    data: { transactionHex: corruptedSignature.toString('hex') },
  });
  expect(await rejectedSignature.json()).toMatchObject({
    accepted: false,
    reason: 'verification-failed',
  });
  expect(workerErrors).toEqual([]);
  const coldSummary = await page.locator('.sapling-result').innerText();
  await page.screenshot({ path: testInfo.outputPath('verified-lab.png'), fullPage: true });
  await page.getByRole('button', { name: 'Prepare proof', exact: true }).click();
  await expect(page.getByText('Proof prepared. Not yet verified.')).toBeVisible({
    timeout: 180_000,
  });
  await expect(page.getByText('Already initialized')).toBeVisible();
  expect(parameterRequests).toHaveLength(2);
  const warmHex = await page.getByLabel('Prepared transaction bytes').inputValue();
  const warmVerified = await request.post('./__sapling/verify', {
    data: { transactionHex: warmHex },
  });
  expect(await warmVerified.json()).toMatchObject({ accepted: true, balance: '-1', boundData: '' });
  const warmSummary = await page.locator('.sapling-result').innerText();
  const evidencePath = testInfo.outputPath('proof-evidence.json');
  await writeFile(
    evidencePath,
    JSON.stringify(
      { browser: testInfo.project.name, transactionHex, coldSummary, warmSummary },
      null,
      2,
    ),
  );
  await testInfo.attach('real-proof.json', { path: evidencePath, contentType: 'application/json' });
});

test('recovers from a failed download and stopping a worker', async ({ page }) => {
  await page.route('**/__sapling/params/spend.params', (route) => route.abort('failed'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click();
  await page.getByRole('button', { name: 'Prepare proof', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Failed to fetch Sapling spend params');
  await page.unroute('**/__sapling/params/spend.params');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Stopped. You can retry when ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Proof prepared. Not yet verified.')).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole('button', { name: 'Verify with Octez' }).click();
  await expect(page.getByText('Octez accepted this proof.')).toBeVisible({ timeout: 60_000 });
});

test('keeps the lab usable at a narrow viewport with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click();
  await page.getByRole('button', { name: 'What is public?' }).click();
  await page.getByLabel('Private memo').fill('ééééé');
  await expect(page.getByLabel('Private memo')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Prepare proof', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
