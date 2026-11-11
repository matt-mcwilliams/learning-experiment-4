import { useEffect, useRef, useState, type RefObject } from 'react';
import { Page } from 'react-pdf';
import type { PDFPageProxy } from 'pdfjs-dist';
import { StickyNote } from 'lucide-react';
import type { Annotation } from '../../shared/schema';
import { Loading } from './Primitives';

export type PdfNote = {
  id?: string;
  page: number;
  quote: string;
  text: string;
  rects?: Annotation['rects'];
  anchor: { x: number; y: number };
};
export default function PdfPage({
  number,
  width,
  ratio,
  mode,
  annotations,
  scroll,
  register,
  onSelect,
  onNote,
}: {
  number: number;
  width: number;
  ratio: number;
  mode: 'select' | 'highlight' | 'sticky';
  annotations: Annotation[];
  scroll: RefObject<HTMLDivElement | null>;
  register: (number: number, element: HTMLDivElement | null) => void;
  onSelect: (number: number, element: HTMLDivElement) => void;
  onNote: (note: PdfNote) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const loadedPage = useRef<PDFPageProxy | null>(null);
  const [near, setNear] = useState(false),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!stage.current || !scroll.current) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: scroll.current,
      rootMargin: '1200px 0px',
    });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [scroll]);
  useEffect(
    () => () => {
      // Release decoded page resources as well as the canvas when scrolling away.
      loadedPage.current?.cleanup();
      loadedPage.current = null;
    },
    [near],
  );
  const edit = (a: Annotation) =>
    onNote({
      id: a.id,
      page: number,
      quote: a.quote,
      text: a.note,
      rects: a.rects,
      anchor: a.anchor ?? a.rects?.[0] ?? { x: 0.94, y: 0.08 },
    });
  return (
    <div
      className={'pdf-page-stage mode-' + mode}
      data-page-number={number}
      aria-label={'PDF page ' + number}
      ref={(element) => {
        stage.current = element;
        register(number, element);
      }}
      style={{ width, height: Math.floor(width * ratio) }}
      onMouseUp={(e) => onSelect(number, e.currentTarget)}
      onClick={(e) => {
        if (mode !== 'sticky') return;
        const r = e.currentTarget.getBoundingClientRect();
        onNote({
          page: number,
          quote: '',
          text: '',
          anchor: {
            x: Math.max(0, Math.min(0.97, (e.clientX - r.left) / r.width)),
            y: Math.max(0, Math.min(0.97, (e.clientY - r.top) / r.height)),
          },
        });
      }}
    >
      {near ? (
        <Page
          key={attempt}
          suspense={false}
          pageNumber={number}
          width={width}
          devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
          renderAnnotationLayer={false}
          onLoadSuccess={(page) => {
            loadedPage.current = page;
          }}
          onLoadError={(e) => setError(e.message)}
          onRenderError={(e) => setError(e.message)}
          loading={<Loading text={'Rendering page ' + number + '…'} />}
        />
      ) : (
        <div className="pdf-page-placeholder">Page {number}</div>
      )}
      {error && (
        <div className="pdf-page-error" role="alert">
          <p>
            Page {number} could not be rendered. {error}
          </p>
          <button
            className="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setError('');
              setAttempt(attempt + 1);
            }}
          >
            Retry page
          </button>
        </div>
      )}
      <div className="pdf-marks" aria-label={'Annotations on page ' + number}>
        {annotations.map((a) => (
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
                  edit(a);
                }}
              />
            ))}
            {(a.kind === 'sticky' || (!a.rects?.length && a.note)) && (
              <button
                className="pdf-note-pin"
                aria-label={'Sticky note: ' + a.note}
                title={a.note}
                style={{
                  left: (a.anchor?.x ?? 0.94) * 100 + '%',
                  top: (a.anchor?.y ?? 0.08) * 100 + '%',
                }}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  edit(a);
                }}
              >
                <StickyNote size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
