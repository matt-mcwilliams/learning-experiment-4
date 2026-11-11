import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import PdfPage, { type PdfNote } from './PdfPage';
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
  // Image decoders (including the JS fallbacks) live in PDF.js's wasm directory.
  wasmUrl: '/pdfjs/wasm/',
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
  restorePosition = true,
}: {
  source: Source;
  annotations: Annotation[];
  page: number;
  setPage: (n: number) => void;
  onUpdate: () => Promise<void>;
  report: (s: string) => void;
  onAsk: (s: string) => void;
  restorePosition?: boolean;
}) {
  const positionKey = 'margin-pdf-view-v1-' + source.id;
  const [initial] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
      if (
        restorePosition &&
        saved?.page === page &&
        Number.isFinite(saved.offset) &&
        saved.offset >= 0 &&
        saved.offset <= 1 &&
        Number.isFinite(saved.zoom) &&
        saved.zoom >= 0.5 &&
        saved.zoom <= 2
      )
        return saved;
    } catch {}
    return { page, offset: 0, zoom: 1 };
  });
  const [zoom, setZoom] = useState<number>(initial.zoom),
    [width, setWidth] = useState(760),
    [pageCount, setPageCount] = useState(source.pages.length),
    [document, setDocument] = useState<PDFDocumentProxy | null>(null),
    [ratios, setRatios] = useState<number[]>([]),
    [mode, setMode] = useState<'select' | 'highlight' | 'sticky'>('select'),
    [showNotes, setShowNotes] = useState(false),
    [selection, setSelection] = useState<{ page: number; quote: string; rects: Rect[] } | null>(
      null,
    ),
    [note, setNote] = useState<PdfNote | null>(null),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState('');
  const scroll = useRef<HTMLDivElement>(null),
    stages = useRef(new Map<number, HTMLDivElement>()),
    pendingPosition = useRef<{ page: number; offset: number } | null>(initial),
    frame = useRef<number | null>(null),
    currentPage = useRef(page);
  currentPage.current = page;
  const locate = () => {
    const root = scroll.current;
    if (!root?.clientHeight) return null;
    const top = root.getBoundingClientRect().top;
    for (let number = 1; number <= pageCount; number++) {
      const element = stages.current.get(number);
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom > top + 20)
        return {
          page: number,
          offset: Math.max(0, Math.min(1, (top - bounds.top) / bounds.height)),
        };
    }
    return null;
  };
  const restore = () => {
    const target = pendingPosition.current,
      root = scroll.current;
    if (!target || !root?.clientHeight) return;
    const el = stages.current.get(target.page);
    if (!el) return;
    root.scrollTop +=
      el.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      el.offsetHeight * target.offset;
    pendingPosition.current = null;
  };
  const remember = () => {
    const position = locate();
    if (!position || pendingPosition.current) return;
    localStorage.setItem(positionKey, JSON.stringify({ ...position, zoom }));
    if (position.page !== currentPage.current) {
      currentPage.current = position.page;
      setPage(position.page);
    }
  };
  const goToPage = (number: number) => {
    const target = Math.max(1, Math.min(pageCount, number));
    pendingPosition.current = { page: target, offset: 0 };
    setSelection(null);
    setPage(target);
    restore();
  };
  const resize = useRef({ locate, restore });
  resize.current = { locate, restore };
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => {
      if (!e.contentRect.width) return;
      pendingPosition.current ??= resize.current.locate();
      setWidth(Math.max(180, Math.min(900, e.contentRect.width)));
      requestAnimationFrame(() => resize.current.restore());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let disposed = false;
    void Promise.all(
      Array.from({ length: document.numPages }, async (_, i) => {
        const p = await document.getPage(i + 1),
          viewport = p.getViewport({ scale: 1 });
        return viewport.height / viewport.width;
      }),
    )
      .then((values) => {
        if (!disposed) setRatios(values);
      })
      .catch((e) => {
        if (!disposed) setFailure(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [document]);
  useLayoutEffect(() => {
    restore();
    remember();
  }, [width, zoom, ratios]);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const changeZoom = (value: number) => {
    pendingPosition.current = locate();
    setZoom(value);
  };
  const file = useMemo(
    () => ({ url: `/api/sessions/${source.sessionId}/sources/${source.id}/original` }),
    [source.id, source.sessionId],
  );
  const save = async (
    targetPage: number,
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
        { sourceId: source.id, page: targetPage, kind, quote, note: text, rects, anchor },
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
  const select = (number: number, el: HTMLDivElement) => {
    if (mode === 'sticky') return;
    const s = window.getSelection();
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
    if (mode === 'highlight') void save(number, 'highlight', quote, '', rects);
    else setSelection({ page: number, quote, rects });
  };
  const annotationsByPage = new Map<number, Annotation[]>();
  for (const annotation of annotations.filter((a) => a.sourceId === source.id))
    annotationsByPage.set(annotation.page, [
      ...(annotationsByPage.get(annotation.page) ?? []),
      annotation,
    ]);
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
          <button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <input
            type="number"
            aria-label="Page number"
            min={1}
            max={pageCount}
            value={page}
            onChange={(e) => goToPage(Number(e.target.value) || 1)}
          />
          <span>/ {pageCount}</span>
          <button
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="pdf-tool-group">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 0.5}
            onClick={() => changeZoom(Math.max(0.5, zoom - 0.15))}
          >
            <Minus size={16} />
          </button>
          <button className="zoom-label" aria-label="Fit page width" onClick={() => changeZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 2}
            onClick={() => changeZoom(Math.min(2, zoom + 0.15))}
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
        <div
          className="pdf-scroll"
          ref={scroll}
          tabIndex={0}
          role="region"
          aria-label="Scrollable PDF"
          onScroll={() => {
            if (frame.current !== null) return;
            frame.current = requestAnimationFrame(() => {
              frame.current = null;
              remember();
            });
          }}
        >
          <Document
            file={file}
            options={options}
            suspense={false}
            loading={<Loading text="Opening PDF…" />}
            onLoadSuccess={(pdf) => {
              setPageCount(pdf.numPages);
              setDocument(pdf);
            }}
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
            {!ratios.length && !failure && <Loading text="Preparing pages…" />}
            {failure && (
              <p className="inline-notice" role="alert">
                {failure}
              </p>
            )}
            {ratios.map((ratio, i) => (
              <PdfPage
                key={i + 1}
                number={i + 1}
                ratio={ratio}
                width={width * zoom}
                mode={mode}
                annotations={annotationsByPage.get(i + 1) ?? []}
                scroll={scroll}
                register={(number, element) => {
                  if (element) stages.current.set(number, element);
                  else stages.current.delete(number);
                }}
                onSelect={select}
                onNote={setNote}
              />
            ))}
          </Document>
        </div>
        {showNotes && (
          <aside className="pdf-annotation-list">
            <h3>Annotations</h3>
            <button
              className="text-button"
              onClick={() => setNote({ page, quote: '', text: '', anchor: { x: 0.92, y: 0.08 } })}
            >
              <Plus size={14} />
              Add page note
            </button>
            {annotations
              .filter((a) => a.sourceId === source.id)
              .map((a) => (
                <article key={a.id}>
                  <button className="annotation-location" onClick={() => goToPage(a.page)}>
                    Page {a.page} · {a.kind === 'highlight' ? 'Highlight' : 'Note'}
                  </button>
                  {a.quote && <blockquote>{a.quote}</blockquote>}
                  {a.note && <p>{a.note}</p>}
                  <div>
                    <button
                      className="text-button"
                      onClick={() => {
                        goToPage(a.page);
                        setNote({
                          id: a.id,
                          page: a.page,
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
          <button
            onClick={() =>
              void save(selection.page, 'highlight', selection.quote, '', selection.rects)
            }
          >
            <Highlighter size={15} />
            Highlight
          </button>
          <button
            onClick={() =>
              setNote({
                page: selection.page,
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
                `Explain this selected passage from ${source.title}, PDF page ${selection.page}, source ${source.id}: "${selection.quote}"`,
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
                note.page,
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
                <span>Page {note.page}</span>
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
