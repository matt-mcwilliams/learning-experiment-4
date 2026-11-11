import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Link,
  ExternalLink,
  MessageSquare,
  Highlighter,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { SessionDetail, Source } from '../../shared/schema';
import { api, upload } from '../api';
import { Empty } from './Primitives';
export default function Sources({
  detail,
  onUpdate,
  report,
  onAsk,
  initialRef,
}: {
  detail: SessionDetail;
  onUpdate: () => Promise<void>;
  report: (s: string) => void;
  onAsk: (s: string) => void;
  initialRef?: { sourceId: string; page: number } | null;
}) {
  const readerKey = 'margin-reader-v1-' + detail.id;
  const [saved] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(readerKey) || JSON.stringify(detail.readerState ?? {}),
      );
    } catch {
      return detail.readerState ?? {};
    }
  });
  const [selected, setSelected] = useState(
      initialRef?.sourceId || saved.sourceId || detail.sources[0]?.id || '',
    ),
    [page, setPage] = useState(initialRef?.page || saved.page || 1),
    [quote, setQuote] = useState(''),
    [note, setNote] = useState(''),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [original, setOriginal] = useState(initialRef ? false : (saved.original ?? false));
  const source = detail.sources.find((s) => s.id === selected) || detail.sources[0];
  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!source) return;
    const readerState = { sourceId: source.id, page, original };
    localStorage.setItem(readerKey, JSON.stringify(readerState));
    const timer = setTimeout(() => {
      void api(`/sessions/${detail.id}`, 'PATCH', { readerState }).catch((e) => report(e.message));
    }, 500);
    return () => clearTimeout(timer);
  }, [source?.id, page, original, readerKey, detail.id, report]);
  const attach = async (file: File) => {
    setBusy(true);
    try {
      const s = (await upload(`/sessions/${detail.id}/sources`, file)) as Source;
      await onUpdate();
      setSelected(s.id);
      setPage(1);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const addUrl = async () => {
    setBusy(true);
    try {
      const s = await api<Source>(`/sessions/${detail.id}/sources/url`, 'POST', { url });
      setUrl('');
      await onUpdate();
      setSelected(s.id);
      setPage(1);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) => {
    setSelected(id);
    setPage(1);
    setQuote('');
    setOriginal(false);
  };
  const annotations = detail.annotations.filter(
    (a) => a.sourceId === source?.id && a.page === page,
  );
  function highlighted(text: string) {
    let segments: (string | React.ReactNode)[] = [text];
    for (const a of annotations.filter((a) => a.quote)) {
      segments = segments.flatMap<React.ReactNode>((segment, index) => {
        if (typeof segment !== 'string') return [segment];
        const at = segment.indexOf(a.quote);
        return at < 0
          ? [segment]
          : [
              segment.slice(0, at),
              <mark title={a.note} key={a.id + '-' + index}>
                {a.quote}
              </mark>,
              segment.slice(at + a.quote.length),
            ];
      });
    }
    return segments;
  }
  return (
    <div className="source-workspace">
      <div className="source-toolbar">
        <select
          aria-label="Select source"
          value={source?.id || ''}
          onChange={(e) => choose(e.target.value)}
        >
          {detail.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          {!detail.sources.length && <option>No sources attached</option>}
        </select>
        <label className="secondary upload-button">
          <Upload size={15} />
          {busy ? 'Processing…' : 'Attach source'}
          <input
            disabled={busy}
            type="file"
            accept=".pdf,.md,.txt,.tex"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attach(f);
            }}
          />
        </label>
      </div>
      <form
        className="url-row"
        onSubmit={(e) => {
          e.preventDefault();
          void addUrl();
        }}
      >
        <Link size={15} />
        <input
          aria-label="Public source URL"
          type="url"
          required
          placeholder="Retrieve a public paper or article URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="text-button" disabled={busy || !url}>
          Retrieve
          <Plus size={15} />
        </button>
      </form>
      {source ? (
        <>
          <div className="source-meta">
            <div>
              <span className="eyebrow">
                {source.origin === 'upload' ? 'YOUR DOCUMENT' : 'RETRIEVED SOURCE'}
              </span>
              <h3>{source.title}</h3>
            </div>
            <div className="source-links">
              {source.mediaType === 'application/pdf' && (
                <button className="text-button" onClick={() => setOriginal(!original)}>
                  {original ? 'Text reader' : 'View PDF'}
                </button>
              )}
              <a
                href={`/api/sessions/${detail.id}/sources/${source.id}/original`}
                target="_blank"
                rel="noreferrer"
              >
                Original
                <ExternalLink size={13} />
              </a>
              {source.url && (
                <a href={source.url} target="_blank" rel="noreferrer">
                  Publisher
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
          {source.warning && <p className="source-warning">{source.warning}</p>}
          <div className="page-controls">
            <span>{source.mediaType === 'application/pdf' ? 'PDF page' : 'Text segment'}</span>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1);
                setQuote('');
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="Page number"
              type="number"
              min={1}
              max={source.pages.length}
              value={page}
              onChange={(e) => {
                setPage(Math.max(1, Math.min(source.pages.length, Number(e.target.value) || 1)));
                setQuote('');
              }}
            />
            <span>of {source.pages.length}</span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={page >= source.pages.length}
              onClick={() => {
                setPage(page + 1);
                setQuote('');
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {original ? (
            <iframe
              title="Original PDF"
              className="pdf-frame"
              src={`/api/sessions/${detail.id}/sources/${source.id}/original#page=${page}`}
            />
          ) : (
            <div
              className="source-text"
              ref={textRef}
              onMouseUp={() => {
                const selection = window.getSelection();
                if (
                  selection &&
                  textRef.current?.contains(selection.anchorNode) &&
                  textRef.current?.contains(selection.focusNode)
                ) {
                  setQuote(selection.toString());
                }
              }}
            >
              {highlighted(source.pages[page - 1] || '')}
            </div>
          )}
          {quote && (
            <div className="selection-actions">
              <span>
                “{quote.slice(0, 100)}
                {quote.length > 100 ? '…' : ''}”
              </span>
              <button
                className="secondary"
                onClick={() =>
                  onAsk(
                    `Regarding ${source.title}, physical page/segment ${page} (source ID ${source.id}), explain this passage in context: "${quote}"`,
                  )
                }
              >
                <MessageSquare size={14} />
                Ask about this
              </button>
            </div>
          )}
          <div className="annotation-form">
            <label className="field">
              {quote ? 'ANNOTATE YOUR SELECTION' : 'NOTE ON THIS PAGE'}
              <textarea
                rows={2}
                placeholder="What follows from this? What remains unclear?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              disabled={busy || (!note.trim() && !quote)}
              onClick={async () => {
                try {
                  await api(`/sessions/${detail.id}/annotations`, 'POST', {
                    sourceId: source.id,
                    page,
                    quote,
                    note,
                  });
                  setQuote('');
                  setNote('');
                  await onUpdate();
                } catch (e) {
                  report((e as Error).message);
                }
              }}
            >
              <Highlighter size={15} />
              Save annotation
            </button>
          </div>
          {annotations.map((a) => (
            <blockquote className="annotation" key={a.id}>
              {a.quote && <p>“{a.quote}”</p>}
              <span>{a.note}</span>
            </blockquote>
          ))}
        </>
      ) : (
        <Empty eyebrow="READ FROM THE SOURCE" title="Give the ideas a reference point.">
          Attach a paper, book excerpt, or text. Margin preserves the original and checks quotations
          against actual source pages.
        </Empty>
      )}
    </div>
  );
}
