import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';
import { SourceService } from '../server/sources.ts';
import { reflowPdfText } from '../shared/excerpts.ts';
import { verifyExcerpts } from '../server/excerpts.ts';
import { plan, material } from './fixtures.ts';
import { annotatedPdf } from './pdf-fixture.ts';
import { sandboxAvailable } from '../server/sandbox.ts';

test('LLM paragraph formatting preserves words across physical line breaks and rejects rewritten or unassigned passages', async () => {
  assert.equal(
    reflowPdfText('E = mc² on ℝ, with a ﬁnite variance.'),
    'E = mc² on ℝ, with a finite variance.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'margin-excerpt-test-')),
    store = new Store(directory),
    sources = new SourceService(store);
  try {
    const s = store.createSession({
      objective: 'Source-grounded typesetting',
      mode: 'paper',
      hours: 1,
    });
    const source = await sources.ingest(
      s.id,
      Buffer.from(
        'Repeat indepen-\ndent trials.\nPreserve the original observations.\n\nAn uncertainty estimate needs evidence.',
      ),
      'note.txt',
    );
    const m = {
      ...material,
      references: [
        { sourceId: source.id, page: 1, quote: '', purpose: 'Understand reproducibility.' },
      ],
    };
    const result = verifyExcerpts(store.detail(s.id), m, {
      fragments: [
        {
          sourceId: source.id,
          page: 1,
          blocks: [
            {
              kind: 'paragraph',
              text: 'Repeat independent trials. Preserve the original observations.',
            },
          ],
        },
      ],
    });
    assert.equal(
      result[0].blocks[0].text,
      'Repeat independent trials. Preserve the original observations.',
    );
    assert.throws(
      () =>
        verifyExcerpts(store.detail(s.id), m, {
          fragments: [
            {
              sourceId: source.id,
              page: 1,
              blocks: [{ kind: 'paragraph', text: 'Repeated trials prove the hypothesis.' }],
            },
          ],
        }),
      /changed the source/,
    );
    assert.throws(
      () =>
        verifyExcerpts(store.detail(s.id), m, {
          fragments: [
            { sourceId: source.id, page: 2, blocks: [{ kind: 'paragraph', text: 'invented' }] },
          ],
        }),
      /unassigned/,
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('PDF highlights and sticky notes persist geometric anchors, can be edited/deleted, and layout survives export', async (t) => {
  if (!(await sandboxAvailable())) {
    t.skip('Requires bubblewrap');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'margin-pdf-notes-'));
  const { app, store, sources } = await createApp({ directory });
  const headers = { host: '127.0.0.1:4317', 'x-margin-client': '1' };
  try {
    const s = store.createSession({
      objective: 'Annotate an original PDF',
      mode: 'paper',
      hours: 1,
    });
    const source = await sources.ingest(s.id, annotatedPdf(), 'fixture.pdf');
    const body = {
      sourceId: source.id,
      page: 1,
      quote: 'Selected from the original PDF text layer',
      note: 'Check the assumption',
      kind: 'highlight',
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.02 }],
    };
    const response = await app.inject({
      method: 'POST',
      url: `/api/sessions/${s.id}/annotations`,
      headers,
      payload: body,
    });
    assert.equal(response.statusCode, 200);
    const annotation = response.json();
    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${s.id}/annotations/${annotation.id}`,
      headers,
      payload: {
        ...body,
        kind: 'sticky',
        note: 'Independence is an assumption, not a result.',
        anchor: { x: 0.72, y: 0.22 },
      },
    });
    assert.equal(edited.statusCode, 200);
    assert.equal(edited.json().anchor.x, 0.72);
    const invalid = await app.inject({
      method: 'POST',
      url: `/api/sessions/${s.id}/annotations`,
      headers,
      payload: { ...body, rects: [{ x: 0.99, y: 0.1, width: 0.4, height: 0.02 }] },
    });
    assert.equal(invalid.statusCode, 400);
    const other = store.createSession({ objective: 'Another session', mode: 'concept', hours: 1 });
    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/sessions/${other.id}/annotations/${annotation.id}`,
          headers,
        })
      ).statusCode,
      404,
    );
    const layout = {
      grid: { orientation: 'HORIZONTAL', root: { type: 'branch', data: [], size: 1000 } },
      panels: {},
    };
    assert.equal(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/sessions/${s.id}`,
          headers,
          payload: { workspaceLayout: layout },
        })
      ).statusCode,
      200,
    );
    const exported = await app.inject({
      method: 'GET',
      url: `/api/sessions/${s.id}/export`,
      headers,
    });
    assert.deepEqual(exported.json().workspaceLayout, layout);
    assert.equal(
      exported.json().annotations[0].note,
      'Independence is an assumption, not a result.',
    );
    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/sessions/${s.id}/annotations/${annotation.id}`,
          headers,
        })
      ).statusCode,
      200,
    );
    assert.equal(store.detail(s.id).annotations.length, 0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed automatic excerpt formatting preserves the lesson and supports an independent formatting retry', async (t) => {
  if (!(await sandboxAvailable())) {
    t.skip('Requires bubblewrap');
    return;
  }
  const { LearningService } = await import('../server/learning.ts');
  const directory = await mkdtemp(join(tmpdir(), 'margin-format-recovery-')),
    store = new Store(directory),
    sources = new SourceService(store);
  let fail = true;
  const session = store.createSession({
    objective: 'Study a paper without losing a lesson if formatting fails',
    mode: 'paper',
    hours: 1,
  });
  const source = await sources.ingest(session.id, annotatedPdf(), 'fixture.pdf');
  store.setPlan(session.id, plan);
  const a = store.detail(session.id).activities[0];
  const agent: import('../server/codex.ts').Agent = {
    status: async () => ({ connected: true, auth: 'fixture', models: [] }),
    run: async (request) => {
      if (!request.prompt.startsWith('Format'))
        return {
          ...material,
          references: [
            { sourceId: source.id, page: 1, quote: '', purpose: 'Read the original argument.' },
          ],
        };
      if (fail) throw new Error('Injected formatting interruption');
      return {
        fragments: [
          {
            sourceId: source.id,
            page: 1,
            blocks: [{ kind: 'paragraph', text: 'For independent observations, variances add.' }],
          },
        ],
      };
    },
  };
  const learning = new LearningService(store, sources, agent);
  const wait = async (job: import('../shared/schema.ts').Job) => {
    for (let i = 0; i < 100; i++) {
      const j = store.get<import('../shared/schema.ts').Job>('jobs', job.id);
      if (j.status !== 'running') return j;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('timeout');
  };
  try {
    assert.equal((await wait(learning.start(session.id, 'material', a.id))).status, 'succeeded');
    assert.equal(store.activity(session.id, a.id).material?.body, material.body);
    assert.match(store.activity(session.id, a.id).material?.excerptError ?? '', /interruption/);
    assert.equal(store.activity(session.id, a.id).material?.excerpts, undefined);
    fail = false;
    assert.equal((await wait(learning.start(session.id, 'excerpts', a.id))).status, 'succeeded');
    assert.ok(store.activity(session.id, a.id).material?.excerpts?.length);
    assert.equal(store.activity(session.id, a.id).material?.excerptError, undefined);
  } finally {
    await learning.shutdown();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
