import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../server/store.ts';
import { SourceService } from '../server/sources.ts';
import { LearningService } from '../server/learning.ts';
import { sandboxAvailable } from '../server/sandbox.ts';
import type { Agent, AgentRequest } from '../server/codex.ts';
import type { Job } from '../shared/schema.ts';
import { plan, labMaterial } from './fixtures.ts';
// A small original PDF fixture, not a copyrighted third-party paper.
function textPdf() {
  const text =
    'A test source with a real text layer. Independent observations require a justified assumption. Variances add under independence.';
  const content = `BT /F1 8 Tf 50 740 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(value));
    value += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(value);
  value +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}
test('actual PDF parsing preserves the original, physical page text and extraction limitations', async (t) => {
  if (!(await sandboxAvailable())) {
    t.skip('requires Linux sandbox and Poppler');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'margin-pdf-test-')),
    store = new Store(directory),
    sources = new SourceService(store);
  try {
    const s = store.createSession({ objective: 'Read a real document', mode: 'paper', hours: 1 });
    const data = textPdf();
    const source = await sources.ingest(s.id, data, 'independence.pdf');
    assert.equal(source.mediaType, 'application/pdf');
    assert.equal(source.pages.length, 1);
    assert.match(source.pages[0], /Variances add under independence/);
    assert.match(source.warning!, /equations/);
    assert.deepEqual(await sources.readBlob(source.sha256), data);
    sources.verifyReferences(s.id, [
      { sourceId: source.id, page: 1, quote: 'real text layer', purpose: 'Reading assignment' },
    ]);
    await assert.rejects(
      sources.ingest(s.id, Buffer.from('%PDF-1.4\ninvalid'), 'corrupt.pdf'),
      /extraction failed/,
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('remote quotation budgets and bounded computational evidence tools enforce source/session ownership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-evidence-test-')),
    store = new Store(directory),
    sources = new SourceService(store);
  try {
    const s = store.createSession({ objective: 'Integrity of evidence', mode: 'paper', hours: 1 });
    const text = Array.from({ length: 35 }, (_, i) => 'word' + i).join(' ');
    const source = await sources.ingest(s.id, Buffer.from(text), 'remote.txt');
    store.put('sources', { ...source, origin: 'url' });
    assert.throws(
      () =>
        sources.verifyReferences(s.id, [
          { sourceId: source.id, page: 1, quote: text, purpose: 'Too much quoted text' },
        ]),
      /quotation limit/,
    );
    const other = store.createSession({
      objective: 'Different evidence',
      mode: 'project',
      hours: 1,
    });
    const artifact = await sources.artifact(
      s.id,
      Buffer.from('print(1)'),
      'implementation.py',
      'text/plain',
    );
    await assert.rejects(
      sources.tools(other.id).read_artifact.call({ artifactId: artifact.id }),
      /not available/,
    );
    assert.match(
      JSON.stringify(await sources.tools(s.id).read_artifact.call({ artifactId: artifact.id })),
      /print/,
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('generated apparatus fails closed before publication; successful startup measurements never become learner evidence', async (t) => {
  if (!(await sandboxAvailable())) {
    t.skip('requires Linux sandbox');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'margin-apparatus-test-')),
    store = new Store(directory),
    sources = new SourceService(store);
  let broken = true;
  const agent: Agent = {
    status: async () => ({ connected: true, auth: 'test fixture', models: [] }),
    run: async () =>
      broken
        ? {
            ...labMaterial,
            lab: { ...labMaterial.lab!, simulator: "raise RuntimeError('apparatus defect')" },
          }
        : labMaterial,
  };
  const learning = new LearningService(store, sources, agent);
  const wait = async (job: Job) => {
    for (let i = 0; i < 200; i++) {
      const j = store.get<Job>('jobs', job.id);
      if (j.status !== 'running') return j;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('job timeout');
  };
  try {
    const s = store.createSession({
      objective: 'Test the apparatus',
      mode: 'investigation',
      hours: 1,
    });
    store.setPlan(s.id, plan);
    const activity = store.detail(s.id).activities[1];
    const failed = await wait(learning.start(s.id, 'material', activity.id));
    assert.equal(failed.status, 'failed');
    assert.match(failed.error!, /apparatus defect/);
    assert.equal(store.activity(s.id, activity.id).material, null);
    assert.equal(store.detail(s.id).runs.length, 0);
    broken = false;
    assert.equal((await wait(learning.start(s.id, 'material', activity.id))).status, 'succeeded');
    assert.ok(store.activity(s.id, activity.id).material?.technicalCheck);
    assert.equal(store.detail(s.id).runs.length, 0);
  } finally {
    await learning.shutdown();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
