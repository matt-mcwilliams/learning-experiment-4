// Public-safe design captures. Always starts a disposable fixture server; never opens user data.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { annotatedPdf } from '../tests/pdf-fixture.ts';

const destination = process.argv[2];
if (!destination) throw new Error('Usage: npx tsx scripts/design-checkpoint.ts <output-directory>');
const baseURL = 'http://127.0.0.1:4517';
if (
  await fetch(baseURL + '/api/health')
    .then(() => true)
    .catch(() => false)
) {
  throw new Error('Port 4517 is in use. Stop that server before capturing a fresh fixture.');
}
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['--import', 'tsx', 'tests/browser-server.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (data) => {
  serverLog += String(data);
});
server.stderr.on('data', (data) => {
  serverLog += String(data);
});
const browser = await chromium.launch({
  executablePath: process.env.MARGIN_CHROMIUM || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(baseURL + '/api/health')
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (attempt === 100 || server.exitCode !== null) throw new Error(serverLog);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const capture = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText('Preparing mathematical text…', { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: resolve(destination, name + '.png'),
      fullPage: true,
      animations: 'disabled',
    });
  };
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.welcome')).toBeVisible();
  await capture('01-empty-desk');
  await page.getByRole('button', { name: 'Begin a learning session' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Your question' })
    .fill('Understand sample means and investigate what independence contributes.');
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({
    name: 'sampling.pdf',
    mimeType: 'application/pdf',
    buffer: annotatedPdf(),
  });
  await capture('02-new-session');
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await expect(page.locator('.route-list')).toBeVisible();
  await capture('03-session-brief');
  await page.getByRole('tab', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare this activity' }).click();
  await expect(page.locator('.reading-excerpt blockquote')).toContainText('A sample mean combines');
  await page.getByRole('tab', { name: 'Work', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Written response' })
    .fill(
      'A sample mean combines independent observations. To understand its uncertainty, I first expand the variance of the sum.\n\nIndependence makes the covariance terms vanish. If observations share a common source of noise, increasing the sample size may not remove that uncertainty.',
    );
  await expect(page.locator('.view-write .save-state').first()).toHaveText(/Saved/);
  await page.getByRole('button', { name: 'Split right', exact: true }).click();
  await expect(page.locator('.dv-groupview')).toHaveCount(2);
  await capture('04-reading-and-writing');
  await page.getByRole('tab', { name: 'PDF & sources', exact: true }).click();
  await expect(page.locator('.react-pdf__Page canvas')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.react-pdf__Page canvas').evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return canvas.width > 0 && canvas.height > 0;
      }),
    )
    .toBe(true);
  await capture('05-source-and-writing');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.getByRole('button', { name: 'Reset workspace layout' }).click();
  await expect(page.getByRole('combobox', { name: 'Current view', exact: true })).toHaveValue(
    'brief',
  );
  await capture('06-mobile-brief');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  console.log('Captured six synthetic states in ' + destination);
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once('exit', () => resolve());
  });
}
