import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Activity } from '../../shared/schema';
export function useDraft(activity: Activity, report: (text: string) => void) {
  const key = 'margin-draft-v1-' + activity.id;
  const [initial] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v && v.baseRevision === activity.revision
        ? v
        : { draft: activity.draft, code: activity.code };
    } catch {
      return { draft: activity.draft, code: activity.code };
    }
  });
  const [draft, setDraftState] = useState<string>(initial.draft),
    [code, setCodeState] = useState<string>(initial.code),
    [status, setStatus] = useState(
      initial.draft === activity.draft && initial.code === activity.code
        ? 'Saved'
        : 'Recovered draft',
    );
  const revision = useRef(activity.revision),
    latest = useRef({ draft, code }),
    last = useRef({ draft: activity.draft, code: activity.code }),
    queue = useRef<Promise<void>>(Promise.resolve()),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Metadata-only updates (mark-done, plan edits) share the activity revision.
  // Advance only when the server still has the exact draft we last saved.
  useEffect(() => {
    if (
      activity.revision > revision.current &&
      activity.draft === last.current.draft &&
      activity.code === last.current.code
    )
      revision.current = activity.revision;
  }, [activity.revision, activity.draft, activity.code]);
  const persistLocal = useCallback(
    () =>
      localStorage.setItem(
        key,
        JSON.stringify({ ...latest.current, baseRevision: revision.current }),
      ),
    [key],
  );
  const save = useCallback(async () => {
    const value = { ...latest.current };
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (value.draft === last.current.draft && value.code === last.current.code) return;
        if (mounted.current) setStatus('Saving…');
        try {
          const updated = await api<Activity>(
            `/sessions/${activity.sessionId}/activities/${activity.id}`,
            'PATCH',
            { ...value, revision: revision.current },
          );
          revision.current = updated.revision;
          last.current = value;
          if (latest.current.draft === value.draft && latest.current.code === value.code) {
            localStorage.removeItem(key);
            if (mounted.current) setStatus('Saved');
          } else persistLocal();
        } catch (e) {
          if (mounted.current) setStatus('Not saved · recovery copy kept');
          report((e as Error).message);
          throw e;
        }
      });
    return queue.current;
  }, [activity.id, activity.sessionId, key, persistLocal, report]);
  const change = useCallback(
    (field: 'draft' | 'code', value: string) => {
      latest.current = { ...latest.current, [field]: value };
      if (field === 'draft') setDraftState(value);
      else setCodeState(value);
      setStatus('Unsaved');
      persistLocal();
    },
    [persistLocal],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, code, save]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        latest.current.draft !== last.current.draft ||
        latest.current.code !== last.current.code
      ) {
        persistLocal();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      void save().catch(() => {});
    };
  }, [persistLocal, save]);
  return {
    draft,
    code,
    setDraft: (v: string) => change('draft', v),
    setCode: (v: string) => change('code', v),
    status,
    save,
  };
}
