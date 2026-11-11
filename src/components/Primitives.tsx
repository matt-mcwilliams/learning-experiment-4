import { lazy, Suspense, type ReactNode } from 'react';
import { X, ArrowUpRight, LoaderCircle } from 'lucide-react';
const MathematicalText = lazy(() => import('./MathematicalText'));
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <Suspense fallback={<p className="muted">Preparing mathematical text…</p>}>
      <MathematicalText className={className}>{children}</MathematicalText>
    </Suspense>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={'modal ' + (wide ? 'wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
              'button,input,select,textarea,a[href]',
            );
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose} autoFocus>
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ text = 'Opening your workspace…' }: { text?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={20} />
      <span>{text}</span>
    </div>
  );
}
export const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
