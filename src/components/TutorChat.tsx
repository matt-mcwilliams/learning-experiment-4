import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, PanelLeft, Plus } from 'lucide-react';
import type { Chat, Job, SessionDetail } from '../../shared/schema';
import { api } from '../api';
import { Loading, Markdown } from './Primitives';

export default function TutorChat({
  detail,
  ask,
  setAsk,
  busy,
  onUpdate,
  report,
}: {
  detail: SessionDetail;
  ask: string;
  setAsk: (text: string) => void;
  busy: boolean;
  onUpdate: () => Promise<unknown>;
  report: (message: string) => void;
}) {
  const selectionKey = 'margin-chat-' + detail.id;
  const [selected, setSelected] = useState<string | null>(() => {
    const saved = localStorage.getItem(selectionKey);
    return detail.chats.find((c) => c.id === saved)?.id ?? detail.chats.at(-1)?.id ?? null;
  });
  const [history, setHistory] = useState(
    () => localStorage.getItem('margin-chat-history') === 'true',
  );
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const historyId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const drafts = useRef(new Map<string | null, string>());
  const messages = detail.messages.filter((m) => m.chatId === selected);
  const chat = detail.chats.find((c) => c.id === selected);
  const activity =
    detail.activities.find((a) => a.id === detail.currentActivity) ?? detail.activities[0];
  const activeJob = detail.jobs.find((j) => j.status === 'running' && j.chatId === selected);
  useEffect(() => {
    if (selected) localStorage.setItem(selectionKey, selected);
  }, [selected, selectionKey]);
  const choose = (chatId: string) => {
    drafts.current.set(selected, ask);
    setAsk(drafts.current.get(chatId) ?? '');
    setSelected(chatId);
    input.current?.focus();
  };
  const newChat = async () => {
    setCreating(true);
    try {
      const next = await api<Chat>(`/sessions/${detail.id}/chats`, 'POST', {});
      await onUpdate();
      choose(next.id);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setCreating(false);
    }
  };
  return (
    <section className="tutor-panel" aria-label="Thinking partner">
      <header className="chat-toolbar">
        <button
          className="icon-button"
          aria-label="Toggle chat history"
          title={history ? 'Hide chat history' : 'Show chat history'}
          aria-expanded={history}
          aria-controls={historyId}
          onClick={() => {
            setHistory(!history);
            localStorage.setItem('margin-chat-history', String(!history));
          }}
        >
          <PanelLeft size={18} />
        </button>
        <h2 className="chat-heading">{chat?.title ?? 'New chat'}</h2>
        <button className="secondary" disabled={creating || sending} onClick={() => void newChat()}>
          <Plus size={15} /> New chat
        </button>
      </header>
      <div className="chat-body">
        {history && (
          <nav id={historyId} className="chat-history" aria-label="Chat history">
            <h3>Chat history</h3>
            <p className="muted">In this session</p>
            {!detail.chats.length && <p>Your chats will appear here.</p>}
            {[...detail.chats]
              .reverse()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((c) => (
                <button
                  key={c.id}
                  aria-current={c.id === selected ? 'true' : undefined}
                  disabled={creating || sending}
                  onClick={() => choose(c.id)}
                  title={c.title}
                >
                  <span>{c.title}</span>
                  <time dateTime={c.updatedAt}>
                    {new Date(c.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </button>
              ))}
          </nav>
        )}
        <div className="chat-main">
          <div className="tutor-context">
            <span className="eyebrow">IN CONTEXT</span>
            <p>{activity?.title || detail.title}</p>
          </div>
          <div className="conversation" aria-live="polite">
            {!messages.length && (
              <div className="tutor-empty">
                <h3>Keep the question open.</h3>
                <p>
                  Ask about a passage, test an argument, or request just enough of a hint. Each chat
                  starts a fresh conversation with your session in context.
                </p>
                <button
                  onClick={() =>
                    setAsk(
                      'Give me one useful hint for the current activity, without revealing its solution.',
                    )
                  }
                >
                  A hint, not the solution <ArrowUpRight size={14} />
                </button>
                <button onClick={() => setAsk('What assumption here is easiest to overlook?')}>
                  Find a hidden assumption <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={'message ' + m.role}>
                <span className="eyebrow">{m.role === 'user' ? 'YOU' : 'MARGIN · AI'}</span>
                <Markdown>{m.text}</Markdown>
              </div>
            ))}
            {activeJob?.kind === 'tutor' && <Loading text="Considering your question…" />}
          </div>
          <form
            className="tutor-input"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ask.trim() || busy || sending || creating) return;
              setSending(true);
              try {
                const job = await api<Job>(`/sessions/${detail.id}/tasks`, 'POST', {
                  kind: 'tutor',
                  chatId: selected,
                  activityId: activity?.id ?? null,
                  text: ask,
                });
                setAsk('');
                drafts.current.delete(selected);
                setSelected(job.chatId!);
                await onUpdate();
              } catch (e) {
                report((e as Error).message);
              } finally {
                setSending(false);
              }
            }}
          >
            <textarea
              ref={input}
              aria-label="Question for thinking partner"
              rows={3}
              value={ask}
              disabled={sending || creating}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Work through an idea…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div>
              <span>⌘ / Ctrl + Enter</span>
              <button
                disabled={busy || sending || creating || !ask.trim()}
                aria-label="Send question"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
          <p className="tutor-disclosure">
            AI can be wrong. Sources and your reasoning come first.
          </p>
        </div>
      </div>
    </section>
  );
}
