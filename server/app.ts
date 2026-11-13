import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { z, ZodError } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Store, AppError, id, now } from './store.ts';
import { SourceService, normalize, MAX_SOURCE_BYTES } from './sources.ts';
import { CodexAgent, type Agent } from './codex.ts';
import { LearningService } from './learning.ts';
import { sandboxAvailable, executePython } from './sandbox.ts';
import {
  type Activity,
  type Source,
  type Submission,
  type JobKind,
  type Job,
  type Run,
  type Knowledge,
  type Artifact,
  type Recommendation,
  type Session,
  type Profile,
  ActivitySpec,
} from '../shared/schema.ts';

export async function createApp(options: {
  directory: string;
  agent?: Agent;
  staticRoot?: string;
  port?: number;
  dev?: boolean;
  logger?: boolean;
}) {
  const store = new Store(options.directory);
  const sources = new SourceService(store);
  const agent = options.agent ?? new CodexAgent(options.directory);
  const learning = new LearningService(store, sources, agent);
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 30000,
  });
  const port = options.port ?? 4317;
  const allowedHosts = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    ...(options.dev ? [`127.0.0.1:${port + 1}`, `localhost:${port + 1}`] : []),
  ]);
  app.addHook('onRequest', async (request, reply) => {
    if (!allowedHosts.has(request.headers.host ?? ''))
      return reply.code(403).send({ error: 'Only local requests are allowed.' });
    if (request.url.startsWith('/api/')) {
      const origin = request.headers.origin;
      if (origin) {
        let host = '';
        try {
          host = new URL(origin).host;
        } catch {}
        if (!allowedHosts.has(host))
          return reply.code(403).send({ error: 'Cross-origin requests are blocked.' });
      }
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        request.headers['x-margin-client'] !== '1'
      )
        return reply.code(403).send({ error: 'Missing local client header.' });
      reply.header('Cache-Control', 'no-store');
    }
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self'${options.dev ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'${options.dev ? ' ws://127.0.0.1:* ws://localhost:*' : ''}; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`,
    );
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // Fonts, lazy UI chunks and PDF decoders are ordinary static assets. Loading
    // or reloading a document must not consume the API's request allowance.
    allowList: (request) => !request.url.startsWith('/api/'),
  });
  await app.register(multipart, {
    limits: { fileSize: MAX_SOURCE_BYTES, files: 1, fields: 3, parts: 4 },
  });
  app.setErrorHandler((error, request, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = error instanceof ZodError ? 400 : (e.statusCode ?? 500);
    if (status >= 500) request.log.error(error);
    const message =
      error instanceof ZodError
        ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : e.message;
    reply.code(status).send({ error: message });
  });
  let statusCache: { value: Awaited<ReturnType<Agent['status']>>; time: number } | null = null;
  app.get('/api/health', async () => ({ ok: true, name: 'Margin', version: '0.1.0' }));
  app.get('/api/bootstrap', async () => ({
    profile: store.profile(),
    sessions: store.list<Session>('sessions').reverse(),
    recommendations: store.list<Recommendation>('recommendations').reverse(),
    knowledge: store.list<Knowledge>('knowledge').reverse(),
    sandbox: await sandboxAvailable(),
  }));
  app.get('/api/agent', async (request) => {
    const query = request.query as { refresh?: string };
    if (!statusCache || Date.now() - statusCache.time > 300000 || query.refresh)
      statusCache = { value: await agent.status(), time: Date.now() };
    return statusCache.value;
  });
  app.put('/api/profile', async (request) => {
    const profile = z
      .object({
        interests: z.string().max(5000),
        goals: z.string().max(5000),
        onboarded: z.boolean(),
        model: z.string().max(150),
        webResearch: z.boolean(),
      })
      .parse(request.body);
    return store.saveProfile(profile);
  });
  app.post('/api/sessions', async (request, reply) => {
    const input = z
      .object({
        objective: z.string().trim().min(3).max(6000),
        mode: z.enum(['paper', 'concept', 'investigation', 'project']),
        hours: z.number().min(1).max(10),
      })
      .parse(request.body);
    return reply.code(201).send(store.createSession(input));
  });
  const params = (request: { params: unknown }) =>
    z.object({ sid: z.string().uuid() }).passthrough().parse(request.params);
  app.get('/api/sessions/:sid', async (request) => store.detail(params(request).sid));
  app.patch('/api/sessions/:sid', async (request) => {
    const body = z
      .object({
        notes: z.string().max(200000).optional(),
        currentActivity: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200).optional(),
        revision: z.number().int().optional(),
        expectedNotes: z.string().optional(),
        workspaceLayout: z.record(z.string(), z.unknown()).optional(),
        readerState: z
          .object({ sourceId: z.string(), page: z.number().int().min(1), original: z.boolean() })
          .optional(),
      })
      .parse(request.body);
    const { revision, expectedNotes, ...patch } = body;
    if (expectedNotes !== undefined && store.session(params(request).sid).notes !== expectedNotes)
      throw new AppError(
        'Your notebook changed in another window. A recovery copy is kept in this browser.',
        409,
      );
    if (patch.readerState) {
      const source = store.get<Source>('sources', patch.readerState.sourceId);
      if (source.sessionId !== params(request).sid || patch.readerState.page > source.pages.length)
        throw new AppError('Source page not found', 404);
    }
    return store.updateSession(params(request).sid, patch, revision);
  });
  app.post('/api/sessions/:sid/resume', async (request) => store.activate(params(request).sid));
  app.patch('/api/sessions/:sid/activities/:aid', async (request) => {
    const { sid, aid } = z.object({ sid: z.string(), aid: z.string() }).parse(request.params);
    const body = z
      .object({
        draft: z.string().max(200000),
        code: z.string().max(200000),
        revision: z.number().int(),
        state: z.enum(['pending', 'ready', 'done']).optional(),
        title: z.string().min(1).max(200).optional(),
        purpose: z.string().max(4000).optional(),
      })
      .parse(request.body);
    return store.transaction(() => {
      const result = store.saveDraft(sid, aid, body.draft, body.code, body.revision);
      const updated = store.put('activities', {
        ...result,
        ...(body.state ? { state: body.state } : {}),
        ...(body.title ? { title: body.title } : {}),
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
      });
      if (body.title !== undefined || body.purpose !== undefined) {
        const s = store.session(sid);
        if (s.plan)
          store.put('sessions', {
            ...s,
            plan: {
              ...s.plan,
              activities: s.plan.activities.map((a, i) =>
                i === updated.position
                  ? { ...a, title: updated.title, purpose: updated.purpose }
                  : a,
              ),
            },
            revision: s.revision + 1,
            updatedAt: now(),
          });
      }
      return updated;
    });
  });
  app.patch('/api/sessions/:sid/activities/:aid/lab-state', async (request) => {
    const { sid, aid } = z.object({ sid: z.string(), aid: z.string() }).parse(request.params);
    const body = z
      .object({ state: z.record(z.string(), z.unknown()), revision: z.number().int().min(0) })
      .parse(request.body);
    const a = store.activity(sid, aid);
    if ((a.labStateRevision ?? 0) !== body.revision)
      throw new AppError('The laboratory changed in another window. Reload before saving.', 409);
    return store.put('activities', {
      ...a,
      labState: body.state,
      labStateRevision: body.revision + 1,
    });
  });
  app.post('/api/sessions/:sid/sources', async (request) => {
    const sid = params(request).sid;
    store.session(sid);
    const file = await request.file();
    if (!file) throw new AppError('Choose a document.');
    const data = await file.toBuffer();
    if (file.file.truncated) throw new AppError('File exceeds 20 MB.', 413);
    return sources.ingest(sid, data, file.filename, 'upload', null, file.mimetype);
  });
  app.post('/api/sessions/:sid/sources/url', async (request) => {
    const body = z.object({ url: z.string().url().max(2500) }).parse(request.body);
    return sources.importUrl(params(request).sid, body.url);
  });
  app.get('/api/sessions/:sid/sources/:sourceId/original', async (request, reply) => {
    const { sid, sourceId } = z
      .object({ sid: z.string(), sourceId: z.string() })
      .parse(request.params);
    const source = store.get<Source>('sources', sourceId);
    if (source.sessionId !== sid) throw new AppError('Source not found', 404);
    if (source.mediaType === 'application/pdf') reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header(
      'Content-Disposition',
      `${source.mediaType === 'application/pdf' ? 'inline' : 'attachment'}; filename="source${source.mediaType === 'application/pdf' ? '.pdf' : '.txt'}"`,
    );
    return reply
      .type(source.mediaType === 'application/pdf' ? 'application/pdf' : 'application/octet-stream')
      .send(await sources.readBlob(source.sha256));
  });
  const annotationBody = z.object({
    sourceId: z.string(),
    page: z.number().int().min(1),
    kind: z.enum(['highlight', 'sticky']).optional(),
    quote: z.string().max(8000),
    note: z.string().max(20000),
    rects: z
      .array(
        z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().positive().max(1),
            height: z.number().positive().max(1),
          })
          .refine(
            (r) => r.x + r.width <= 1.002 && r.y + r.height <= 1.002,
            'Rectangle must stay on the page',
          ),
      )
      .max(300)
      .optional(),
    anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  });
  const saveAnnotation = (sid: string, raw: unknown, annotationId?: string) => {
    const body = annotationBody.parse(raw),
      source = store.get<Source>('sources', body.sourceId);
    if (source.sessionId !== sid || !source.pages[body.page - 1])
      throw new AppError('Source page not found', 404);
    if (annotationId) {
      const existing = store.get<import('../shared/schema.ts').Annotation & { sessionId: string }>(
        'annotations',
        annotationId,
      );
      if (
        existing.sessionId !== sid ||
        existing.sourceId !== body.sourceId ||
        existing.page !== body.page
      )
        throw new AppError('Annotation not found', 404);
    }
    // PDF.js selection is grounded geometrically in the original PDF. Poppler's text
    // order/ligatures can differ; those user-authored selections are not AI quotations.
    if (
      body.quote &&
      !(source.mediaType === 'application/pdf' && body.rects?.length) &&
      !normalize(source.pages[body.page - 1]).includes(normalize(body.quote))
    )
      throw new AppError('The selected passage does not match this source page.');
    return store.put('annotations', {
      ...body,
      id: annotationId ?? id(),
      sessionId: sid,
      createdAt: annotationId
        ? store.get<import('../shared/schema.ts').Annotation>('annotations', annotationId).createdAt
        : now(),
    });
  };
  app.post('/api/sessions/:sid/annotations', async (request) =>
    saveAnnotation(params(request).sid, request.body),
  );
  app.patch('/api/sessions/:sid/annotations/:annotationId', async (request) =>
    saveAnnotation(
      params(request).sid,
      request.body,
      z.object({ annotationId: z.string() }).parse(request.params).annotationId,
    ),
  );
  app.delete('/api/sessions/:sid/annotations/:annotationId', async (request) => {
    const { sid, annotationId } = z
      .object({ sid: z.string(), annotationId: z.string() })
      .parse(request.params);
    const record = store.get<{ sessionId: string }>('annotations', annotationId);
    if (record.sessionId !== sid) throw new AppError('Annotation not found', 404);
    store.db
      .prepare('DELETE FROM records WHERE collection=? AND id=?')
      .run('annotations', annotationId);
    return { deleted: true };
  });
  app.post('/api/sessions/:sid/chats', async (request) => store.createChat(params(request).sid));
  app.post('/api/sessions/:sid/tasks', async (request) => {
    const sid = params(request).sid;
    const body = z
      .object({
        kind: z.enum(['plan', 'material', 'assess', 'tutor', 'complete', 'defense', 'excerpts']),
        activityId: z.string().nullable().optional(),
        submissionId: z.string().nullable().optional(),
        text: z.string().max(40000).default(''),
        chatId: z.string().nullable().optional(),
      })
      .parse(request.body);
    const job = learning.start(
      sid,
      body.kind,
      body.activityId ?? null,
      body.submissionId ?? null,
      body.text,
      body.chatId ?? null,
    );
    return job;
  });
  app.post('/api/jobs/:jid/cancel', async (request) =>
    learning.cancel(z.object({ jid: z.string() }).parse(request.params).jid),
  );
  app.post('/api/jobs/:jid/retry', async (request) => {
    const job = store.get<Job>('jobs', z.object({ jid: z.string() }).parse(request.params).jid);
    if (job.status === 'running') throw new AppError('This task is still running.');
    const userText =
      z.object({ text: z.string().max(40000).optional() }).parse(request.body ?? {}).text ??
      job.requestText ??
      '';
    return learning.start(
      job.sessionId,
      job.kind,
      job.activityId,
      job.submissionId,
      userText,
      job.chatId ?? null,
      true,
    );
  });
  app.post('/api/sessions/:sid/submissions', async (request) => {
    const sid = params(request).sid;
    const body = z
      .object({
        activityId: z.string(),
        text: z.string().max(200000),
        code: z.string().max(200000).default(''),
        assistance: z
          .object({
            closedBook: z.boolean(),
            hintsRevealed: z.number().int().min(0).max(4),
            sourcesReopened: z.boolean(),
          })
          .optional(),
      })
      .parse(request.body);
    store.activity(sid, body.activityId);
    if (!body.text.trim() && !body.code.trim())
      throw new AppError(
        'Write an argument, solution, report, or implementation before submitting.',
      );
    if (store.session(sid).status === 'completed') throw new AppError('This session is complete.');
    return store.put('submissions', {
      ...body,
      id: id(),
      sessionId: sid,
      createdAt: now(),
      assessment: null,
      defense: null,
    } satisfies Submission);
  });
  app.post('/api/sessions/:sid/artifacts', async (request) => {
    const sid = params(request).sid;
    store.session(sid);
    const file = await request.file();
    if (!file) throw new AppError('Choose an artifact.');
    return sources.artifact(sid, await file.toBuffer(), file.filename, file.mimetype);
  });
  app.get('/api/artifacts/:artifactId', async (request, reply) => {
    const artifact = store.get<Artifact>(
      'artifacts',
      z.object({ artifactId: z.string() }).parse(request.params).artifactId,
    );
    return reply
      .type('application/octet-stream')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`,
      )
      .send(await sources.readBlob(artifact.sha256));
  });
  app.post('/api/sessions/:sid/runs', async (request) => {
    const sid = params(request).sid;
    const body = z
      .object({
        activityId: z.string(),
        kind: z.enum(['trial', 'analysis', 'project']),
        seed: z.number().int().min(0).max(4294967295),
        config: z.record(z.string(), z.number()).default({}),
        hypothesis: z.string().max(20000).default(''),
        prediction: z.string().max(20000).default(''),
        code: z.string().max(200000).default(''),
      })
      .parse(request.body);
    const activity = store.activity(sid, body.activityId);
    if (store.session(sid).status === 'completed') throw new AppError('This session is complete.');
    let code = body.code;
    if (body.kind === 'trial') {
      const lab = activity.material?.lab;
      if (!lab) throw new AppError('Prepare the experimental apparatus first.');
      if (!body.hypothesis.trim() || !body.prediction.trim())
        throw new AppError('State a hypothesis and predict an observation before collecting data.');
      for (const c of lab.controls) {
        const value = body.config[c.key];
        if (!Number.isFinite(value) || value < c.min || value > c.max)
          throw new AppError(`Set ${c.label} between ${c.min} and ${c.max}.`);
      }
      if (Object.keys(body.config).some((key) => !lab.controls.some((c) => c.key === key)))
        throw new AppError('Unknown experimental control.');
      code = lab.simulator;
    }
    if (!code.trim()) throw new AppError('Write code before running it.');
    const result = await executePython(code, {
      seed: body.seed,
      parameters: body.config,
      trials: store
        .list<Run>('runs', sid)
        .filter((r) => r.activityId === body.activityId && r.kind === 'trial'),
    });
    const run = store.put('runs', {
      ...body,
      code,
      id: id(),
      sessionId: sid,
      stdout: result.stdout,
      stderr: result.stderr,
      result: result.result,
      exitCode: result.exitCode,
      runtime: result.runtime,
      provenance: body.kind === 'trial' ? 'synthetic' : 'learner-code',
      createdAt: now(),
    } satisfies Run);
    for (const file of result.files)
      await sources.artifact(
        sid,
        file.data,
        `${run.id.slice(0, 8)}-${file.name}`,
        'application/octet-stream',
      );
    return run;
  });
  app.get('/api/sessions/:sid/export', async (request, reply) => {
    const detail = store.detail(params(request).sid);
    // Export contains all structured work; original blobs can be downloaded individually.
    return reply
      .type('application/json')
      .header('Content-Disposition', `attachment; filename="margin-${detail.id}.json"`)
      .send({ format: 'margin-session', version: 1, exportedAt: now(), ...detail });
  });
  app.get('/api/sessions/:sid/data.csv', async (request, reply) => {
    const sid = params(request).sid;
    store.session(sid);
    const rows: Record<string, unknown>[] = [];
    for (const r of store
      .list<Run>('runs', sid)
      .filter((r) => r.kind === 'trial' && r.exitCode === 0)) {
      const values = r.result?.measurements;
      if (Array.isArray(values))
        for (const v of values.slice(0, 3000))
          if (v && typeof v === 'object')
            rows.push({
              ...v,
              run_id: r.id,
              seed: r.seed,
              ...Object.fromEntries(Object.entries(r.config).map(([k, v]) => ['control_' + k, v])),
            });
    }
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const cell = (v: unknown) =>
      '"' +
      String(v ?? '')
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"';
    const csv = [
      keys.map(cell).join(','),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(',')),
    ].join('\n');
    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="measurements.csv"')
      .send(csv);
  });
  app.patch('/api/knowledge/:kid', async (request) => {
    const record = store.get<Knowledge>(
      'knowledge',
      z.object({ kid: z.string() }).parse(request.params).kid,
    );
    const body = z.object({ challenge: z.string().max(20000) }).parse(request.body);
    return store.put('knowledge', { ...record, challenge: body.challenge });
  });
  app.post('/api/recommendations/:rid/start', async (request) => {
    const recommendation = store.get<Recommendation>(
      'recommendations',
      z.object({ rid: z.string() }).parse(request.params).rid,
    );
    const session = store.createSession({
      objective: recommendation.objective,
      mode: recommendation.kind === 'project' ? 'project' : 'concept',
      hours: recommendation.hours,
    });
    store.put('recommendations', { ...recommendation, chosenSessionId: session.id });
    return session;
  });
  const pdfAssets = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
  for (const folder of ['cmaps', 'standard_fonts', 'wasm'])
    await app.register(fastifyStatic, {
      root: resolve(pdfAssets, folder),
      prefix: `/pdfjs/${folder}/`,
      decorateReply: false,
    });
  if (options.staticRoot && existsSync(options.staticRoot)) {
    await app.register(fastifyStatic, { root: options.staticRoot });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'Endpoint not found' })
        : reply.sendFile('index.html'),
    );
  }
  app.addHook('onClose', async () => {
    await learning.shutdown();
    store.close();
  });
  return { app, store, sources, agent, learning };
}
