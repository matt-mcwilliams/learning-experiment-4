import type { Activity, SessionDetail } from '../../shared/schema';
import { reflowPdfText } from '../../shared/excerpts';
import { ArrowUpRight, Sparkles } from 'lucide-react';
export default function ReadingExcerpts({
  activity,
  detail,
  busy,
  onFormat,
  onOpen,
}: {
  activity: Activity;
  detail: SessionDetail;
  busy: boolean;
  onFormat: () => void;
  onOpen: (ref: { sourceId: string; page: number }) => void;
}) {
  const material = activity.material;
  if (!material?.references.length) return null;
  const formatted = !!material.excerpts?.length;
  const remoteBudget = new Map<string, number>();
  const fragments =
    material.excerpts ??
    material.references.slice(0, 8).map((ref) => {
      const source = detail.sources.find((s) => s.id === ref.sourceId);
      let text = reflowPdfText(ref.quote || source?.pages[ref.page - 1] || '');
      if (source?.origin === 'url') {
        const budget = remoteBudget.get(source.id) ?? 25;
        const words = text ? text.split(/\s+/) : [];
        text = words.slice(0, budget).join(' ');
        remoteBudget.set(source.id, Math.max(0, budget - words.length));
      } else if (!ref.quote) text = text.split(/\s+/).slice(0, 100).join(' ');
      return {
        sourceId: ref.sourceId,
        page: ref.page,
        blocks: [{ kind: 'paragraph' as const, text }],
      };
    });
  return (
    <section className="reading-excerpts">
      <header>
        <h3>Source passage</h3>
        {!formatted && (
          <button className="secondary" disabled={busy} onClick={onFormat}>
            <Sparkles size={14} />
            Format source excerpts
          </button>
        )}
      </header>
      {material.excerptError && (
        <p className="inline-notice">
          The lesson is ready, but excerpt formatting needs another pass. The original source is
          available; use Format source excerpts to retry.
        </p>
      )}
      {fragments.map((ref, i) => {
        const source = detail.sources.find((s) => s.id === ref.sourceId),
          assignment = material.references.find(
            (r) => r.sourceId === ref.sourceId && r.page === ref.page,
          );
        return (
          <article className="reading-excerpt" key={ref.sourceId + '-' + ref.page + '-' + i}>
            <header>
              <span>
                {source?.title} · {source?.mediaType === 'application/pdf' ? 'PDF page' : 'Segment'}{' '}
                {ref.page}
              </span>
              <button className="text-button" onClick={() => onOpen(ref)}>
                Open source
                <ArrowUpRight size={14} />
              </button>
            </header>
            {assignment?.purpose && <p className="excerpt-purpose">{assignment.purpose}</p>}
            <blockquote>
              {ref.blocks.map((block, j) =>
                block.kind === 'heading' ? (
                  <h4 key={j}>{block.text}</h4>
                ) : block.kind === 'equation' ? (
                  <pre className="excerpt-equation" key={j}>
                    {block.text}
                  </pre>
                ) : (
                  <p key={j}>{block.text}</p>
                ),
              )}
            </blockquote>
            <footer>
              {formatted
                ? 'Source words checked · paragraphs formatted with AI'
                : 'Source extract · format for a more readable passage'}
              {source?.mediaType === 'application/pdf'
                ? ' · Original equation and figure layout remains in the PDF.'
                : ''}
            </footer>
          </article>
        );
      })}
    </section>
  );
}
