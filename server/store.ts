import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Activity,
  Plan,
  Session,
  SessionDetail,
  Source,
  Submission,
  Job,
  JobKind,
  Message,
  Run,
  Artifact,
  Assessment,
  Defense,
  Completion,
  Knowledge,
  Recommendation,
  Profile,
  Annotation,
} from '../shared/schema.ts';
import { defaultProfile } from '../shared/schema.ts';
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

// Structured records live in separate collections; transactions cover every cross-record transition.
// JSON payloads allow activity types to evolve without coupling persistence to model transcripts.
export class Store {
  db: DatabaseSync;
  constructor(public directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    this.db = new DatabaseSync(join(directory, 'margin.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, session_id TEXT, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(collection,id));
      CREATE INDEX IF NOT EXISTS records_session ON records(collection,session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON records(collection) WHERE collection='sessions' AND json_extract(payload,'$.status')='active';
      PRAGMA user_version=1;`);
    this.transaction(() => {
      for (const j of this.list<Job>('jobs').filter((j) => j.status === 'running')) {
        this.put('jobs', {
          ...j,
          status: 'failed',
          phase: 'Interrupted',
          error: 'The server stopped during this task. Your work is intact. Retry when ready.',
          updatedAt: now(),
        });
      }
    });
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  put<T extends { id: string; sessionId?: string }>(collection: string, record: T): T {
    this.db
      .prepare(
        'INSERT INTO records(collection,id,session_id,payload) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET session_id=excluded.session_id,payload=excluded.payload',
      )
      .run(collection, record.id, record.sessionId ?? null, JSON.stringify(record));
    return record;
  }
  get<T>(collection: string, recordId: string): T {
    const row = this.db
      .prepare('SELECT payload FROM records WHERE collection=? AND id=?')
      .get(collection, recordId) as { payload: string } | undefined;
    if (!row) throw new AppError(`${collection}: record not found`, 404);
    return JSON.parse(row.payload);
  }
  list<T>(collection: string, sessionId?: string): T[] {
    const rows =
      sessionId === undefined
        ? this.db
            .prepare('SELECT payload FROM records WHERE collection=? ORDER BY rowid')
            .all(collection)
        : this.db
            .prepare(
              'SELECT payload FROM records WHERE collection=? AND session_id=? ORDER BY rowid',
            )
            .all(collection, sessionId);
    return rows.map((row) => JSON.parse(row.payload as string));
  }
  profile(): Profile {
    try {
      return this.get<Profile>('settings', 'profile');
    } catch {
      return { ...defaultProfile };
    }
  }
  saveProfile(profile: Profile) {
    this.put('settings', { ...profile, id: 'profile' });
    return profile;
  }
  createSession(input: { objective: string; mode: string; hours: number }): Session {
    return this.transaction(() => {
      for (const s of this.list<Session>('sessions').filter((s) => s.status === 'active'))
        this.put('sessions', { ...s, status: 'paused', updatedAt: now() });
      return this.put('sessions', {
        id: id(),
        title: input.objective.slice(0, 100),
        ...input,
        status: 'active',
        plan: null,
        notes: '',
        currentActivity: null,
        createdAt: now(),
        updatedAt: now(),
        completion: null,
        revision: 0,
      } satisfies Session);
    });
  }
  session(sessionId: string) {
    return this.get<Session>('sessions', sessionId);
  }
  activity(sessionId: string, activityId: string) {
    const a = this.get<Activity>('activities', activityId);
    if (a.sessionId !== sessionId) throw new AppError('Activity belongs to another session', 404);
    return a;
  }
  updateSession(
    sessionId: string,
    patch: Partial<Pick<Session, 'notes' | 'currentActivity' | 'title' | 'readerState'>>,
    revision?: number,
  ) {
    const s = this.session(sessionId);
    if (revision !== undefined && revision !== s.revision)
      throw new AppError('This session changed in another window. Reload before saving.', 409);
    if (patch.currentActivity) this.activity(sessionId, patch.currentActivity);
    return this.put('sessions', { ...s, ...patch, revision: s.revision + 1, updatedAt: now() });
  }
  activate(sessionId: string) {
    return this.transaction(() => {
      const target = this.session(sessionId);
      if (target.status === 'completed')
        throw new AppError(
          'Completed sessions remain in the portfolio. Start a new session to extend this work.',
        );
      for (const s of this.list<Session>('sessions').filter((s) => s.status === 'active'))
        this.put('sessions', { ...s, status: 'paused' });
      return this.put('sessions', { ...target, status: 'active', updatedAt: now() });
    });
  }
  setPlan(sessionId: string, plan: Plan) {
    return this.transaction(() => {
      const session = this.session(sessionId);
      if (session.plan)
        throw new AppError(
          'A plan already exists. Edit individual activities to preserve existing work.',
          409,
        );
      const activities = plan.activities.map((a, position) =>
        this.put('activities', {
          ...a,
          id: id(),
          sessionId,
          position,
          state: 'pending',
          material: null,
          draft: '',
          code: '',
          revision: 0,
        } satisfies Activity),
      );
      this.put('sessions', {
        ...session,
        title: plan.title,
        plan,
        currentActivity: activities[0].id,
        updatedAt: now(),
      });
    });
  }
  saveDraft(sessionId: string, activityId: string, draft: string, code: string, revision: number) {
    const a = this.activity(sessionId, activityId);
    if (a.revision !== revision)
      throw new AppError('This draft changed in another window. Copy your text, then reload.', 409);
    return this.put('activities', { ...a, draft, code, revision: revision + 1 });
  }
  detail(sessionId: string): SessionDetail {
    return {
      ...this.session(sessionId),
      activities: this.list<Activity>('activities', sessionId).sort(
        (a, b) => a.position - b.position,
      ),
      sources: this.list<Source>('sources', sessionId),
      submissions: this.list<Submission>('submissions', sessionId),
      annotations: this.list<Annotation & { sessionId: string }>('annotations', sessionId),
      messages: this.list<Message>('messages', sessionId),
      jobs: this.list<Job>('jobs', sessionId),
      runs: this.list<Run>('runs', sessionId),
      artifacts: this.list<Artifact>('artifacts', sessionId),
      knowledge: this.list<Knowledge>('knowledge', sessionId),
    };
  }
  createJob(
    sessionId: string,
    kind: JobKind,
    activityId: string | null,
    submissionId: string | null,
    requestText = '',
  ) {
    this.session(sessionId);
    if (this.list<Job>('jobs', sessionId).some((j) => j.status === 'running'))
      throw new AppError('A learning task is already running in this session.', 409);
    return this.put('jobs', {
      id: id(),
      sessionId,
      activityId,
      submissionId,
      kind,
      requestText,
      status: 'running',
      phase: 'Connecting to Codex',
      error: null,
      threadId: null,
      turnId: null,
      createdAt: now(),
      updatedAt: now(),
    } satisfies Job);
  }
  updateJob(jobId: string, patch: Partial<Job>) {
    return this.put('jobs', { ...this.get<Job>('jobs', jobId), ...patch, updatedAt: now() });
  }
  saveAssessment(submissionId: string, assessment: Assessment) {
    this.transaction(() => {
      const submission = this.get<Submission>('submissions', submissionId);
      this.put('submissions', { ...submission, assessment });
      for (const concept of assessment.concepts)
        this.put('knowledge', {
          id: id(),
          sessionId: submission.sessionId,
          submissionId,
          concept: concept.name,
          understanding: concept.understanding,
          uncertainty: concept.uncertainty,
          confidence: concept.confidence,
          challenge: '',
          createdAt: now(),
        } satisfies Knowledge);
    });
  }
  saveDefense(submissionId: string, defense: Defense) {
    this.put('submissions', { ...this.get<Submission>('submissions', submissionId), defense });
  }
  complete(sessionId: string, completion: Completion) {
    this.transaction(() => {
      const s = this.session(sessionId);
      if (s.status === 'completed') throw new AppError('Session already completed', 409);
      if (!this.list<Submission>('submissions', sessionId).some((s) => s.assessment))
        throw new AppError('Submit work for review before completing a session.');
      for (const r of completion.recommendations)
        this.put('recommendations', {
          ...r,
          id: id(),
          sessionId,
          chosenSessionId: null,
          createdAt: now(),
        } satisfies Recommendation);
      this.put('sessions', { ...s, completion, status: 'completed', updatedAt: now() });
    });
  }
}
