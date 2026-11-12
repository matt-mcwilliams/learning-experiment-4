import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FlaskConical,
  HelpCircle,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  Sparkles,
  Upload,
  X,
  Pencil,
  Eye,
  EyeOff,
  Code2,
  RotateCcw,
} from 'lucide-react';
import type {
  Activity,
  SessionDetail,
  Job,
  Submission,
  Run,
  Profile,
  Completion,
} from '../../shared/schema';
import type { AgentStatus, Bootstrap } from '../App';
import { api, upload } from '../api';
import { Markdown, Empty, Loading, Modal, date } from './Primitives';
import { useDraft } from './useDraft';
import DockWorkspace, { type WorkspaceTab, type DockHandle } from './DockWorkspace';
import ReadingExcerpts from './ReadingExcerpts';
const Editor = lazy(() => import('./Editor'));
const DocumentEditor = lazy(() => import('./DocumentEditor'));
const Sources = lazy(() => import('./Sources'));
const Laboratory = lazy(() => import('./Laboratory'));
const Output = lazy(() => import('./Laboratory').then((m) => ({ default: m.RunOutput })));
type Tab = WorkspaceTab;
export default function Workspace({
  detail,
  setDetail,
  refresh,
  report,
  sandbox,
  agent,
  onNew,
}: {
  detail: SessionDetail;
  setDetail: (d: SessionDetail) => void;
  refresh: () => Promise<Bootstrap>;
  report: (s: string) => void;
  sandbox: boolean;
  agent: AgentStatus | null;
  onNew: () => void;
}) {
  const dockHandle = useRef<DockHandle | null>(null);
  const [ask, setAsk] = useState(''),
    [sourceRef, setSourceRef] = useState<{ sourceId: string; page: number } | null>(null),
    [edit, setEdit] = useState(false),
    [finish, setFinish] = useState(false),
    [working, setWorking] = useState(false),
    [closed, setClosed] = useState(false);
  const latestDetail = useRef(detail);
  latestDetail.current = detail;
  const activity =
    detail.activities.find((a) => a.id === detail.currentActivity) || detail.activities[0];
  const activeJob = detail.jobs.find((j) => j.status === 'running');
  const lastJob = detail.jobs.at(-1);
  const setTab = (value: Tab) => dockHandle.current?.open(value);
  const reload = useCallback(async () => {
    const d = await api<SessionDetail>('/sessions/' + detail.id);
    setDetail(d);
    return d;
  }, [detail.id, setDetail]);
  useEffect(() => {
    if (!activeJob) return;
    const timer = setInterval(() => {
      void reload()
        .then((d) => {
          if (!d.jobs.some((j) => j.status === 'running')) void refresh();
        })
        .catch((e) => report(e.message));
    }, 1600);
    return () => clearInterval(timer);
  }, [activeJob?.id, reload, refresh, report]);
  useEffect(() => {
    setClosed(false);
  }, [activity?.id]);
  const act = async (path: string, body: unknown, method = 'POST') => {
    setWorking(true);
    try {
      await api(path, method, body);
      await reload();
      await refresh();
    } catch (e) {
      report((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const task = async (kind: string, submissionId?: string, text = '') => {
    await act(`/sessions/${detail.id}/tasks`, {
      kind,
      activityId: activity?.id ?? null,
      submissionId: submissionId ?? null,
      text,
    });
    if (kind === 'assess' || kind === 'defense') setTab('review');
  };
  const question = (text: string) => {
    setAsk(text);
    setTab('tutor');
  };
  const changeActivity = async (id: string) => {
    await act('/sessions/' + detail.id, { currentActivity: id }, 'PATCH');
    setTab('read');
  };
  const locked = !!activeJob || working;
  const allowed: Tab[] = (
    [
      'brief',
      ...(activity ? ['read', 'write', ...(activity.kind === 'lab' ? ['lab'] : []), 'review'] : []),
      'sources',
      'notes',
      'files',
      'tutor',
    ] as Tab[]
  ).filter((t) => !closed || !['brief', 'read', 'sources', 'notes', 'files', 'tutor'].includes(t));
  const renderView = (tab: Tab) => (
    <Suspense fallback={<Loading />}>
      {tab === 'brief' && (
        <>
          {detail.plan ? (
            <>
              <div className="brief-intro">
                <span className="eyebrow">SESSION BRIEF · {detail.hours} HOURS</span>
                <h2 className="brief-title">{detail.title}</h2>
                <Markdown>{detail.plan.introduction}</Markdown>
              </div>
              <div className="objectives">
                <h2>What you should be able to defend</h2>
                {detail.plan.objectives.map((o, i) => (
                  <p key={o}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {o}
                  </p>
                ))}
              </div>
              {!!detail.plan.prerequisites.length && (
                <details className="prerequisites">
                  <summary>
                    Useful foundations <span>Advice, never a gate</span>
                  </summary>
                  {detail.plan.prerequisites.map((p) => (
                    <div key={p.concept}>
                      <h4>{p.concept}</h4>
                      <p>{p.why}</p>
                      <p className="muted">Try this: {p.check}</p>
                    </div>
                  ))}
                </details>
              )}
              <div className="route-heading">
                <h2>A route through the ideas</h2>
                <span>Materials are prepared as you approach them.</span>
              </div>
              <div className="route-list">
                {detail.activities.map((a, i) => (
                  <button
                    className="route-card"
                    key={a.id}
                    onClick={() => void changeActivity(a.id)}
                  >
                    <span className={'route-number ' + (a.state === 'done' ? 'done' : '')}>
                      {a.state === 'done' ? <Check size={18} /> : String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <span className="eyebrow">
                        {a.kind} · {a.minutes} MIN{a.closedBook ? ' · CLOSED BOOK' : ''}
                      </span>
                      <h3>{a.title}</h3>
                      <p>{a.purpose}</p>
                    </div>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
              </div>
              {detail.completion ? (
                <SessionSynthesis completion={detail.completion} onNew={onNew} />
              ) : (
                <div className="completion-invite">
                  <span>When you can defend what you've learned.</span>
                  <button disabled={locked} className="secondary" onClick={() => setFinish(true)}>
                    Conclude this session
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty
              eyebrow="THE BEGINNING"
              title={
                activeJob ? 'A thoughtful plan takes a moment.' : 'Start with a coherent question.'
              }
              action={
                !activeJob ? (
                  <button className="primary" disabled={locked} onClick={() => void task('plan')}>
                    Prepare session plan
                    <Sparkles size={16} />
                  </button>
                ) : undefined
              }
            >
              {activeJob
                ? 'Codex is inspecting available sources and arranging the concepts, activities, and evidence this session will need.'
                : 'Attach a source in Sources if you have one, then ask Codex to prepare a plan. No lessons are generated until you need them.'}
            </Empty>
          )}
        </>
      )}
      {activity && tab === 'read' && !closed && (
        <>
          <ActivityHeading
            activity={activity}
            index={activity.position + 1}
            onEdit={() => setEdit(true)}
          />
          {activity.material ? (
            <>
              <Markdown>{activity.material.body}</Markdown>
              <ReadingExcerpts
                activity={activity}
                detail={detail}
                busy={locked}
                onFormat={() => void task('excerpts')}
                onOpen={(ref) => {
                  setSourceRef(ref);
                  setTab('sources');
                }}
              />
              <div className="reading-next">
                <span>Understanding has to survive use.</span>
                <button
                  className="primary"
                  onClick={() => setTab(activity.kind === 'lab' ? 'lab' : 'write')}
                >
                  {activity.kind === 'lab' ? 'Open laboratory' : 'Work through the question'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <PrepareActivity
              activity={activity}
              disabled={locked}
              onPrepare={() => void task('material')}
            />
          )}
        </>
      )}
      {activity && tab === 'write' && (
        <>
          <ActivityHeading
            activity={activity}
            index={activity.position + 1}
            onEdit={() => setEdit(true)}
          />
          {activity.material ? (
            <ActivityWork
              key={activity.id}
              activity={activity}
              detail={detail}
              onUpdate={reload}
              report={report}
              task={task}
              busy={locked}
              closed={closed}
              onClosed={(value) => {
                setClosed(value);
              }}
              sandbox={sandbox}
            />
          ) : (
            <PrepareActivity
              activity={activity}
              disabled={locked}
              onPrepare={() => void task('material')}
            />
          )}
        </>
      )}
      {activity && tab === 'lab' && (
        <>
          {activity.material?.lab ? (
            <Laboratory
              key={activity.id}
              activity={activity}
              detail={detail}
              onUpdate={async () => {
                await reload();
              }}
              report={report}
              sandbox={sandbox}
            />
          ) : (
            <PrepareActivity
              activity={activity}
              disabled={locked}
              onPrepare={() => void task('material')}
            />
          )}
        </>
      )}
      {activity && tab === 'review' && (
        <Review
          activity={activity}
          detail={detail}
          busy={locked}
          task={task}
          onWrite={() => setTab('write')}
          onAsk={question}
        />
      )}
      {tab === 'sources' && !closed && (
        <Sources
          key={sourceRef ? sourceRef.sourceId + '-' + sourceRef.page : 'reader'}
          detail={detail}
          onUpdate={async () => {
            await reload();
          }}
          report={report}
          onAsk={question}
          initialRef={sourceRef}
        />
      )}
      {tab === 'notes' && !closed && <Notebook key={detail.id} detail={detail} report={report} />}
      {tab === 'files' && !closed && <Files detail={detail} onUpdate={reload} report={report} />}
      {tab === 'tutor' && !closed && (
        <aside className="tutor-panel">
          <header>
            <div>
              <Sparkles size={17} />
              <h3>Thinking partner</h3>
            </div>
          </header>
          <div className="tutor-context">
            <span className="eyebrow">IN CONTEXT</span>
            <p>{activity?.title || detail.title}</p>
          </div>
          <div className="conversation" aria-live="polite">
            {!detail.messages.length && (
              <div className="tutor-empty">
                <span className="tutor-star">✳︎</span>
                <h3>Keep the question open.</h3>
                <p>Ask about a passage, test an argument, or request just enough of a hint.</p>
                <button
                  onClick={() =>
                    setAsk(
                      'Give me one useful hint for the current activity, without revealing its solution.',
                    )
                  }
                >
                  A hint, not the solution
                  <ArrowUpRight size={14} />
                </button>
                <button onClick={() => setAsk('What assumption here is easiest to overlook?')}>
                  Find a hidden assumption
                  <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            {detail.messages.map((m) => (
              <div key={m.id} className={'message ' + m.role}>
                <span className="eyebrow">{m.role === 'user' ? 'YOU' : 'MARGIN · AI'}</span>
                <Markdown>{m.text}</Markdown>
              </div>
            ))}
            {activeJob?.kind === 'tutor' && <Loading text="Considering your question…" />}
          </div>
          <form
            className="tutor-input"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ask.trim()) return;
              const text = ask;
              setAsk('');
              await task('tutor', undefined, text);
            }}
          >
            <textarea
              aria-label="Question for thinking partner"
              rows={3}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Work through an idea…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div>
              <span>⌘ / Ctrl + Enter</span>
              <button disabled={locked || !ask.trim()} aria-label="Send question">
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
          <p className="tutor-disclosure">
            AI can be wrong. Sources and your reasoning come first.
          </p>
        </aside>
      )}
    </Suspense>
  );
  return (
    <div className="workspace docked-workspace">
      <h1 className="sr-only">{detail.title}</h1>
      {activeJob && (
        <div className="job-progress" role="status">
          <LoaderCircle size={17} className="spin" />
          <div>
            <strong>{activeJob.phase}</strong>
            <span>
              {activeJob.kind === 'plan'
                ? 'Researching and structuring this session'
                : activeJob.kind === 'assess'
                  ? 'Examining your reasoning against the criteria'
                  : activeJob.kind === 'complete'
                    ? 'Synthesizing evidence and six next directions'
                    : 'Your saved work stays available while Codex works'}
            </span>
          </div>
          <button
            className="text-button"
            onClick={() => void act('/jobs/' + activeJob.id + '/cancel', {})}
          >
            Cancel
            <X size={14} />
          </button>
        </div>
      )}
      {lastJob?.status === 'failed' && (
        <div className="job-error" role="alert">
          <p>
            <strong>The task needs attention.</strong> {lastJob.error}
          </p>
          <button
            className="secondary"
            disabled={locked}
            onClick={() => void act('/jobs/' + lastJob.id + '/retry', {})}
          >
            <RotateCcw size={14} />
            Retry {lastJob.kind === 'material' ? 'preparation' : lastJob.kind}
          </button>
        </div>
      )}
      {detail.status === 'paused' && (
        <div className="paused-notice">
          This session is paused. Its work is still available.
          <button
            className="text-button"
            onClick={() => void act('/sessions/' + detail.id + '/resume', {})}
          >
            Make this my current session
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      <DockWorkspace
        sessionId={detail.id}
        savedLayout={detail.workspaceLayout}
        allowed={allowed}
        handle={dockHandle}
        render={renderView}
        report={report}
      />
      {edit && activity && (
        <EditActivity
          activity={activity}
          onClose={() => setEdit(false)}
          onSave={async (title, purpose) => {
            const current = await api<SessionDetail>('/sessions/' + detail.id);
            const a = current.activities.find((a) => a.id === activity.id)!;
            await act(
              `/sessions/${detail.id}/activities/${activity.id}`,
              { draft: a.draft, code: a.code, revision: a.revision, title, purpose },
              'PATCH',
            );
            setEdit(false);
          }}
        />
      )}
      {finish && (
        <Modal title="Conclude with evidence." onClose={() => setFinish(false)}>
          <p className="form-intro">
            Margin will synthesize what your work demonstrates, preserve unresolved questions, and
            save six distinct possibilities for future sessions.
          </p>
          <p>
            {detail.activities.filter((a) => a.state !== 'done').length} activities are not marked
            done. Completion records the evidence you have; it doesn't certify mastery.
          </p>
          {!detail.submissions.some((s) => s.assessment) && (
            <p className="inline-notice">
              Submit at least one piece of work for review before concluding.
            </p>
          )}
          <footer className="form-footer">
            <button className="text-button" onClick={() => setFinish(false)}>
              Keep working
            </button>
            <button
              className="primary"
              disabled={locked || !detail.submissions.some((s) => s.assessment)}
              onClick={() => {
                setFinish(false);
                void task('complete');
                setTab('brief');
              }}
            >
              Synthesize & save
              <ArrowRight size={16} />
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
const CompassIcon = MoreHorizontal;
function ActivityHeading({
  activity,
  index,
  onEdit,
}: {
  activity: Activity;
  index: number;
  onEdit: () => void;
}) {
  return (
    <div className="activity-heading">
      <div>
        <span className="eyebrow">
          {String(index).padStart(2, '0')} / {activity.kind} · {activity.minutes} MINUTES
        </span>
        <h2>{activity.title}</h2>
        <p>{activity.purpose}</p>
      </div>
      <button className="icon-button" aria-label="Edit activity" onClick={onEdit}>
        <Pencil size={16} />
      </button>
    </div>
  );
}
function PrepareActivity({
  activity,
  disabled,
  onPrepare,
}: {
  activity: Activity;
  disabled: boolean;
  onPrepare: () => void;
}) {
  return (
    <Empty
      eyebrow="PREPARED WHEN YOU NEED IT"
      title="Let's develop this part carefully."
      action={
        <button className="primary" disabled={disabled} onClick={onPrepare}>
          Prepare {activity.kind === 'lab' ? 'apparatus' : 'this activity'}
          <Sparkles size={16} />
        </button>
      }
    >
      The instructor uses the session plan, source pages, and your work so far to develop this
      activity. Later materials stay open to what you discover.
    </Empty>
  );
}
function ActivityWork({
  activity,
  detail,
  onUpdate,
  report,
  task,
  busy,
  closed,
  onClosed,
  sandbox,
}: {
  activity: Activity;
  detail: SessionDetail;
  onUpdate: () => Promise<SessionDetail>;
  report: (s: string) => void;
  task: (kind: string, submissionId?: string, text?: string) => Promise<void>;
  busy: boolean;
  closed: boolean;
  onClosed: (value: boolean) => void;
  sandbox: boolean;
}) {
  const { draft, code, setDraft, setCode, status, save } = useDraft(activity, report);
  const [preview, setPreview] = useState(false),
    [hints, setHints] = useState(0),
    [running, setRunning] = useState(false),
    [computing, setComputing] = useState(false),
    [workTab, setWorkTab] = useState<'response' | 'code'>('response'),
    [sourcesReopened, setSourcesReopened] = useState(false);
  const material = activity.material!;
  const lastRun = detail.runs
    .filter((r) => r.activityId === activity.id && r.kind === 'project')
    .at(-1);
  const submit = async () => {
    setRunning(true);
    try {
      await save();
      const s = await api<Submission>(`/sessions/${detail.id}/submissions`, 'POST', {
        activityId: activity.id,
        text: draft,
        code,
        assistance: { closedBook: closed, hintsRevealed: hints, sourcesReopened },
      });
      await task('assess', s.id);
      await onUpdate();
    } catch (e) {
      report((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="activity-work">
      {activity.closedBook && (
        <div className={'recall-banner ' + (closed ? 'engaged' : '')}>
          <div>
            {closed ? <EyeOff size={18} /> : <Eye size={18} />}
            <p>
              <strong>{closed ? 'Closed-book workspace' : 'Retrieval practice'}</strong>
              {closed
                ? 'Sources, notes and AI are hidden.'
                : 'Put the source aside; use your own reasoning.'}
            </p>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await save();
                await onUpdate();
                if (closed) setSourcesReopened(true);
                onClosed(!closed);
              } catch (error) {
                report((error as Error).message);
              }
            }}
          >
            {closed ? 'Leave closed-book mode' : 'Begin closed-book attempt'}
          </button>
        </div>
      )}
      <details className="assignment document-assignment">
        <summary>
          Assignment <span>{activity.title}</span>
        </summary>
        <Markdown>{material.prompt}</Markdown>
      </details>
      <details className="criteria">
        <summary>What a defensible response needs to establish</summary>
        {activity.criteria.map((c) => (
          <div key={c.name}>
            <strong>{c.name}</strong>
            <p>{c.description}</p>
          </div>
        ))}
      </details>
      <div className="editor-toolbar">
        <div className="segmented">
          <button
            className={workTab === 'response' ? 'active' : ''}
            onClick={() => setWorkTab('response')}
          >
            Response
          </button>
          <button className={workTab === 'code' ? 'active' : ''} onClick={() => setWorkTab('code')}>
            Python workspace
          </button>
        </div>
        <div>
          <span className="save-state" role="status">
            {status === 'Saved' && <Check size={13} />} {status}
          </span>
          {workTab === 'response' && (
            <button className="text-button" onClick={() => setPreview(!preview)}>
              {preview ? 'Return to document' : 'Reading view'}
              <Eye size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="editor-surface">
        <Suspense fallback={<Loading />}>
          {workTab === 'response' ? (
            preview ? (
              <div className="response-preview">
                <Markdown>
                  {draft || '*Your mathematical and written work will appear here.*'}
                </Markdown>
              </div>
            ) : (
              <DocumentEditor label="Written response" value={draft} onChange={setDraft} />
            )
          ) : (
            <Editor label="Project code" language="python" value={code} onChange={setCode} />
          )}
        </Suspense>
      </div>
      <div className="editor-foot">
        <span>
          {workTab === 'response'
            ? 'Rich text · Use the equation button for mathematics'
            : 'Python standard library · 8 CPU seconds · 768 MB · No network'}
        </span>
        {workTab === 'code' && (
          <button
            className="secondary"
            disabled={computing || !sandbox || !code.trim()}
            onClick={async () => {
              setComputing(true);
              try {
                await save();
                await api(`/sessions/${detail.id}/runs`, 'POST', {
                  activityId: activity.id,
                  kind: 'project',
                  code,
                  seed: 42,
                  config: {},
                  hypothesis: '',
                  prediction: '',
                });
                await onUpdate();
              } catch (e) {
                report((e as Error).message);
              } finally {
                setComputing(false);
              }
            }}
          >
            <Play size={14} />
            {computing ? 'Running…' : 'Run code'}
          </button>
        )}
      </div>
      {lastRun && workTab === 'code' && (
        <Suspense fallback={<Loading />}>
          <Output run={lastRun} />
        </Suspense>
      )}
      <div className="submission-actions">
        <button
          className="primary"
          disabled={
            busy || running || (!draft.trim() && !code.trim()) || detail.status === 'completed'
          }
          onClick={() => void submit()}
        >
          {running ? 'Saving submission…' : 'Submit for critique'}
          <ArrowRight size={16} />
        </button>
        <span>Saved as an immutable revision. Your draft stays editable.</span>
      </div>
      {!closed && material.hints.length > 0 && (
        <div className="hint-section">
          <button
            disabled={hints >= material.hints.length}
            className="text-button"
            onClick={() => setHints(hints + 1)}
          >
            <HelpCircle size={15} />
            {hints ? 'One more hint' : 'A little scaffolding'}{' '}
            <span>
              {hints}/{material.hints.length}
            </span>
          </button>
          {material.hints.slice(0, hints).map((hint, i) => (
            <div key={i} className="hint">
              <span className="eyebrow">HINT {i + 1}</span>
              <Markdown>{hint}</Markdown>
            </div>
          ))}
        </div>
      )}
      <button
        className="text-button mark-done"
        onClick={async () => {
          try {
            await save();
            const d = await onUpdate();
            const a = d.activities.find((a) => a.id === activity.id)!;
            await api(`/sessions/${detail.id}/activities/${activity.id}`, 'PATCH', {
              draft,
              code,
              revision: a.revision,
              state: activity.state === 'done' ? 'ready' : 'done',
            });
            await onUpdate();
          } catch (e) {
            report((e as Error).message);
          }
        }}
      >
        <Check size={15} />
        {activity.state === 'done' ? 'Reopen activity' : 'Mark activity done'}
        <span>Personal marker, not a mastery claim</span>
      </button>
    </div>
  );
}
function Review({
  activity,
  detail,
  busy,
  task,
  onWrite,
  onAsk,
}: {
  activity: Activity;
  detail: SessionDetail;
  busy: boolean;
  task: (kind: string, submissionId?: string, text?: string) => Promise<void>;
  onWrite: () => void;
  onAsk: (s: string) => void;
}) {
  const submissions = detail.submissions.filter((s) => s.activityId === activity.id).reverse();
  const [chosen, setChosen] = useState('');
  const selected = submissions.find((s) => s.id === chosen) || submissions[0];
  return (
    <div className="review">
      <span className="eyebrow">CRITIQUE & DEFENSE · AI-SIMULATED</span>
      <h2>Does the reasoning hold?</h2>
      <p className="form-intro">
        An assessment is an argument about evidence. You can examine it, challenge it, and revise
        your work.
      </p>
      {selected ? (
        <>
          <div className="review-select">
            <label>
              Submission
              <select value={selected.id} onChange={(e) => setChosen(e.target.value)}>
                {submissions.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Revision {submissions.length - i} · {date(s.createdAt)}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary" onClick={onWrite}>
              Revise your work
              <Pencil size={14} />
            </button>
          </div>
          <details className="submitted-work">
            <summary>Inspect the work this review is based on</summary>
            <Markdown>{selected.text}</Markdown>
            {selected.code && <pre className="code-block">{selected.code}</pre>}
          </details>
          {selected.assessment ? (
            <>
              <div className={'assessment-summary ' + selected.assessment.judgment}>
                <span className="eyebrow">{selected.assessment.judgment.replaceAll('-', ' ')}</span>
                <Markdown>{selected.assessment.summary}</Markdown>
              </div>
              <div className="criterion-list">
                {selected.assessment.criteria.map((c, i) => (
                  <article className="criterion-result" key={i}>
                    <header>
                      <h4>{c.name}</h4>
                      <span className={'criterion-status ' + c.status}>{c.status}</span>
                    </header>
                    <Markdown>{c.finding}</Markdown>
                    <blockquote>
                      <span className="eyebrow">EVIDENCE</span>
                      {c.evidence}
                    </blockquote>
                  </article>
                ))}
              </div>
              <div className="review-columns">
                <div>
                  <h3>What holds up</h3>
                  {selected.assessment.strengths.map((s, i) => (
                    <Markdown key={i}>{s}</Markdown>
                  ))}
                </div>
                <div>
                  <h3>What needs more work</h3>
                  {selected.assessment.weaknesses.map((s, i) => (
                    <Markdown key={i}>{s}</Markdown>
                  ))}
                </div>
              </div>
              <div className="follow-up">
                <span className="eyebrow">TEST THE UNDERSTANDING</span>
                <Markdown>{selected.assessment.followUp}</Markdown>
                <button className="text-button" onClick={onWrite}>
                  Work through the follow-up
                  <ArrowRight size={15} />
                </button>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  onAsk(
                    `I want to examine or challenge the assessment of submission ${selected.id}. Help me identify whether its findings are actually supported by my work. Here is my concern: `,
                  )
                }
              >
                Challenge this assessment
                <MessageSquare size={15} />
              </button>
            </>
          ) : (
            <Empty
              eyebrow="AWAITING REVIEW"
              title="Your work is preserved."
              action={
                <button
                  disabled={busy}
                  className="primary"
                  onClick={() => void task('assess', selected.id)}
                >
                  Review this submission
                  <ArrowRight size={15} />
                </button>
              }
            >
              Ask Codex to examine the reasoning against the activity's explicit criteria.
            </Empty>
          )}
          <div className="defense-section">
            <h3>Defend the work</h3>
            <p>
              Different critical perspectives. Real questions about your argument. No invented
              authority.
            </p>
            {selected.defense ? (
              <>
                <Markdown>{selected.defense.introduction}</Markdown>
                {selected.defense.reviewers.map((r, i) => (
                  <article className="reviewer" key={i}>
                    <span className="eyebrow">
                      AI REVIEWER {i + 1} / {r.perspective}
                    </span>
                    <Markdown>{r.observation}</Markdown>
                    <blockquote>{r.evidence}</blockquote>
                    <Markdown>{r.question}</Markdown>
                  </article>
                ))}
                <button className="primary" onClick={onWrite}>
                  Write a defense response
                  <ArrowRight size={16} />
                </button>
                <p className="muted">
                  Submit a revision explaining your response to each reviewer. The instructor sees
                  the previous work and defense.
                </p>
              </>
            ) : (
              <button
                disabled={busy}
                className="secondary"
                onClick={() => void task('defense', selected.id)}
              >
                Convene an expert defense
                <Sparkles size={15} />
              </button>
            )}
          </div>
        </>
      ) : (
        <Empty
          eyebrow="EVIDENCE FIRST"
          title="Put an argument on the page."
          action={
            <button className="primary" onClick={onWrite}>
              Open the workspace
              <ArrowRight size={15} />
            </button>
          }
        >
          Submit a derivation, analysis, implementation, or explanation. The review will focus on
          what it actually establishes.
        </Empty>
      )}
    </div>
  );
}
function Notebook({ detail, report }: { detail: SessionDetail; report: (s: string) => void }) {
  const key = 'margin-notes-v1-' + detail.id;
  const [text, setText] = useState(() => localStorage.getItem(key) ?? detail.notes),
    [preview, setPreview] = useState(false),
    [status, setStatus] = useState('Saved');
  const last = useRef(detail.notes),
    value = useRef(text);
  value.current = text;
  useEffect(() => {
    if (text === last.current) return;
    localStorage.setItem(key, text);
    setStatus('Unsaved');
    const timer = setTimeout(() => {
      setStatus('Saving…');
      void api(`/sessions/${detail.id}`, 'PATCH', { notes: text, expectedNotes: last.current })
        .then(() => {
          last.current = text;
          if (value.current === text) {
            localStorage.removeItem(key);
            setStatus('Saved');
          }
        })
        .catch((e) => {
          setStatus('Not saved · recovery copy kept');
          report(e.message);
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [text, detail.id, key, report]);
  return (
    <div className="notebook">
      <span className="eyebrow">THE SESSION NOTEBOOK</span>
      <h2>Keep the unfinished thoughts.</h2>
      <p className="form-intro">
        Connections, questions, rough derivations. A private working document that stays with this
        session.
      </p>
      <div className="editor-toolbar">
        <span className="save-state">{status}</span>
        <button className="text-button" onClick={() => setPreview(!preview)}>
          {preview ? 'Return to document' : 'Reading view'}
          <Eye size={14} />
        </button>
      </div>
      {preview ? (
        <div className="response-preview">
          <Markdown>{text || '*A little room to think.*'}</Markdown>
        </div>
      ) : (
        <DocumentEditor value={text} onChange={setText} label="Session notes" minHeight="440px" />
      )}
    </div>
  );
}
function Files({
  detail,
  onUpdate,
  report,
}: {
  detail: SessionDetail;
  onUpdate: () => Promise<SessionDetail>;
  report: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="files-view">
      <span className="eyebrow">THE WORK, IN FULL</span>
      <h2>Artifacts worth keeping.</h2>
      <p className="form-intro">
        Attach a technical report, code, figures, or data. Code-run outputs are kept here too. PDF,
        Markdown and text reports are also attached as sources so the instructor can inspect their
        contents.
      </p>
      <label className="secondary upload-button">
        <Upload size={16} />
        {busy ? 'Saving…' : 'Attach artifact'}
        <input
          disabled={busy}
          type="file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              await upload(`/sessions/${detail.id}/artifacts`, f);
              if (/\.(pdf|md|txt|tex)$/i.test(f.name))
                await upload(`/sessions/${detail.id}/sources`, f);
              await onUpdate();
            } catch (e) {
              report((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <div className="artifact-list">
        {detail.artifacts.map((a) => (
          <a href={'/api/artifacts/' + a.id} key={a.id}>
            <FileText size={20} />
            <div>
              <strong>{a.name}</strong>
              <span>
                {(a.size / 1024).toFixed(1)} KB · {date(a.createdAt)}
              </span>
            </div>
            <Download size={16} />
          </a>
        ))}
      </div>
      {!detail.artifacts.length && (
        <p className="muted">
          No artifacts yet. Written submissions, code, and experiments are already preserved in
          their own activity records.
        </p>
      )}
      <a className="text-link" href={`/api/sessions/${detail.id}/export`}>
        <Download size={15} />
        Export all structured session records
      </a>
      <details className="task-diagnostics">
        <summary>Agent task diagnostics</summary>
        {detail.jobs.map((j) => (
          <div key={j.id}>
            <strong>
              {j.kind} · {j.status}
            </strong>
            <span>{j.createdAt}</span>
            <code>
              Thread: {j.threadId || 'not started'}
              <br />
              Turn: {j.turnId || 'not started'}
            </code>
            {j.error && <p>{j.error}</p>}
          </div>
        ))}
      </details>
    </div>
  );
}
function EditActivity({
  activity,
  onClose,
  onSave,
}: {
  activity: Activity;
  onClose: () => void;
  onSave: (title: string, purpose: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(activity.title),
    [purpose, setPurpose] = useState(activity.purpose);
  return (
    <Modal title="Adjust this part of the session." onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(title, purpose);
        }}
      >
        <label className="field">
          TITLE
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          PURPOSE
          <textarea
            required
            rows={4}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <p className="muted">
          Existing materials and work are preserved. If materials haven't been prepared, the
          instructor uses your revised purpose.
        </p>
        <footer className="form-footer">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">
            Save adjustment
            <Check size={15} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function SessionSynthesis({ completion, onNew }: { completion: Completion; onNew: () => void }) {
  return (
    <section className="session-synthesis">
      <span className="eyebrow">SESSION SYNTHESIS</span>
      <h2>What the work leaves you with.</h2>
      <Markdown>{completion.synthesis}</Markdown>
      <h3>Demonstrated in this session</h3>
      {completion.demonstrated.map((s, i) => (
        <Markdown key={i}>{s}</Markdown>
      ))}
      <h3>Questions still open</h3>
      {completion.unresolved.map((s, i) => (
        <Markdown key={i}>{s}</Markdown>
      ))}
      <div className="retention">
        <span className="eyebrow">PERFORMANCE & RETENTION</span>
        <p>{completion.retention}</p>
      </div>
      <p>
        Six directions are saved under Possible directions. You can also follow a completely
        different question.
      </p>
      <button className="primary" onClick={onNew}>
        Begin something new
        <Plus size={16} />
      </button>
    </section>
  );
}
