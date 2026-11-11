// Explicit real-Codex formatting evaluation; uses only original test material.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { Store } from '../server/store.ts';
import { SourceService } from '../server/sources.ts';
import { CodexAgent } from '../server/codex.ts';
import { LearningService } from '../server/learning.ts';
import { plan, material } from '../tests/fixtures.ts';
import { annotatedPdf } from '../tests/pdf-fixture.ts';
import type { Job } from '../shared/schema.ts';
const directory = await mkdtemp(join(tmpdir(), 'margin-format-eval-'));
console.log('Private evaluation directory:', directory);
const store = new Store(directory),
  sources = new SourceService(store),
  agent = new CodexAgent(directory),
  learning = new LearningService(store, sources, agent);
try {
  const session = store.createSession({
    objective:
      'Read an original PDF excerpt with paragraph formatting that preserves the source words.',
    mode: 'paper',
    hours: 1,
  });
  const source = await sources.ingest(session.id, annotatedPdf(), 'sampling.pdf');
  store.setPlan(session.id, plan);
  const a = store.detail(session.id).activities[0];
  store.put('activities', {
    ...a,
    material: {
      ...material,
      references: [
        {
          sourceId: source.id,
          page: 1,
          quote: '',
          purpose:
            'Understand why a variance argument needs independence and how repeated trials differ from reproducibility.',
        },
      ],
    },
    state: 'ready',
  });
  const job = learning.start(session.id, 'excerpts', a.id);
  let phase = '';
  for (let i = 0; i < 450; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const j = store.get<Job>('jobs', job.id);
    if (j.phase !== phase) {
      phase = j.phase;
      console.log(phase);
    }
    if (j.status === 'failed') throw new Error(j.error!);
    if (j.status === 'succeeded') break;
  }
  const excerpts = store.activity(session.id, a.id).material?.excerpts;
  assert.ok(excerpts?.length);
  assert.ok(excerpts[0].blocks.length);
  await writeFile(
    join(directory, 'evaluation.json'),
    JSON.stringify({ passed: true, excerpts }, null, 2),
  );
  console.log('Real LLM typesetting passed verbatim source validation.');
} finally {
  await learning.shutdown();
  store.close();
}
