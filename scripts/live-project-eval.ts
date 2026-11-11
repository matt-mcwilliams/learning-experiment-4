// Opt-in real model + real execution evaluation. No production data is modified.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { Store, id, now } from '../server/store.ts';
import { SourceService } from '../server/sources.ts';
import { CodexAgent } from '../server/codex.ts';
import { LearningService } from '../server/learning.ts';
import { executePython } from '../server/sandbox.ts';
import type { Job, JobKind, Submission, Run, Activity } from '../shared/schema.ts';
const directory = await mkdtemp(join(tmpdir(), 'margin-project-eval-'));
console.log('Private evaluation directory:', directory);
const store = new Store(directory),
  sources = new SourceService(store),
  agent = new CodexAgent(directory),
  learning = new LearningService(store, sources, agent);
store.saveProfile({ ...store.profile(), webResearch: false });
async function task(
  sid: string,
  kind: JobKind,
  aid: string | null = null,
  submissionId: string | null = null,
  text = '',
) {
  const job = learning.start(sid, kind, aid, submissionId, text);
  let phase = '';
  for (let i = 0; i < 500; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const state = store.get<Job>('jobs', job.id);
    if (state.phase !== phase) {
      console.log(kind + ': ' + state.phase);
      phase = state.phase;
    }
    if (state.status === 'failed') throw new Error(state.error!);
    if (state.status === 'succeeded') return state;
  }
  throw new Error('Evaluation timed out');
}
try {
  const project = store.createSession({
    objective:
      'Implement and defend an unbiased sample variance estimator in standard-library Python. State IID finite-variance assumptions, derive the denominator, test known inputs and edge cases, report actual execution evidence, and defend the implementation. A focused one-hour original project, not a course.',
    mode: 'project',
    hours: 1,
  });
  await task(project.id, 'plan');
  const activity = store.detail(project.id).activities.find((a) => a.kind === 'project');
  assert.ok(activity, 'A project session must contain original implementation work');
  await task(project.id, 'material', activity.id);
  assert.ok(
    store.activity(project.id, activity.id).material?.starterCode,
    'Programming work needs an editable starter',
  );
  const code =
    "def sample_variance(xs):\n    mean = sum(xs) / len(xs)\n    return sum((x - mean) ** 2 for x in xs) / len(xs)\n\nassert sample_variance([1, 2, 3]) == 1.0, 'Known sample variance should be 1.0'\nprint('All tests passed')\n";
  const execution = await executePython(code, {});
  assert.notEqual(execution.exitCode, 0);
  const run = store.put('runs', {
    id: id(),
    sessionId: project.id,
    activityId: activity.id,
    kind: 'project',
    seed: 42,
    config: {},
    hypothesis: '',
    prediction: '',
    code,
    stdout: execution.stdout,
    stderr: execution.stderr,
    result: execution.result,
    exitCode: execution.exitCode,
    runtime: execution.runtime,
    provenance: 'learner-code',
    createdAt: now(),
  } satisfies Run);
  const submission = store.put('submissions', {
    id: id(),
    sessionId: project.id,
    activityId: activity.id,
    text: `My function estimates the population variance without bias because I divide by n. I believe the test on [1, 2, 3] passes. The actual persisted run is ${run.id}; check its output rather than trusting this report. I have not handled empty or singleton inputs, or justified independence.`,
    code,
    createdAt: now(),
    assessment: null,
    defense: null,
  } satisfies Submission);
  await task(project.id, 'assess', activity.id, submission.id);
  const assessed = store.get<Submission>('submissions', submission.id).assessment!;
  assert.notEqual(assessed.judgment, 'demonstrated');
  assert.ok(assessed.weaknesses.length);
  assert.match(JSON.stringify(assessed), /bias|denominator|n.?1|AssertionError|failed/i);
  await task(project.id, 'defense', activity.id, submission.id);
  assert.ok(store.get<Submission>('submissions', submission.id).defense?.reviewers.length! >= 3);
  const first = await task(
    project.id,
    'tutor',
    activity.id,
    null,
    'Give exactly one hint, without the final derivation, about why the sample-mean centering changes the degrees of freedom.',
  );
  const second = await task(
    project.id,
    'tutor',
    activity.id,
    null,
    'Continue our discussion in one short paragraph: what does the sum of centered residuals tell me?',
  );
  assert.equal(
    second.threadId,
    first.threadId,
    'Contextual tutoring must resume its native thread',
  );
  const investigation = store.createSession({
    objective:
      'Design a one-hour computational investigation of the sample mean standard error. Include one genuine standard-library Python lab with sample size and Gaussian noise controls, independently seeded replicate means, prediction before observations, and a learner-written uncertainty analysis. Instructions must use the Margin controls and ledger, not ask the student to manually copy configuration or trial files.',
    mode: 'investigation',
    hours: 1,
  });
  await task(investigation.id, 'plan');
  const apparatus = store.detail(investigation.id).activities.find((a) => a.kind === 'lab');
  assert.ok(apparatus);
  await task(investigation.id, 'material', apparatus.id);
  const prepared = store.activity(investigation.id, apparatus.id);
  assert.ok(
    prepared.material?.technicalCheck,
    'Generated apparatus must pass startup validation before publication',
  );
  assert.equal(
    store.detail(investigation.id).runs.length,
    0,
    'Startup-test measurements are not learner trials',
  );
  const lab = prepared.material!.lab!;
  const parameters = Object.fromEntries(lab.controls.map((c) => [c.key, c.initial]));
  const a = await executePython(lab.simulator, { seed: 91, parameters }),
    b = await executePython(lab.simulator, { seed: 91, parameters });
  assert.equal(a.exitCode, 0, a.stderr);
  assert.deepEqual(a.result, b.result);
  console.log('Project critique, expert defense, thread resumption, and validated lab all passed.');
  await writeFile(
    join(directory, 'evaluation.json'),
    JSON.stringify(
      {
        passed: true,
        projectId: project.id,
        actualFailedRun: run.id,
        assessment: assessed,
        threadResumed: first.threadId,
        labId: apparatus.id,
        technicalCheck: prepared.material!.technicalCheck,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await learning.shutdown();
  store.close();
}
