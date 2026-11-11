import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, id, now, AppError } from '../server/store.ts';
import { SourceService, publicAddress, publicUrl } from '../server/sources.ts';
import { executePython, sandboxAvailable } from '../server/sandbox.ts';
import { LearningService } from '../server/learning.ts';
import { taskPrompt } from '../server/prompts.ts';
import { createApp } from '../server/app.ts';
import type { Agent, AgentRequest } from '../server/codex.ts';
import type { Job, Submission, Recommendation, Knowledge, Session } from '../shared/schema.ts';
import { plan, material, labMaterial, assessment, defense, completion } from './fixtures.ts';
class FixtureAgent implements Agent {
  calls: AgentRequest[] = [];
  failure = false;
  async status() {
    return { connected: true, auth: 'TEST FIXTURE — no inference', models: [] };
  }
  async run(request: AgentRequest) {
    this.calls.push(request);
    if (this.failure) throw new Error('Injected transport failure');
    const prompt = request.prompt;
    if (prompt.startsWith('Construct')) return plan;
    if (prompt.startsWith('Prepare')) return material;
    if (prompt.startsWith('Critique')) return assessment;
    if (prompt.startsWith('Conduct')) return defense;
    if (prompt.startsWith('Synthesize')) return completion;
    return { answer: 'One step: expand covariance.', references: [] };
  }
}
async function temporary() {
  const directory = await mkdtemp(join(tmpdir(), 'margin-test-'));
  return { directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
async function settled(store: Store, job: Job) {
  for (let i = 0; i < 100; i++) {
    const j = store.get<Job>('jobs', job.id);
    if (j.status !== 'running') return j;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('job did not settle');
}

test('one active session, resumable drafts, revision conflicts, immutable submissions, and restart durability', async () => {
  const t = await temporary();
  let store = new Store(t.directory);
  try {
    const a = store.createSession({ objective: 'First subject', mode: 'concept', hours: 2 });
    store.setPlan(a.id, plan);
    const activity = store.detail(a.id).activities[0];
    const draft = store.saveDraft(a.id, activity.id, 'An unfinished derivation', 'print(2)', 0);
    assert.equal(draft.revision, 1);
    assert.throws(() => store.saveDraft(a.id, activity.id, 'stale', '', 0), /another window/);
    const b = store.createSession({
      objective: 'Entirely unrelated subject',
      mode: 'paper',
      hours: 3,
    });
    assert.equal(store.session(a.id).status, 'paused');
    store.activate(a.id);
    assert.equal(store.session(b.id).status, 'paused');
    assert.equal(store.list<Session>('sessions').filter((s) => s.status === 'active').length, 1);
    const submission = store.put('submissions', {
      id: id(),
      sessionId: a.id,
      activityId: activity.id,
      text: 'First version',
      code: '',
      createdAt: now(),
      assessment: null,
      defense: null,
    } satisfies Submission);
    store.saveDraft(a.id, activity.id, 'Revised derivation', '', 1);
    assert.equal(store.get<Submission>('submissions', submission.id).text, 'First version');
    store.close();
    store = new Store(t.directory);
    assert.equal(store.detail(a.id).activities[0].draft, 'Revised derivation');
    assert.equal(store.detail(a.id).currentActivity, activity.id);
  } finally {
    store.close();
    await t.cleanup();
  }
});
test('failed cross-record transitions roll back; interrupted jobs recover as retryable failures', async () => {
  const t = await temporary();
  let store = new Store(t.directory);
  try {
    const s = store.createSession({ objective: 'Failure test', mode: 'concept', hours: 1 });
    assert.throws(() =>
      store.transaction(() => {
        store.updateSession(s.id, { notes: 'should roll back' });
        throw new Error('fail');
      }),
    );
    assert.equal(store.session(s.id).notes, '');
    const j = store.createJob(s.id, 'plan', null, null);
    store.close();
    store = new Store(t.directory);
    const recovered = store.get<Job>('jobs', j.id);
    assert.equal(recovered.status, 'failed');
    assert.match(recovered.error!, /stopped/);
    assert.equal(store.createJob(s.id, 'plan', null, null).status, 'running');
  } finally {
    store.close();
    await t.cleanup();
  }
});
test('source quotations must match actual pages; cross-session reads and private-network retrieval are rejected', async () => {
  const t = await temporary();
  const store = new Store(t.directory),
    sources = new SourceService(store);
  try {
    const s = store.createSession({ objective: 'Source integrity', mode: 'paper', hours: 1 });
    const source = await sources.ingest(
      s.id,
      Buffer.from('A source that actually says something.\n\nA second statement.'),
      'paper.txt',
    );
    sources.verifyReferences(s.id, [
      { sourceId: source.id, page: 1, quote: 'actually says something.', purpose: 'test' },
    ]);
    assert.throws(
      () =>
        sources.verifyReferences(s.id, [
          { sourceId: source.id, page: 1, quote: 'An invented quotation', purpose: 'test' },
        ]),
      /did not match/,
    );
    const other = store.createSession({ objective: 'Other session', mode: 'paper', hours: 1 });
    assert.throws(
      () =>
        sources.verifyReferences(other.id, [
          { sourceId: source.id, page: 1, quote: '', purpose: 'test' },
        ]),
      /unavailable/,
    );
    await assert.rejects(
      sources.tools(other.id).read_source.call({ sourceId: source.id, startPage: 1, endPage: 1 }),
      /available pages/,
    );
    assert.equal(
      (
        await sources.ingest(
          s.id,
          Buffer.from('A source that actually says something.\n\nA second statement.'),
          'duplicate.txt',
        )
      ).id,
      source.id,
    );
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '192.168.1.4',
      '::1',
      '::ffff:127.0.0.1',
      '100.64.0.1',
      '0.0.0.0',
    ])
      assert.equal(publicAddress(address), false, address);
    assert.equal(publicAddress('1.1.1.1'), true);
    await assert.rejects(publicUrl('http://127.0.0.1/'), /blocked/);
    await assert.rejects(publicUrl('file:///etc/passwd'), /HTTP/);
    const artifact = await sources.artifact(
      s.id,
      Buffer.from('my code'),
      '../../code.py',
      'text/plain',
    );
    assert.ok(!artifact.name.includes('/'));
    assert.equal((await sources.readBlob(artifact.sha256)).toString(), 'my code');
  } finally {
    store.close();
    await t.cleanup();
  }
});
test('instructional workflow is lazy; assessments preserve evidence; exactly six recommendations survive completion', async () => {
  const t = await temporary();
  const store = new Store(t.directory),
    sources = new SourceService(store),
    agent = new FixtureAgent(),
    learning = new LearningService(store, sources, agent);
  try {
    store.saveProfile({ ...store.profile(), interests: 'SECRET-INTEREST', goals: 'SECRET-GOAL' });
    const s = store.createSession({
      objective: 'A chosen unrelated topic',
      mode: 'concept',
      hours: 1,
    });
    assert.equal((await settled(store, learning.start(s.id, 'plan'))).status, 'succeeded');
    let detail = store.detail(s.id);
    assert.equal(
      detail.activities.every((a) => !a.material),
      true,
    );
    assert.ok(!agent.calls[0].prompt.includes('SECRET-INTEREST'));
    assert.ok(!agent.calls[0].prompt.includes('SECRET-GOAL'));
    const a = detail.activities[0];
    assert.equal(
      (await settled(store, learning.start(s.id, 'material', a.id))).status,
      'succeeded',
    );
    assert.ok(!store.detail(s.id).activities[1].material);
    assert.throws(() => learning.start(s.id, 'complete'), /Submit work/);
    const submission = store.put('submissions', {
      id: id(),
      sessionId: s.id,
      activityId: a.id,
      text: 'Variance decreases with sample size.',
      code: '',
      createdAt: now(),
      assessment: null,
      defense: null,
    } satisfies Submission);
    assert.equal(
      (await settled(store, learning.start(s.id, 'assess', a.id, submission.id))).status,
      'succeeded',
    );
    assert.equal(store.list<Knowledge>('knowledge', s.id)[0].submissionId, submission.id);
    await settled(store, learning.start(s.id, 'defense', a.id, submission.id));
    assert.equal(store.get<Submission>('submissions', submission.id).defense?.reviewers.length, 3);
    assert.equal((await settled(store, learning.start(s.id, 'complete'))).status, 'succeeded');
    assert.equal(store.session(s.id).status, 'completed');
    assert.equal(store.list<Recommendation>('recommendations', s.id).length, 6);
    assert.ok(agent.calls.at(-1)!.prompt.includes('SECRET-GOAL'));
    assert.throws(() => learning.start(s.id, 'complete'), /Completed/);
  } finally {
    await learning.shutdown();
    store.close();
    await t.cleanup();
  }
});
test('agent transport errors are visible and do not publish partial materials; cancellation leaves saved work intact', async () => {
  const t = await temporary();
  const store = new Store(t.directory),
    sources = new SourceService(store),
    agent = new FixtureAgent(),
    learning = new LearningService(store, sources, agent);
  try {
    const s = store.createSession({ objective: 'Recovery', mode: 'concept', hours: 1 });
    agent.failure = true;
    const job = await settled(store, learning.start(s.id, 'plan'));
    assert.equal(job.status, 'failed');
    assert.match(job.error!, /Injected/);
    assert.equal(store.session(s.id).plan, null);
    agent.failure = false;
    assert.equal((await settled(store, learning.start(s.id, 'plan'))).status, 'succeeded');
    const slow: Agent = {
      status: () => agent.status(),
      run: (request) =>
        new Promise((_, reject) =>
          request.signal?.addEventListener('abort', () => reject(new Error('cancelled'))),
        ),
    };
    const l = new LearningService(store, sources, slow);
    const pending = l.start(s.id, 'material', store.detail(s.id).activities[0].id);
    l.cancel(pending.id);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(store.get<Job>('jobs', pending.id).status, 'cancelled');
    assert.ok(store.session(s.id).plan);
  } finally {
    await learning.shutdown();
    store.close();
    await t.cleanup();
  }
});
test('Linux sandbox executes real seeded observations, reproduces data, denies home/network access, and caps output', async (t) => {
  if (!(await sandboxAvailable())) {
    t.skip('bubblewrap not installed; execution remains blocked');
    return;
  }
  const config = { seed: 7, parameters: { n: 20 } };
  const a = await executePython(labMaterial.lab!.simulator, config);
  assert.equal(a.exitCode, 0, a.stderr);
  assert.equal((a.result?.measurements as unknown[]).length, 40);
  const b = await executePython(labMaterial.lab!.simulator, config);
  assert.deepEqual(a.result, b.result);
  const c = await executePython(labMaterial.lab!.simulator, { ...config, seed: 8 });
  assert.notDeepEqual(a.result, c.result);
  const isolation = await executePython(
    "import os, socket\nassert not os.path.exists('/home/matt/.codex/auth.json')\nassert 'OPENAI_API_KEY' not in os.environ\ntry:\n socket.create_connection(('1.1.1.1',443),timeout=1)\n raise Exception('network escaped')\nexcept OSError:\n print('isolated')",
    {},
  );
  assert.equal(isolation.exitCode, 0, isolation.stderr);
  assert.match(isolation.stdout, /isolated/);
  const cap = await executePython("print('x' * (2 * 1024 * 1024))", {});
  assert.notEqual(cap.exitCode, 0);
  assert.match(cap.stderr, /output limit/);
});
test('HTTP boundary enforces local origins, validates activity ownership, persists uploads and exports measurements', async () => {
  const t = await temporary();
  const { app, store } = await createApp({ directory: t.directory, agent: new FixtureAgent() });
  const headers = { host: '127.0.0.1:4317', 'x-margin-client': '1' };
  const request = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, extra = {}) =>
    app.inject({ method, url, payload: payload as any, headers: { ...headers, ...extra } });
  try {
    assert.equal(
      (
        await request(
          'POST',
          '/api/sessions',
          { objective: 'Good test', mode: 'concept', hours: 1 },
          { origin: 'https://evil.example' },
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/sessions',
          headers: { host: '127.0.0.1:4317' },
          payload: {},
        })
      ).statusCode,
      403,
    );
    const response = await request('POST', '/api/sessions', {
      objective: 'A real workflow',
      mode: 'concept',
      hours: 2,
    });
    assert.equal(response.statusCode, 201);
    const s = response.json();
    store.setPlan(s.id, plan);
    const a = store.detail(s.id).activities[0];
    assert.equal(
      (
        await request('PATCH', `/api/sessions/${s.id}/activities/${a.id}`, {
          draft: 'Actual text',
          code: '',
          revision: 0,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await request('PATCH', `/api/sessions/${s.id}/activities/${a.id}`, {
          draft: 'Lost update',
          code: '',
          revision: 0,
        })
      ).statusCode,
      409,
    );
    const exported = await request('GET', `/api/sessions/${s.id}/export`);
    assert.equal(exported.statusCode, 200);
    assert.equal(exported.json().activities[0].draft, 'Actual text');
    assert.equal(exported.headers['cache-control'], 'no-store');
    const other = store.createSession({ objective: 'Other session', mode: 'paper', hours: 1 });
    assert.equal(
      (
        await request('POST', `/api/sessions/${other.id}/submissions`, {
          activityId: a.id,
          text: 'Wrong owner',
          code: '',
        })
      ).statusCode,
      404,
    );
    const lab = store.detail(s.id).activities[1];
    store.put('activities', { ...lab, material: labMaterial, state: 'ready' });
    assert.equal(
      (
        await request('POST', `/api/sessions/${s.id}/runs`, {
          activityId: lab.id,
          kind: 'trial',
          seed: 42,
          config: { n: 16 },
          hypothesis: '',
          prediction: '',
        })
      ).statusCode,
      400,
    );
    if (await sandboxAvailable()) {
      const run = await request('POST', `/api/sessions/${s.id}/runs`, {
        activityId: lab.id,
        kind: 'trial',
        seed: 42,
        config: { n: 16 },
        hypothesis: 'Spread decreases with n.',
        prediction: 'A standard deviation near 0.25.',
      });
      assert.equal(run.statusCode, 200);
      assert.equal(run.json().exitCode, 0);
      const csv = await request('GET', `/api/sessions/${s.id}/data.csv`);
      assert.match(csv.body, /sample_mean/);
      assert.equal(csv.body.split('\n').length, 41);
    }
  } finally {
    await app.close();
    await t.cleanup();
  }
});
