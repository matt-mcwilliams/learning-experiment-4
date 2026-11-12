import { test, expect } from '@playwright/test';
import { annotatedPdf, scannedPdf } from '../pdf-fixture';
import AxeBuilder from '@axe-core/playwright';
test('start a document session, autosave mathematical work, critique, defend, conclude and retain six directions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.getByRole('heading', { name: 'Start with a question.' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.inline-session .primary')).toHaveCSS('transition-duration', '0s');
  await page.screenshot({ path: 'test-results/welcome-desktop.png', fullPage: true });
  await page
    .getByRole('textbox', { name: 'Your question', exact: true })
    .fill('Understand sample means and investigate what independence contributes.');
  await page
    .locator('.inline-session')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'sampling-note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'For independent random variables, the variance of a sum is the sum of variances. For dependent variables, include covariance terms. This is an authored test source.'.repeat(
          100,
        ),
      ),
    });
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to establish', exact: true })).toBeVisible();
  await expect(
    page.locator('.activity-nav').filter({ hasText: 'Independent reasoning' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'PDF & sources', exact: true }).click();
  await expect(page.locator('.source-text')).toContainText('covariance terms');
  await page
    .getByRole('textbox', { name: 'NOTE ON THIS PAGE' })
    .fill('Independence needs justification, not just algebra.');
  await page.getByRole('button', { name: 'Save annotation' }).click();
  await expect(page.locator('.annotation')).toContainText('Independence needs justification');
  const readerSaved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      r.url().includes('/api/sessions/') &&
      r.request().postDataJSON()?.readerState?.page === 2,
  );
  await page.getByRole('spinbutton', { name: 'Page number' }).fill('2');
  await readerSaved;
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await page.getByRole('tab', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare this activity' }).click();
  await expect(page.locator('.prose .katex-display').first()).toBeVisible();
  await page.getByRole('button', { name: 'Work through the question' }).click();
  await page.locator('.document-assignment > summary').click();
  await page.getByRole('button', { name: 'Begin closed-book attempt' }).click();
  await expect(page.getByRole('tab', { name: 'PDF & sources', exact: true })).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Written response' })
    .fill(
      'Variance decreases with sample size. For independent observations, $\\mathrm{Var}(\\bar X)=\\sigma^2/n$. I still need to derive the dependence case.',
    );
  await expect(page.locator('.view-write .save-state').first()).toHaveText(/Saved/);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Written response' })).toContainText(
    'Variance decreases with sample size.',
  );
  await page.getByRole('button', { name: 'Reading view', exact: true }).click();
  await expect(page.locator('.response-preview .katex')).toBeVisible();
  await page.locator('.work-options > summary').click();
  await page.getByRole('button', { name: 'Mark activity done' }).click();
  await page.getByRole('button', { name: 'Return to document', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Written response' })
    .fill(
      'Variance decreases with sample size. My derivation must account for covariance terms when observations are dependent.',
    );
  await expect(page.locator('.view-write .save-state').first()).toHaveText(/Saved/);
  await page.getByRole('button', { name: 'Submit for critique' }).click();
  await expect(page.getByRole('heading', { name: 'Does the reasoning hold?' })).toBeVisible();
  await expect(page.locator('.assessment-summary')).toContainText('unresolved');
  await expect(page.locator('.criterion-result')).toContainText('covariance');
  await page.getByRole('button', { name: 'Convene an expert defense' }).click();
  await expect(page.locator('.reviewer')).toHaveCount(3);
  await page.getByRole('tab', { name: 'AI chat', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Question for thinking partner' })
    .fill('What changes when samples are correlated?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('.message.assistant')).toContainText('covariance terms');
  await page.getByRole('tab', { name: 'Read', exact: true }).click();
  await page.getByRole('tab', { name: 'Session brief' }).click();
  if (await page.locator('.app').evaluate((node) => node.classList.contains('sidebar-hidden')))
    await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Conclude session' }).click();
  await page.getByRole('button', { name: 'Synthesize & save' }).click();
  await expect(page.getByRole('heading', { name: 'What the work leaves you with.' })).toBeVisible();
  await page.getByRole('button', { name: /Possible directions/ }).click();
  await expect(page.locator('.recommendation')).toHaveCount(6);
  await page.getByRole('button', { name: 'Knowledge record', exact: true }).click();
  await expect(page.locator('.knowledge-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Challenge this judgment' }).click();
  await page
    .getByRole('textbox', { name: 'Challenge this assessment' })
    .fill('The uncertainty should specify the covariance assumption.');
  await page.getByRole('button', { name: 'Save challenge' }).click();
  await expect(page.locator('.knowledge-card blockquote')).toContainText('covariance assumption');
  await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
  await expect(page.locator('.session-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('generated apparatus requires a prediction, collects reproducible real trials, exports data, and preserves independent analysis', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.locator('.inline-session')).toBeVisible();
  await page.getByRole('button', { name: /New session/ }).click();
  await expect(page.getByRole('textbox', { name: 'Your question', exact: true })).toBeFocused();
  await page
    .locator('.inline-session')
    .getByRole('textbox', { name: 'Your question' })
    .fill('Investigate how sample size changes Monte Carlo uncertainty.');
  await page
    .getByRole('combobox', { name: 'Session type', exact: true })
    .selectOption('investigation');
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to establish', exact: true })).toBeVisible();
  await page.locator('.activity-nav').filter({ hasText: 'A reproducible investigation' }).click();
  await page.getByRole('tab', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare apparatus' }).click();
  await expect(page.getByRole('button', { name: 'Open laboratory' })).toBeVisible();
  await page.getByRole('button', { name: 'Open laboratory' }).click();
  const collect = page.getByRole('button', { name: 'Collect one trial' });
  await expect(collect).toBeDisabled();
  await page
    .getByRole('textbox', { name: 'YOUR INVESTIGABLE HYPOTHESIS' })
    .fill('Quadrupling n halves the standard deviation of replicate means.');
  await page
    .getByRole('textbox', { name: 'PREDICT AN OBSERVATION BEFORE REVEALING DATA' })
    .fill('At n=16, the standard deviation should be approximately 0.25.');
  await collect.click();
  await expect(page.locator('.run-selector button')).toHaveCount(1);
  await expect(page.locator('.run-detail')).toContainText('40 simulated observations');
  await collect.click();
  await expect(page.locator('.run-selector button')).toHaveCount(2);
  await expect(page.locator('.data-table-wrap tbody tr')).toHaveCount(40);
  const rows = await page.locator('.data-table-wrap tbody').innerText();
  await page.locator('.run-selector button').first().click();
  expect(await page.locator('.data-table-wrap tbody').innerText()).toEqual(rows);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export measurements' }).click();
  expect((await download).suggestedFilename()).toBe('measurements.csv');
  await page.getByRole('button', { name: 'Independent analysis' }).click();
  await page
    .locator('.cm-content')
    .fill(
      "import json, statistics\ntrials=json.load(open('trials.json'))\nprint('Recorded trials:', len(trials))\nprint('Spread:', statistics.stdev(x['sample_mean'] for x in trials[0]['result']['measurements']))",
    );
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await expect(page.locator('.run-output')).toContainText('Recorded trials: 2');
  await page.screenshot({ path: 'test-results/laboratory-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.cm-content')).toContainText('Recorded trials:');
  await expect(page.locator('.run-selector button')).toHaveCount(3);
});
test('mobile layout keeps navigation and session controls accessible without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(page.getByRole('heading', { name: 'A record of real work.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile-portfolio.png', fullPage: true });
});

test('workspace controls meet automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('button', { name: 'Decide later' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
});

test('native PDF highlights and sticky notes, inline excerpts, rich formatting and split layouts survive reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.locator('.docked-workspace')).toBeVisible();
  await page.getByRole('button', { name: /New session/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Your question' })
    .fill('Read and annotate a paper about independent sampling.');
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'sampling.pdf', mimeType: 'application/pdf', buffer: annotatedPdf() });
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await page.getByRole('tab', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare this activity' }).click();
  await expect(page.locator('.reading-excerpt blockquote')).toContainText('A sample mean combines');
  await page.locator('.excerpt-details > summary').click();
  await expect(page.locator('.excerpt-details')).toContainText('Source words checked');
  await page.locator('.excerpt-details > summary').click();
  await page.getByRole('button', { name: 'Open source', exact: true }).click();
  await expect(page.locator('.react-pdf__Page canvas')).toBeVisible();
  const passage = page
    .locator('.textLayer span')
    .filter({ hasText: 'A sample mean combines' })
    .first();
  await expect(passage).toBeVisible();
  await page.getByRole('button', { name: 'Highlight text', exact: true }).click();
  await passage.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await passage.dispatchEvent('mouseup');
  await expect(page.locator('.pdf-highlight')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sticky note', exact: true }).click();
  await page.locator('.pdf-page-stage').click({ position: { x: 220, y: 210 } });
  await page
    .getByRole('textbox', { name: 'Sticky note text' })
    .fill('Why do the covariance terms vanish?');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.pdf-note-pin')).toHaveCount(1);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.pdf-highlight')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/pdf-reader.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.pdf-highlight')).toHaveCount(1);
  await expect(page.locator('.pdf-note-pin')).toHaveCount(1);
  await page.locator('.pdf-note-pin').click();
  await expect(page.getByRole('textbox', { name: 'Sticky note text' })).toHaveValue(
    'Why do the covariance terms vanish?',
  );
  await page
    .getByRole('textbox', { name: 'Sticky note text' })
    .fill('Check independence before adding variances.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.locator('.source-actions > summary').click();
  await page.getByRole('button', { name: 'Add a public source URL', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Public source URL', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add a public source URL', exact: true }).click();
  await page.locator('.source-actions > summary').click();
  await page.getByRole('tab', { name: 'Work', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Written response' });
  await editor.fill('A defensible variance argument needs an explicit independence assumption.');
  await editor.press('Control+a');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(editor.locator('strong')).toContainText('A defensible');
  await expect(page.locator('.view-write .document-status')).toContainText('9 words');
  await editor.press('ArrowRight');
  await page.getByRole('button', { name: 'Insert equation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Equation LaTeX' }).fill('\\sigma^2/n');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Insert equation', exact: true })
    .click();
  await expect(editor.locator('.katex')).toBeVisible();
  await expect(page.locator('.view-write .save-state').first()).toHaveText(/Saved/);
  await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
  await page.getByRole('button', { name: 'Split right', exact: true }).click();
  await expect(page.locator('.dv-groupview')).toHaveCount(2);
  await expect(page.locator('.app')).toHaveClass(/sidebar-hidden/);
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.dv-groupview')).toHaveCount(2);
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
  await page.screenshot({ path: 'test-results/split-workspace.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.dv-groupview')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Work', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Written response' }).locator('strong'),
  ).toContainText('A defensible');
  await expect(
    page.getByRole('textbox', { name: 'Written response' }).locator('.katex'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'AI chat', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Question for thinking partner' })).toBeVisible();
  await page
    .getByRole('tab', { name: 'AI chat', exact: true })
    .dragTo(page.getByRole('tab', { name: 'Work', exact: true }));
  await expect(
    page
      .locator('.dv-groupview')
      .filter({ has: page.getByRole('tab', { name: 'Work', exact: true }) }),
  ).toContainText('AI chat');
  await page.getByRole('tab', { name: 'AI chat', exact: true }).click();
  await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
  await page.getByRole('button', { name: 'Close active tab', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'AI chat', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
  await page.locator('.tab-menu').getByRole('button', { name: 'AI chat', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Question for thinking partner' })).toBeVisible();
  while (await page.getByRole('tab').count()) {
    await page.getByRole('tab').first().click();
    await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
    await page.getByRole('button', { name: 'Close active tab', exact: true }).click();
  }
  await expect(page.locator('.empty-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
  await page.locator('.tab-menu').getByRole('button', { name: 'Notebook', exact: true }).click();
  await expect(page.locator('.view-notes')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace menu', exact: true }).click();
  await page.getByRole('button', { name: 'Reset workspace layout', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('combobox', { name: 'Current view', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Current view', exact: true }).selectOption('read');
  await expect(page.locator('.view-read .activity-heading')).toBeVisible();
  expect(errors).toEqual([]);
});

test('scanned PDF images paint, pages scroll continuously, and annotations retain their own page', async ({
  page,
}) => {
  const warnings: string[] = [],
    decoders: number[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text());
  });
  page.on('pageerror', (error) => warnings.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('jbig2_nowasm_fallback.js')) decoders.push(response.status());
  });
  const headers = { 'x-margin-client': '1' };
  const { profile } = await (await page.request.get('/api/bootstrap')).json();
  await page.request.put('/api/profile', { headers, data: { ...profile, onboarded: true } });
  const created = await page.request.post('/api/sessions', {
    headers,
    data: { objective: 'Inspect an original scanned PDF', mode: 'paper', hours: 1 },
  });
  const session = await created.json();
  const attached = await page.request.post(`/api/sessions/${session.id}/sources`, {
    headers,
    multipart: {
      file: { name: 'scan.pdf', mimeType: 'application/pdf', buffer: scannedPdf() },
    },
  });
  expect(attached.ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('tab', { name: 'PDF & sources', exact: true }).click();
  const scroll = page.getByRole('region', { name: 'Scrollable PDF' });
  const pdfPage = (number: number) => page.locator(`.pdf-page-stage[data-page-number="${number}"]`);
  await expect(page.locator('.pdf-page-stage')).toHaveCount(8);
  const paintedPixels = async (number: number) =>
    pdfPage(number)
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => {
        if (canvas.style.visibility === 'hidden' || !canvas.width || !canvas.height) return 0;
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        let ink = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i + 3] && data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) ink++;
        // A newly allocated canvas can be transparent or entirely black before
        // PDF.js paints it. Neither is the scan artwork this test must verify.
        return ink >= canvas.width * canvas.height * 0.95 ? 0 : ink;
      });
  await expect.poll(() => paintedPixels(1)).toBeGreaterThan(5000);
  expect(decoders).toContain(200);
  await expect.poll(() => page.locator('.react-pdf__Page canvas').count()).toBeLessThan(8);
  const firstHeight = await pdfPage(1).evaluate((el) => el.getBoundingClientRect().height);
  await scroll.hover();
  await page.mouse.wheel(0, firstHeight - 180);
  // Both sides of the page break are present in the same scroll viewport.
  await expect(pdfPage(2)).toBeInViewport();
  const gap = await pdfPage(2).evaluate(
    (el) =>
      el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom,
  );
  expect(gap).toBeCloseTo(22, 0);
  await page.mouse.wheel(0, 300);
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await expect.poll(() => paintedPixels(2)).toBeGreaterThan(5000);
  await page.getByRole('button', { name: 'Sticky note', exact: true }).click();
  await pdfPage(2).click({ position: { x: 180, y: 220 } });
  await page
    .getByRole('textbox', { name: 'Sticky note text' })
    .fill('This observation belongs to page two.');
  // Scrolling while a note is open must not silently move the note to another page.
  await scroll.evaluate((el) => {
    const target = el.querySelector('[data-page-number="3"]')!;
    el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('3');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(pdfPage(2).locator('.pdf-note-pin')).toHaveCount(1);
  const detail = await (await page.request.get(`/api/sessions/${session.id}`)).json();
  expect(detail.annotations[0].page).toBe(2);
  await page.getByRole('spinbutton', { name: 'Page number' }).fill('6');
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('6');
  await expect.poll(() => paintedPixels(6)).toBeGreaterThan(5000);
  await scroll.evaluate((el) => {
    el.scrollTop += 150;
  });
  const offset = () =>
    pdfPage(6).evaluate((el) => {
      const root = el.closest('.pdf-scroll')!,
        r = el.getBoundingClientRect();
      return (root.getBoundingClientRect().top - r.top) / r.height;
    });
  const before = await offset();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(async () => Math.abs((await offset()) - before)).toBeLessThan(0.02);
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/sessions/${session.id}`)).json()).readerState?.page,
    )
    .toBe(6);
  await page.screenshot({ path: 'test-results/continuous-pdf.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('6');
  await expect.poll(() => paintedPixels(6)).toBeGreaterThan(5000);
  await expect.poll(async () => Math.abs((await offset()) - before)).toBeLessThan(0.02);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('5');
  expect(
    warnings.filter((message) =>
      /decode image|failed to initialize|resolve module|content security|uncaught/i.test(message),
    ),
  ).toEqual([]);
});
