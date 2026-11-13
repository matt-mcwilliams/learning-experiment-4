import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { ArrowUpRight } from 'lucide-react';
export default function MathematicalText({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={'prose ' + className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false }]]}
        components={{
          table: ({ children }) => (
            <div className="prose-table" role="region" aria-label="Table" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
              <ArrowUpRight size={12} />
            </a>
          ),
          img: ({ alt }) => (
            <span className="muted">[Image: {alt}. Inspect the original source.]</span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
