import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  StickyNote,
  MousePointer2,
  Minus,
  Plus,
  Download,
  Trash2,
  MessageSquare,
  NotebookPen,
} from 'lucide-react';
import type { Source, Annotation } from '../../shared/schema';
import { api } from '../api';
import { Modal, Loading } from './Primitives';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
const options = {
  isEvalSupported: false,
  useWasm: false,
  cMapUrl: '/pdfjs/cmaps/',
  standardFontDataUrl: '/pdfjs/standard_fonts/',
};
type Rect = { x: number; y: number; width: number; height: number };
export default function PdfReader({
  source,
  annotations,
  page,
  setPage,
  onUpdate,
  report,
  onAsk,
}: {
  source: Source;
  annotations: Annotation[];
  page: number;
  setPage: (n: number) => void;
  onUpdate: () => Promise<void>;
  report: (s: string) => void;
  onAsk: (s: string) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [width, setWidth] = useState(760),
    [pageCount, setPageCount] = useState(source.pages.length),
    [mode, setMode] = useState<'select' | 'highlight' | 'sticky'>('select'),
    [showNotes, setShowNotes] = useState(false),
    [selection, setSelection] = useState<{ quote: string; rects: Rect[] } | null>(null),
    [note, setNote] = useState<{
      id?: string;
      quote: string;
      text: string;
      rects?: Rect[];
      anchor: { x: number; y: number };
    } | null>(null),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState('');
  const stage = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setWidth(Math.max(230, Math.min(900, e.contentRect.width - 48))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setSelection(null);
    setFailure('');
    scroll.current?.scrollTo({ top: 0 });
  }, [page, source.id]);
  const file = useMemo(
    () => ({ url: `/api/sessions/${source.sessionId}/sources/${source.id}/original` }),
    [source.id, source.sessionId],
  );
  const save = async (
    kind: 'highlight' | 'sticky',
    quote: string,
    text: string,
    rects?: Rect[],
    anchor?: { x: number; y: number },
    annotationId?: string,
  ) => {
    setSaving(true);
    try {
      await api(
        `/sessions/${source.sessionId}/annotations${annotationId ? '/' + annotationId : ''}`,
        annotationId ? 'PATCH' : 'POST',
        { sourceId: source.id, page, kind, quote, note: text, rects, anchor },
      );
      setSelection(null);
      setNote(null);
      window.getSelection()?.removeAllRanges();
      await onUpdate();
    } catch (e) {
      report((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const select = () => {
    if (mode === 'sticky') return;
    const s = window.getSelection(),
      el = stage.current;
    if (!s || s.isCollapsed || !el || !el.contains(s.anchorNode) || !el.contains(s.focusNode))
      return;
    const quote = s.toString().trim();
    if (!quote) return;
    const bounds = el.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const rects = Array.from(s.getRangeAt(0).getClientRects())
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({
        x: clamp((r.left - bounds.left) / bounds.width),
        y: clamp((r.top - bounds.top) / bounds.height),
        width: clamp(
          Math.min(r.right, bounds.right) / bounds.width -
            Math.max(r.left, bounds.left) / bounds.width,
        ),
        height: clamp(
          Math.min(r.bottom, bounds.bottom) / bounds.height -
            Math.max(r.top, bounds.top) / bounds.height,
        ),
      }))
      .filter((r) => r.width > 0 && r.height > 0);
    if (mode === 'highlight') void save('highlight', quote, '', rects);
    else setSelection({ quote, rects });
  };
  const pageAnnotations = annotations.filter((a) => a.sourceId === source.id && a.page === page);
  const remove = async (annotation: Annotation) => {
    try {
      await api(`/sessions/${source.sessionId}/annotations/${annotation.id}`, 'DELETE');
      await onUpdate();
    } catch (e) {
      report((e as Error).message);
    }
  };
  return (
    <div className="pdf-reader">
      <div className="pdf-toolbar" role="toolbar" aria-label="PDF tools">
        <div className="pdf-tool-group">
          <button
            aria-label="Select text"
            aria-pressed={mode === 'select'}
            onClick={() => setMode('select')}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            aria-label="Highlight text"
            aria-pressed={mode === 'highlight'}
            title="Select text to highlight it"
            onClick={() => setMode('highlight')}
          >
            <Highlighter size={17} />
          </button>
          <button
            aria-label="Sticky note"
            aria-pressed={mode === 'sticky'}
            title="Click the page to place a sticky note"
            onClick={() => setMode('sticky')}
          >
            <StickyNote size={17} />
          </button>
        </div>
        <div className="pdf-pagination">
          <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={17} />
          </button>
          <input
            type="number"
            aria-label="Page number"
            min={1}
            max={pageCount}
            value={page}
            onChange={(e) => setPage(Math.min(pageCount, Math.max(1, Number(e.target.value) || 1)))}
          />
          <span>/ {pageCount}</span>
          <button
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="pdf-tool-group">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 0.5}
            onClick={() => setZoom(Math.max(0.5, zoom - 0.15))}
          >
            <Minus size={16} />
          </button>
          <button className="zoom-label" aria-label="Fit page width" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 2}
            onClick={() => setZoom(Math.min(2, zoom + 0.15))}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className="pdf-notes-toggle"
          aria-label="Show annotations"
          aria-pressed={showNotes}
          onClick={() => setShowNotes(!showNotes)}
        >
          <NotebookPen size={17} />
          <span>{annotations.filter((a) => a.sourceId === source.id).length}</span>
        </button>
        <a aria-label="Download original PDF" href={file.url} target="_blank" rel="noreferrer">
          <Download size={17} />
        </a>
      </div>
      <div className="pdf-help" role="status">
        {saving
          ? 'Saving annotation…'
          : mode === 'highlight'
            ? 'Select a passage to highlight.'
            : mode === 'sticky'
              ? 'Click anywhere on the page to leave a sticky note.'
              : 'Select text to highlight it, add a note, or ask about the passage.'}
      </div>
      <div className="pdf-body">
        <div className="pdf-scroll" ref={scroll}>
          <Document
            file={file}
            options={options}
            loading={<Loading text="Opening PDF…" />}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            onLoadError={(e) => setFailure(e.message)}
            error={
              <p className="inline-notice">
                Unable to render this PDF. {failure}{' '}
                <a href={file.url} target="_blank" rel="noreferrer">
                  Open the original
                </a>
              </p>
            }
          >
            <div
              className={'pdf-page-stage mode-' + mode}
              ref={stage}
              onMouseUp={select}
              onClick={(e) => {
                if (mode !== 'sticky' || !stage.current) return;
                const r = stage.current.getBoundingClientRect();
                setNote({
                  quote: '',
                  text: '',
                  anchor: {
                    x: Math.max(0, Math.min(0.97, (e.clientX - r.left) / r.width)),
                    y: Math.max(0, Math.min(0.97, (e.clientY - r.top) / r.height)),
                  },
                });
              }}
            >
              <Page
                pageNumber={page}
                width={width * zoom}
                renderAnnotationLayer={false}
                loading={<Loading text="Rendering page…" />}
              />
              <div className="pdf-marks" aria-label="Page annotations">
                {pageAnnotations.map((a) => (
                  <div key={a.id}>
                    {a.rects?.map((r, i) => (
                      <button
                        key={i}
                        className="pdf-highlight"
                        aria-label={'Highlighted passage: ' + a.quote}
                        title={a.note || a.quote}
                        style={{
                          left: r.x * 100 + '%',
                          top: r.y * 100 + '%',
                          width: r.width * 100 + '%',
                          height: r.height * 100 + '%',
                        }}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setNote({
                            id: a.id,
                            quote: a.quote,
                            text: a.note,
                            rects: a.rects,
                            anchor: a.anchor ?? { x: r.x, y: r.y },
                          });
                        }}
                      />
                    ))}
                    {(a.kind === 'sticky' || (!a.rects?.length && a.note)) && (
                      <button
                        className="pdf-note-pin"
                        aria-label={'Sticky note: ' + a.note}
                        style={{
                          left: (a.anchor?.x ?? 0.94) * 100 + '%',
                          top: (a.anchor?.y ?? 0.08) * 100 + '%',
                        }}
                        title={a.note}
                        onClick={(e) => {
                          e.stopPropagation();
                          setNote({
                            id: a.id,
                            quote: a.quote,
                            text: a.note,
                            rects: a.rects,
                            anchor: a.anchor ?? { x: 0.94, y: 0.08 },
                          });
                        }}
                      >
                        <StickyNote size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Document>
        </div>
        {showNotes && (
          <aside className="pdf-annotation-list">
            <h3>Annotations</h3>
            <button
              className="text-button"
              onClick={() => setNote({ quote: '', text: '', anchor: { x: 0.92, y: 0.08 } })}
            >
              <Plus size={14} />
              Add page note
            </button>
            {annotations
              .filter((a) => a.sourceId === source.id)
              .map((a) => (
                <article key={a.id}>
                  <button className="annotation-location" onClick={() => setPage(a.page)}>
                    Page {a.page} · {a.kind === 'highlight' ? 'Highlight' : 'Note'}
                  </button>
                  {a.quote && <blockquote>{a.quote}</blockquote>}
                  {a.note && <p>{a.note}</p>}
                  <div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPage(a.page);
                        setNote({
                          id: a.id,
                          quote: a.quote,
                          text: a.note,
                          rects: a.rects,
                          anchor: a.anchor ?? { x: 0.92, y: 0.08 },
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Delete annotation"
                      onClick={() => void remove(a)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            {!annotations.some((a) => a.sourceId === source.id) && (
              <p className="muted">Your highlights and notes appear here.</p>
            )}
          </aside>
        )}
      </div>
      {selection && (
        <div className="pdf-selection-bar">
          <span>“{selection.quote.slice(0, 100)}…”</span>
          <button onClick={() => void save('highlight', selection.quote, '', selection.rects)}>
            <Highlighter size={15} />
            Highlight
          </button>
          <button
            onClick={() =>
              setNote({
                quote: selection.quote,
                text: '',
                rects: selection.rects,
                anchor: selection.rects[0] ?? { x: 0.9, y: 0.1 },
              })
            }
          >
            <StickyNote size={15} />
            Add note
          </button>
          <button
            onClick={() =>
              onAsk(
                `Explain this selected passage from ${source.title}, PDF page ${page}, source ${source.id}: "${selection.quote}"`,
              )
            }
          >
            <MessageSquare size={15} />
            Ask AI
          </button>
        </div>
      )}
      {note && (
        <Modal title="Sticky note" onClose={() => setNote(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                note.rects?.length && !note.text.trim() ? 'highlight' : 'sticky',
                note.quote,
                note.text,
                note.rects,
                note.anchor,
                note.id,
              );
            }}
          >
            {note.quote && <blockquote className="note-quotation">{note.quote}</blockquote>}
            <label className="field">
              YOUR NOTE
              <textarea
                autoFocus
                aria-label="Sticky note text"
                rows={5}
                value={note.text}
                onChange={(e) => setNote({ ...note, text: e.target.value })}
                placeholder="A question, connection, or reminder…"
              />
            </label>
            <footer className="form-footer">
              {note.id ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    const a = annotations.find((a) => a.id === note.id);
                    if (a) await remove(a);
                    setNote(null);
                  }}
                >
                  Delete annotation
                </button>
              ) : (
                <span>Page {page}</span>
              )}
              <button className="primary" disabled={saving}>
                Save note
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
