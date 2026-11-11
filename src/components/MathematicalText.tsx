import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
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
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false }]]}
        components={{
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
