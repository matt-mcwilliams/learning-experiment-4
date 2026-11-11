// Opt-in: this runs real inference using the authenticated ChatGPT Codex plan.
// All generated learning data is isolated in a temporary directory, never the user's portfolio.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Store, id, now } from '../server/store.ts';
import { SourceService } from '../server/sources.ts';
import { CodexAgent } from '../server/codex.ts';
import { LearningService } from '../server/learning.ts';
import { executePython } from '../server/sandbox.ts';
import type { Job, JobKind, Submission, Run, Recommendation } from '../shared/schema.ts';
const directory = process.env.MARGIN_EVAL_RESUME || (await mkdtemp(join(tmpdir(), 'margin-live-')));
console.log('Live evaluation directory:', directory);
const store = new Store(directory),
  sources = new SourceService(store),
  agent = new CodexAgent(directory),
  learning = new LearningService(store, sources, agent);
const report: { stage: string; result: string; detail?: unknown }[] = [];
async function task(
  sid: string,
  kind: JobKind,
  aid: string | null = null,
  submissionId: string | null = null,
  text = '',
) {
  const job = learning.start(sid, kind, aid, submissionId, text);
  let phase = '';
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const j = store.get<Job>('jobs', job.id);
    if (j.phase !== phase) {
      phase = j.phase;
      console.log(kind + ': ' + phase);
    }
    if (j.status === 'failed') throw new Error(j.error ?? 'Task failed');
    if (j.status === 'succeeded') {
      report.push({
        stage: kind,
        result: 'passed',
        detail: { threadId: j.threadId, turnId: j.turnId },
      });
      return;
    }
  }
  throw new Error('Evaluation timeout');
}
try {
  const status = await agent.status();
  assert.equal(status.connected, true, status.error || 'Not connected');
  console.log('Connected:', status.auth);
  if (!process.env.MARGIN_EVAL_RESUME) {
    const paper = store.createSession({
      objective:
        'Study the supplied tutorial on variational autoencoders. Focus on the reparameterization trick: derive why it permits gradients through a sampled latent variable, and explain what it does not solve. Use the actual paper, not an abstract-only summary.',
      mode: 'paper',
      hours: 1,
    });
    const source = await sources.importUrl(paper.id, 'https://arxiv.org/pdf/1606.05908');
    console.log('Imported actual paper:', source.title, source.pages.length, 'pages');
    assert.ok(source.pages.length > 3);
    await task(paper.id, 'plan');
    let detail = store.detail(paper.id);
    assert.ok(detail.plan);
    assert.ok(detail.activities.length >= 2);
    const first = detail.activities[0];
    await task(paper.id, 'material', first.id);
    detail = store.detail(paper.id);
    assert.ok(
      detail.activities[0].material?.references.length,
      'Paper instruction must reference actual pages',
    );
    const submission = store.put('submissions', {
      id: id(),
      sessionId: paper.id,
      activityId: first.id,
      text: 'The reparameterization trick makes posterior inference exact and eliminates all Monte Carlo variance. We draw epsilon from a fixed noise distribution and define z = mu + sigma * epsilon, so the resulting z is deterministic and we no longer need an expectation. Therefore a single sample always gives the true gradient.',
      code: '',
      createdAt: now(),
      assessment: null,
      defense: null,
    } satisfies Submission);
    await task(paper.id, 'assess', first.id, submission.id);
    const assessment = store.get<Submission>('submissions', submission.id).assessment!;
    assert.notEqual(assessment.judgment, 'demonstrated');
    assert.ok(assessment.weaknesses.length);
    await task(paper.id, 'defense', first.id, submission.id);
    assert.ok(store.get<Submission>('submissions', submission.id).defense?.reviewers.length! >= 3);
    await task(
      paper.id,
      'tutor',
      first.id,
      null,
      'Give me one hint about why my claim that reparameterization eliminates sampling variance is incorrect. Do not give a full solution.',
    );
    await task(paper.id, 'complete');
    assert.equal(store.list<Recommendation>('recommendations', paper.id).length, 6);
    const investigation = store.createSession({
      objective:
        'Investigate how the standard error of a Monte Carlo sample mean depends on sample size. Build one executable standard-library Python lab with adjustable sample size and noise, repeated independent replicates, explicit hypotheses, controls, seeded synthetic observations, and a report. Include a brief reading activity before the lab. Keep the session to one hour.',
      mode: 'investigation',
      hours: 1,
    });
    await task(investigation.id, 'plan');
    detail = store.detail(investigation.id);
    const labActivity = detail.activities.find((a) => a.kind === 'lab');
    assert.ok(labActivity, 'Investigation requires a genuine lab');
    await task(investigation.id, 'material', labActivity.id);
  }
  const lab = store
    .list<import('../shared/schema.ts').Activity>('activities')
    .find((a) => a.material?.lab)?.material?.lab;
  assert.ok(lab);
  const config = Object.fromEntries(lab.controls.map((c) => [c.key, c.initial]));
  const firstRun = await executePython(lab.simulator, { seed: 42, parameters: config });
  assert.equal(firstRun.exitCode, 0, firstRun.stderr);
  assert.ok(
    Array.isArray(firstRun.result?.measurements),
    'Lab must collect actual simulated measurements',
  );
  const repeat = await executePython(lab.simulator, { seed: 42, parameters: config });
  assert.deepEqual(repeat.result, firstRun.result, 'Same seed and condition must reproduce data');
  const varied = await executePython(lab.simulator, { seed: 43, parameters: config });
  assert.equal(varied.exitCode, 0, varied.stderr);
  assert.notDeepEqual(
    varied.result,
    firstRun.result,
    'Different seeds must produce independently sampled observations',
  );
  const analysis = await executePython(
    'import ast\nast.parse(' +
      JSON.stringify(lab.analysisStarter) +
      ')\nprint(\"Analysis scaffold parses; completing it is learner work.\")',
    {},
  );
  assert.equal(analysis.exitCode, 0, analysis.stderr);
  report.push({
    stage: 'generated-lab-execution',
    result: 'passed',
    detail: {
      controls: config,
      measurements: (firstRun.result?.measurements as unknown[]).length,
      reproducible: true,
      analysisStdout: analysis.stdout,
    },
  });
  console.log('All live integration assertions passed.');
} catch (error) {
  report.push({ stage: 'failure', result: 'failed', detail: (error as Error).stack });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(directory, 'evaluation.json'), JSON.stringify(report, null, 2));
  console.log('Review evidence:', join(directory, 'evaluation.json'));
  await learning.shutdown();
  store.close();
}
