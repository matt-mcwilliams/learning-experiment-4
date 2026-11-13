import { z } from 'zod';
import { Store, id, now, AppError } from './store.ts';
import {
  type JobKind,
  type Job,
  type Activity,
  type Material,
  type Plan,
  type Assessment,
  type Defense,
  type Completion,
  type Source,
  type Submission,
  outputSchemas,
} from '../shared/schema.ts';
import { type Agent } from './codex.ts';
import { SourceService } from './sources.ts';
import { excerptPrompt, verifyExcerpts } from './excerpts.ts';
import { ExcerptsSchema } from '../shared/schema.ts';
import { executePython } from './sandbox.ts';
import { editorial, taskPrompt } from './prompts.ts';
export class LearningService {
  controllers = new Map<string, AbortController>();
  constructor(
    public store: Store,
    public sources: SourceService,
    public agent: Agent,
  ) {}
  start(
    sessionId: string,
    kind: JobKind,
    activityId: string | null = null,
    submissionId: string | null = null,
    userText = '',
    chatId: string | null = null,
    retry = false,
  ): Job {
    const detail = this.store.detail(sessionId);
    if (kind === 'plan' && detail.plan) throw new AppError('This session already has a plan.');
    if (['material', 'assess', 'defense', 'excerpts'].includes(kind) && !activityId)
      throw new AppError('Choose an activity.');
    if (activityId) {
      const a = this.store.activity(sessionId, activityId);
      if (kind === 'material' && a.material)
        throw new AppError(
          'This activity is already prepared. Edit the purpose or ask the thinking partner for an adaptation. Existing work is preserved.',
        );
    }
    if (['assess', 'defense'].includes(kind) && !submissionId)
      throw new AppError('Submit your work first.');
    if (submissionId) {
      const s = this.store.get<Submission>('submissions', submissionId);
      if (s.sessionId !== sessionId || s.activityId !== activityId)
        throw new AppError('Submission belongs to another activity.');
    }
    if (kind === 'complete' && !detail.submissions.some((s) => s.assessment))
      throw new AppError('Submit work for review before completing this session.');
    if (detail.status === 'completed' && kind !== 'tutor')
      throw new AppError('Completed work is preserved in your portfolio.');
    if (submissionId) {
      const s = this.store.get<Submission>('submissions', submissionId);
      if ((kind === 'assess' && s.assessment) || (kind === 'defense' && s.defense))
        throw new AppError('This review is already preserved. Submit a revision for a new review.');
    }
    if (
      kind === 'excerpts' &&
      !detail.activities.find((a) => a.id === activityId)?.material?.references.length
    )
      throw new AppError('This activity has no source reading assignments yet.');
    const job = this.store.transaction(() => {
      const chat =
        kind === 'tutor'
          ? chatId
            ? this.store.chat(sessionId, chatId)
            : (detail.chats.at(-1) ?? this.store.createChat(sessionId))
          : null;
      if (kind === 'tutor' && !userText.trim()) throw new AppError('Write a question first.');
      const job = this.store.createJob(sessionId, kind, activityId, submissionId, userText);
      if (chat) {
        const firstMessage = !detail.messages.some((m) => m.chatId === chat.id);
        if (!retry)
          this.store.put('messages', {
            id: id(),
            sessionId,
            chatId: chat.id,
            activityId,
            role: 'user',
            text: userText,
            createdAt: now(),
          });
        this.store.put('chats', {
          ...chat,
          title: firstMessage ? this.store.chatTitle(userText) : chat.title,
          updatedAt: now(),
        });
        return this.store.updateJob(job.id, { chatId: chat.id });
      }
      return job;
    });
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    void this.perform(job, userText, controller.signal);
    return job;
  }
  cancel(jobId: string) {
    const j = this.store.get<Job>('jobs', jobId);
    if (j.status !== 'running') return j;
    this.controllers.get(jobId)?.abort();
    return this.store.updateJob(jobId, { status: 'cancelled', phase: 'Cancelled', error: null });
  }
  async perform(job: Job, userText: string, signal: AbortSignal) {
    try {
      const profile = this.store.profile();
      const detail = this.store.detail(job.sessionId);
      const previous =
        job.kind === 'tutor'
          ? detail.jobs
              .filter(
                (j) =>
                  j.kind === 'tutor' &&
                  j.chatId === job.chatId &&
                  j.status === 'succeeded' &&
                  j.threadId,
              )
              .at(-1)?.threadId
          : null;
      const result = await this.agent.run({
        instructions: editorial,
        prompt:
          job.kind === 'excerpts'
            ? excerptPrompt(
                detail,
                detail.activities.find((a) => a.id === job.activityId)!.material!,
              )
            : taskPrompt(
                job.kind,
                job.kind === 'tutor'
                  ? { ...detail, messages: detail.messages.filter((m) => m.chatId === job.chatId) }
                  : detail,
                profile,
                job.activityId,
                job.submissionId,
                userText,
              ),
        schema: outputSchemas[job.kind],
        model: profile.model,
        webResearch: job.kind === 'excerpts' ? false : profile.webResearch,
        threadId: previous,
        tools: job.kind === 'excerpts' ? {} : this.sources.tools(job.sessionId),
        signal,
        onProgress: (phase, ids) => {
          if (!signal.aborted && this.store.get<Job>('jobs', job.id).status === 'running')
            this.store.updateJob(job.id, { phase, ...ids });
        },
      });
      if (signal.aborted) return;
      const parsed = outputSchemas[job.kind].parse(result);
      if (
        job.kind === 'material' &&
        (parsed as Material).references.some(
          (r) =>
            this.store.list<Source>('sources', job.sessionId).find((s) => s.id === r.sourceId)
              ?.mediaType === 'application/pdf',
        )
      ) {
        const material = parsed as Material;
        this.sources.verifyReferences(job.sessionId, material.references);
        const current = this.store.detail(job.sessionId);
        this.store.updateJob(job.id, { phase: 'Formatting source excerpts for reading' });
        try {
          const formatted = await this.agent.run({
            instructions: editorial,
            prompt: excerptPrompt(current, material),
            schema: ExcerptsSchema,
            model: profile.model,
            webResearch: false,
            tools: {},
            signal,
            onProgress: () => {},
          });
          material.excerpts = verifyExcerpts(current, material, formatted);
        } catch (error) {
          material.excerptError = (error as Error).message.slice(0, 1200);
        }
      }
      if (job.kind === 'material' && (parsed as Material).lab) {
        const material = parsed as Material,
          lab = material.lab!;
        this.store.updateJob(job.id, { phase: 'Checking the apparatus in the Linux sandbox' });
        // A technical smoke test is not a learner trial and never enters the evidence ledger.
        const check = await executePython(lab.simulator, {
          seed: 0,
          parameters: Object.fromEntries(lab.controls.map((c) => [c.key, c.initial])),
        });
        const measurements = check.result?.measurements;
        if (
          check.exitCode !== 0 ||
          !Array.isArray(measurements) ||
          measurements.length < 1 ||
          measurements.length > 3000
        )
          throw new AppError(
            'The generated apparatus failed its startup check. No material was published. ' +
              check.stderr.slice(0, 1800),
            422,
          );
        const syntax = await executePython(
          'import ast\nast.parse(' + JSON.stringify(lab.analysisStarter) + ')',
          {},
        );
        if (syntax.exitCode !== 0)
          throw new AppError(
            'The analysis scaffold has a syntax error. Retry preparation. ' +
              syntax.stderr.slice(0, 1000),
            422,
          );
        material.technicalCheck = {
          checkedAt: now(),
          measurements: measurements.length,
          runtime: check.runtime,
        };
      }
      if (signal.aborted) return;
      this.store.transaction(() => {
        if (job.kind === 'excerpts') {
          const a = this.store.activity(job.sessionId, job.activityId!);
          const excerpts = verifyExcerpts(this.store.detail(job.sessionId), a.material!, parsed);
          this.store.put('activities', {
            ...a,
            material: { ...a.material!, excerpts, excerptError: undefined },
          });
        } else if (job.kind === 'material') {
          const material = parsed as Material;
          this.sources.verifyReferences(job.sessionId, material.references);
          const a = this.store.activity(job.sessionId, job.activityId!);
          if (a.kind === 'lab' && !material.lab)
            throw new AppError(
              'The agent did not provide an executable apparatus. Retry the activity.',
              422,
            );
          if (material.lab)
            for (const c of material.lab.controls)
              if (c.min > c.max || c.initial < c.min || c.initial > c.max)
                throw new AppError('Invalid laboratory controls. Retry this activity.', 422);
          this.store.put('activities', {
            ...a,
            material,
            state: 'ready',
            code: a.code || material.starterCode,
          });
        } else if (job.kind === 'tutor') {
          const response = parsed as z.infer<typeof outputSchemas.tutor>;
          this.sources.verifyReferences(job.sessionId, response.references);
          this.store.put('messages', {
            id: id(),
            sessionId: job.sessionId,
            activityId: job.activityId,
            chatId: job.chatId!,
            role: 'assistant',
            text: response.answer,
            createdAt: now(),
          });
          this.store.put('chats', {
            ...this.store.chat(job.sessionId, job.chatId!),
            updatedAt: now(),
          });
        }
        // These operations have their own transactions, and run immediately below.
      });
      if (job.kind === 'plan') this.store.setPlan(job.sessionId, parsed as Plan);
      else if (job.kind === 'assess')
        this.store.saveAssessment(job.submissionId!, parsed as Assessment);
      else if (job.kind === 'defense') this.store.saveDefense(job.submissionId!, parsed as Defense);
      else if (job.kind === 'complete') {
        const c = parsed as Completion;
        if (new Set(c.recommendations.map((r) => r.kind)).size !== 6)
          throw new AppError(
            'The recommendations did not provide six distinct directions. Retry synthesis.',
            422,
          );
        this.store.complete(job.sessionId, c);
      }
      this.store.updateJob(job.id, { status: 'succeeded', phase: 'Ready', error: null });
    } catch (error) {
      if (!signal.aborted)
        this.store.updateJob(job.id, {
          status: 'failed',
          phase: 'Needs attention',
          error: (error as Error).message.slice(0, 3000),
        });
    } finally {
      this.controllers.delete(job.id);
    }
  }
  async shutdown() {
    for (const controller of this.controllers.values()) controller.abort();
  }
}
