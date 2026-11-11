import { z } from 'zod';

export const ActivityKind = z.enum([
  'reading',
  'problem',
  'lab',
  'project',
  'defense',
  'reflection',
]);
export const Criterion = z.object({ name: z.string(), description: z.string() });
export const ActivitySpec = z.object({
  title: z.string().min(1),
  kind: ActivityKind,
  minutes: z.number().int().min(5).max(240),
  purpose: z.string(),
  concepts: z.array(z.string()),
  closedBook: z.boolean(),
  criteria: z.array(Criterion).min(1),
});
export const PlanSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  objectives: z.array(z.string()).min(1),
  prerequisites: z.array(z.object({ concept: z.string(), why: z.string(), check: z.string() })),
  activities: z.array(ActivitySpec).min(2).max(10),
});
export const ReferenceSchema = z.object({
  sourceId: z.string(),
  page: z.number().int().min(1),
  quote: z.string(),
  purpose: z.string(),
});
export const LabSpec = z.object({
  question: z.string(),
  modelAssumptions: z.string(),
  independentVariable: z.string(),
  dependentVariable: z.string(),
  controls: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        label: z.string(),
        min: z.number(),
        max: z.number(),
        step: z.number().positive(),
        initial: z.number(),
      }),
    )
    .min(1)
    .max(8),
  simulator: z.string().min(1),
  analysisStarter: z.string(),
  procedure: z.string(),
  limitations: z.string(),
});
export const MaterialSchema = z.object({
  body: z.string().min(1),
  prompt: z.string().min(1),
  references: z.array(ReferenceSchema),
  hints: z.array(z.string()).max(4),
  starterCode: z.string(),
  lab: LabSpec.nullable(),
});
export const ExcerptsSchema = z.object({
  fragments: z
    .array(
      z.object({
        sourceId: z.string(),
        page: z.number().int().min(1),
        blocks: z
          .array(
            z.object({
              kind: z.enum(['paragraph', 'heading', 'equation', 'list']),
              text: z.string().min(1).max(5000),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .min(1)
    .max(8),
});
export type ReadingExcerpt = z.infer<typeof ExcerptsSchema>['fragments'][number];
export const AssessmentSchema = z.object({
  summary: z.string(),
  judgment: z.enum(['demonstrated', 'developing', 'insufficient-evidence']),
  criteria: z
    .array(
      z.object({
        name: z.string(),
        finding: z.string(),
        evidence: z.string(),
        status: z.enum(['supported', 'partial', 'unsupported', 'uncertain']),
      }),
    )
    .min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  followUp: z.string(),
  concepts: z.array(
    z.object({
      name: z.string(),
      understanding: z.string(),
      uncertainty: z.string(),
      confidence: z.enum(['low', 'moderate', 'high']),
    }),
  ),
});
export const DefenseSchema = z.object({
  introduction: z.string(),
  reviewers: z
    .array(
      z.object({
        perspective: z.string(),
        observation: z.string(),
        evidence: z.string(),
        question: z.string(),
      }),
    )
    .min(3)
    .max(5),
});
export const CompletionSchema = z.object({
  synthesis: z.string(),
  demonstrated: z.array(z.string()),
  unresolved: z.array(z.string()),
  retention: z.string(),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        rationale: z.string(),
        kind: z.enum(['depth', 'foundation', 'research', 'application', 'connection', 'project']),
        objective: z.string(),
        hours: z.number().min(1).max(10),
      }),
    )
    .length(6),
});
export const TutorSchema = z.object({ answer: z.string(), references: z.array(ReferenceSchema) });
export type Plan = z.infer<typeof PlanSchema>;
export type Material = z.infer<typeof MaterialSchema> & {
  excerpts?: ReadingExcerpt[];
  excerptError?: string;
  technicalCheck?: { checkedAt: string; measurements: number; runtime: string };
};
export type Lab = z.infer<typeof LabSpec>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Defense = z.infer<typeof DefenseSchema>;
export type Completion = z.infer<typeof CompletionSchema>;
export type Activity = z.infer<typeof ActivitySpec> & {
  id: string;
  sessionId: string;
  position: number;
  state: 'pending' | 'ready' | 'done';
  material: Material | null;
  draft: string;
  code: string;
  revision: number;
  labState?: Record<string, unknown>;
  labStateRevision?: number;
};
export type Session = {
  id: string;
  title: string;
  objective: string;
  mode: string;
  hours: number;
  status: 'active' | 'paused' | 'completed';
  plan: Plan | null;
  notes: string;
  currentActivity: string | null;
  workspaceLayout?: Record<string, unknown>;
  readerState?: { sourceId: string; page: number; original: boolean };
  createdAt: string;
  updatedAt: string;
  completion: Completion | null;
  revision: number;
};
export type Source = {
  id: string;
  sessionId: string;
  title: string;
  origin: 'upload' | 'url';
  url: string | null;
  mediaType: string;
  sha256: string;
  pages: string[];
  warning: string | null;
  createdAt: string;
};
export type Annotation = {
  id: string;
  sourceId: string;
  page: number;
  quote: string;
  note: string;
  kind?: 'highlight' | 'sticky';
  rects?: { x: number; y: number; width: number; height: number }[];
  anchor?: { x: number; y: number };
  createdAt: string;
};
export type Submission = {
  id: string;
  sessionId: string;
  activityId: string;
  text: string;
  code: string;
  assistance?: { closedBook: boolean; hintsRevealed: number; sourcesReopened: boolean };
  createdAt: string;
  assessment: Assessment | null;
  defense: Defense | null;
};
export type JobKind =
  'plan' | 'material' | 'assess' | 'tutor' | 'complete' | 'defense' | 'excerpts';
export type Job = {
  id: string;
  sessionId: string;
  activityId: string | null;
  submissionId: string | null;
  kind: JobKind;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  phase: string;
  error: string | null;
  requestText: string;
  threadId: string | null;
  turnId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Message = {
  id: string;
  sessionId: string;
  activityId: string | null;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};
export type Run = {
  id: string;
  sessionId: string;
  activityId: string;
  kind: 'trial' | 'analysis' | 'project';
  seed: number;
  config: Record<string, number>;
  hypothesis: string;
  prediction: string;
  code: string;
  stdout: string;
  stderr: string;
  result: Record<string, unknown> | null;
  exitCode: number;
  runtime?: string;
  provenance?: 'synthetic' | 'learner-code';
  createdAt: string;
};
export type Artifact = {
  id: string;
  sessionId: string;
  name: string;
  mediaType: string;
  sha256: string;
  size: number;
  createdAt: string;
};
export type Knowledge = {
  id: string;
  sessionId: string;
  submissionId: string;
  concept: string;
  understanding: string;
  uncertainty: string;
  confidence: string;
  challenge: string;
  createdAt: string;
};
export type Recommendation = Completion['recommendations'][number] & {
  id: string;
  sessionId: string;
  chosenSessionId: string | null;
  createdAt: string;
};
export type SessionDetail = Session & {
  activities: Activity[];
  sources: Source[];
  submissions: Submission[];
  annotations: Annotation[];
  messages: Message[];
  jobs: Job[];
  runs: Run[];
  artifacts: Artifact[];
  knowledge: Knowledge[];
};
export type Profile = {
  interests: string;
  goals: string;
  onboarded: boolean;
  model: string;
  webResearch: boolean;
};
export const defaultProfile: Profile = {
  interests: '',
  goals: '',
  onboarded: false,
  model: '',
  webResearch: true,
};
export const outputSchemas = {
  plan: PlanSchema,
  material: MaterialSchema,
  assess: AssessmentSchema,
  tutor: TutorSchema,
  complete: CompletionSchema,
  defense: DefenseSchema,
  excerpts: ExcerptsSchema,
};
