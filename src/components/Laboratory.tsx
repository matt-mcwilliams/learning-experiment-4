import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FlaskConical, Play, Download, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import type { Activity, SessionDetail, Run } from '../../shared/schema';
import { api } from '../api';
import { Markdown, Loading, date } from './Primitives';
const Editor = lazy(() => import('./Editor'));
export default function Laboratory({
  activity,
  detail,
  onUpdate,
  report,
  sandbox,
}: {
  activity: Activity;
  detail: SessionDetail;
  onUpdate: () => Promise<void>;
  report: (s: string) => void;
  sandbox: boolean;
}) {
  const lab = activity.material?.lab;
  const key = 'margin-lab-v1-' + activity.id;
  const [initial] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(activity.labState ?? {}));
    } catch {
      return activity.labState ?? {};
    }
  });
  const [config, setConfig] = useState<Record<string, number>>(
      initial.config ?? Object.fromEntries(lab?.controls.map((c) => [c.key, c.initial]) ?? []),
    ),
    [seed, setSeed] = useState<number>(initial.seed ?? 42),
    [hypothesis, setHypothesis] = useState(initial.hypothesis ?? ''),
    [prediction, setPrediction] = useState(initial.prediction ?? ''),
    [analysis, setAnalysis] = useState(initial.analysis ?? lab?.analysisStarter ?? ''),
    [running, setRunning] = useState(false),
    [showCode, setShowCode] = useState(false),
    [selected, setSelected] = useState(initial.selected ?? ''),
    [view, setView] = useState<'apparatus' | 'analysis'>(initial.view ?? 'apparatus');
  const runs = detail.runs.filter((r) => r.activityId === activity.id),
    trials = runs.filter((r) => r.kind === 'trial'),
    chosen = runs.find((r) => r.id === selected) || runs.at(-1);
  const revision = useRef(activity.labStateRevision ?? 0),
    last = useRef(JSON.stringify(activity.labState ?? {})),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    const state = { config, seed, hypothesis, prediction, analysis, view, selected };
    const serialized = JSON.stringify(state);
    if (serialized === last.current) return;
    localStorage.setItem(key, serialized);
    const timer = setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          if (serialized === last.current) return;
          const result = await api<Activity>(
            `/sessions/${detail.id}/activities/${activity.id}/lab-state`,
            'PATCH',
            { state, revision: revision.current },
          );
          revision.current = result.labStateRevision!;
          last.current = serialized;
        });
      queue.current.catch((e) => report(e.message));
    }, 800);
    return () => clearTimeout(timer);
  }, [
    key,
    config,
    seed,
    hypothesis,
    prediction,
    analysis,
    view,
    selected,
    activity.id,
    detail.id,
    report,
  ]);
  if (!lab) return null;
  const run = async (kind: 'trial' | 'analysis') => {
    setRunning(true);
    try {
      const result = await api<Run>(`/sessions/${detail.id}/runs`, 'POST', {
        activityId: activity.id,
        kind,
        seed,
        config,
        hypothesis,
        prediction,
        code: kind === 'analysis' ? analysis : '',
      });
      setSelected(result.id);
      await onUpdate();
    } catch (e) {
      report((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="laboratory">
      <div className="lab-banner">
        <FlaskConical size={21} />
        <div>
          <span className="eyebrow">COMPUTATIONAL LABORATORY</span>
          <p>Synthetic observations · Reproducible seeds · Student-directed investigation</p>
        </div>
      </div>
      <h2>{lab.question}</h2>
      {activity.material?.technicalCheck && (
        <p className="technical-check">
          Apparatus startup checked in {activity.material.technicalCheck.runtime}. Test measurements
          are excluded from your trial ledger.
        </p>
      )}
      <div className="lab-tabs">
        <button
          className={view === 'apparatus' ? 'active' : ''}
          onClick={() => setView('apparatus')}
        >
          Apparatus & collection
        </button>
        <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>
          Independent analysis
        </button>
      </div>
      {view === 'apparatus' ? (
        <>
          <div className="assumptions">
            <span className="eyebrow">MODEL & ASSUMPTIONS</span>
            <Markdown>{lab.modelAssumptions}</Markdown>
          </div>
          <div className="variable-grid">
            <div>
              <span className="eyebrow">INDEPENDENT VARIABLE</span>
              <p>{lab.independentVariable}</p>
            </div>
            <div>
              <span className="eyebrow">DEPENDENT VARIABLE</span>
              <p>{lab.dependentVariable}</p>
            </div>
          </div>
          <Markdown>{lab.procedure}</Markdown>
          <label className="field">
            YOUR INVESTIGABLE HYPOTHESIS
            <textarea
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="If I change…, then… because…"
            />
          </label>
          <div className="lab-controls">
            {lab.controls.map((c) => (
              <label className="control" key={c.key}>
                <span>
                  {c.label}
                  <output>{config[c.key]}</output>
                </span>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={config[c.key]}
                  onChange={(e) => setConfig({ ...config, [c.key]: Number(e.target.value) })}
                />
                <span className="range-labels">
                  <small>{c.min}</small>
                  <small>{c.max}</small>
                </span>
              </label>
            ))}
            <label className="field">
              RANDOM SEED
              <input
                type="number"
                min={0}
                max={4294967295}
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="field">
            PREDICT AN OBSERVATION BEFORE REVEALING DATA
            <textarea
              rows={2}
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="For this configuration, I expect to observe…"
            />
          </label>
          <div className="lab-run-row">
            <button
              className="primary"
              disabled={running || !sandbox || !hypothesis.trim() || !prediction.trim()}
              onClick={() => void run('trial')}
            >
              <Play size={15} />
              {running ? 'Collecting measurements…' : 'Collect one trial'}
            </button>
            <span>
              {trials.length} recorded {trials.length === 1 ? 'trial' : 'trials'} · Nothing runs
              automatically
            </span>
          </div>
          <button className="text-button apparatus-toggle" onClick={() => setShowCode(!showCode)}>
            {showCode ? <ChevronUp size={15} /> : <ChevronDown size={15} />}Inspect the apparatus
            source
          </button>
          {showCode && <pre className="code-block">{lab.simulator}</pre>}
        </>
      ) : (
        <>
          <p className="form-intro">
            Your trial records are available as <code>trials.json</code>. Write your own analysis;
            leave uncertainty visible. Standard-library Python, no network.
          </p>
          <Suspense fallback={<Loading />}>
            <Editor
              language="python"
              label="Analysis code"
              value={analysis}
              onChange={setAnalysis}
            />
          </Suspense>
          <button
            className="primary"
            disabled={running || !sandbox}
            onClick={() => void run('analysis')}
          >
            <Play size={15} />
            {running ? 'Running analysis…' : 'Run analysis'}
          </button>
        </>
      )}
      {!sandbox && (
        <p className="inline-notice">
          Execution is blocked because the Linux sandbox is unavailable. Run npm run setup.
        </p>
      )}
      <div className="measurements-header">
        <h3>The experiment ledger</h3>
        <a className="text-link" href={`/api/sessions/${detail.id}/data.csv`}>
          <Download size={14} />
          Export measurements
        </a>
      </div>
      {runs.length ? (
        <>
          <div className="run-selector">
            {runs.map((r, i) => (
              <button
                key={r.id}
                className={chosen?.id === r.id ? 'selected' : ''}
                onClick={() => setSelected(r.id)}
              >
                {r.kind === 'trial' ? 'Trial' : 'Analysis'} {i + 1}
                <span className={'run-dot ' + (r.exitCode === 0 ? 'success' : 'failed')} />
              </button>
            ))}
          </div>
          {chosen && (
            <div className="run-detail">
              <div className="eyebrow">
                SEED {chosen.seed} · {date(chosen.createdAt)} · EXIT {chosen.exitCode}{' '}
                {chosen.runtime ? ' · ' + chosen.runtime : ''}
              </div>
              {chosen.kind === 'trial' && (
                <div className="trial-record">
                  <p>
                    <strong>Hypothesis</strong>
                    {chosen.hypothesis}
                  </p>
                  <p>
                    <strong>Prediction</strong>
                    {chosen.prediction}
                  </p>
                  <p>
                    <strong>Controls</strong>
                    {Object.entries(chosen.config)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </p>
                </div>
              )}
              {chosen.result && <Measurements value={chosen.result} />}
              <RunOutput run={chosen} />
              <details>
                <summary>Inspect this run's source</summary>
                <pre className="code-block">{chosen.code}</pre>
              </details>
            </div>
          )}
        </>
      ) : (
        <p className="muted empty-ledger">
          No measurements yet. State a hypothesis, choose a condition, then collect a trial.
        </p>
      )}
      <div className="limitations">
        <span className="eyebrow">WHAT THIS APPARATUS CANNOT ESTABLISH</span>
        <Markdown>{lab.limitations}</Markdown>
      </div>
    </div>
  );
}
export function RunOutput({ run }: { run: Run }) {
  return (
    <div className="run-output">
      {run.stdout && <pre>{run.stdout}</pre>}
      {run.stderr && <pre className="stderr">{run.stderr}</pre>}
      {!run.stdout && !run.stderr && (
        <p>Run completed with exit code {run.exitCode}. No console output.</p>
      )}
    </div>
  );
}
function Measurements({ value }: { value: Record<string, unknown> }) {
  const rows = Array.isArray(value.measurements)
    ? (value.measurements.filter((v) => v && typeof v === 'object').slice(0, 3000) as Record<
        string,
        unknown
      >[])
    : [];
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const numeric = keys.filter((k) => rows.every((r) => typeof r[k] === 'number'));
  const [x, setX] = useState(numeric[0] || ''),
    [y, setY] = useState(numeric[1] || numeric[0] || '');
  useEffect(() => {
    setX(numeric[0] || '');
    setY(numeric[1] || numeric[0] || '');
  }, [keys.join('|')]);
  const pts = rows.filter((r) => Number.isFinite(r[x]) && Number.isFinite(r[y]));
  const xs = pts.map((r) => Number(r[x])),
    ys = pts.map((r) => Number(r[y]));
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const px = (v: number) => 55 + ((v - minX) / (maxX - minX || 1)) * 475,
    py = (v: number) => 225 - ((v - minY) / (maxY - minY || 1)) * 195;
  return (
    <div className="measurement-results">
      {numeric.length >= 2 && (
        <>
          <div className="plot-selectors">
            <label>
              x
              <select aria-label="Plot x variable" value={x} onChange={(e) => setX(e.target.value)}>
                {numeric.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              y
              <select aria-label="Plot y variable" value={y} onChange={(e) => setY(e.target.value)}>
                {numeric.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
          </div>
          <svg
            className="scatterplot"
            viewBox="0 0 560 270"
            role="img"
            aria-label={`Observed ${y} against ${x}`}
          >
            <path d="M55 20V225H540" fill="none" stroke="currentColor" opacity="0.25" />
            {pts.slice(0, 2000).map((r, i) => (
              <circle
                key={i}
                cx={px(Number(r[x]))}
                cy={py(Number(r[y]))}
                r={3}
                fill="var(--accent)"
                opacity="0.55"
              >
                <title>
                  {x}: {String(r[x])}, {y}: {String(r[y])}
                </title>
              </circle>
            ))}
            <text x="55" y="245">
              {Number.isFinite(minX) ? minX.toPrecision(3) : ''}
            </text>
            <text x="500" y="245">
              {Number.isFinite(maxX) ? maxX.toPrecision(3) : ''}
            </text>
            <text x="5" y="225">
              {Number.isFinite(minY) ? minY.toPrecision(3) : ''}
            </text>
            <text x="5" y="30">
              {Number.isFinite(maxY) ? maxY.toPrecision(3) : ''}
            </text>
          </svg>
          <p className="plot-caption">
            {rows.length} simulated observations. A plot is evidence about this simulator, not
            independent validation of its assumptions.
          </p>
        </>
      )}
      {keys.length > 0 && (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  {keys.map((k) => (
                    <td key={k}>
                      {typeof r[k] === 'number' ? Number(r[k]).toPrecision(5) : String(r[k] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="muted">
              First 50 of {rows.length} rows. Export the full dataset for analysis.
            </p>
          )}
        </div>
      )}
      {value.summary !== undefined && (
        <details>
          <summary>Instrument summary · not your conclusion</summary>
          <pre className="code-block">{JSON.stringify(value.summary, null, 2)}</pre>
        </details>
      )}
      {!rows.length && <pre className="code-block">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}
