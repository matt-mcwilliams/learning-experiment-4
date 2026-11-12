import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Mathematics from '@tiptap/extension-mathematics';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Sigma,
  Minus,
} from 'lucide-react';
import { Modal } from './Primitives';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
export default function DocumentEditor({
  value,
  onChange,
  label = 'Your document',
  minHeight = '380px',
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  minHeight?: string;
}) {
  const latest = useRef(onChange);
  latest.current = onChange;
  const emitted = useRef(value);
  const [formula, setFormula] = useState<{ latex: string; pos?: number; block: boolean } | null>(
      null,
    ),
    [link, setLink] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        underline: false,
        link: { openOnClick: false, protocols: ['https', 'http'] },
      }),
      Markdown,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Mathematics.configure({
        katexOptions: { trust: false, throwOnError: false },
        inlineOptions: {
          onClick: (node: ProseMirrorNode, pos: number) =>
            setFormula({ latex: node.attrs.latex, pos, block: false }),
        },
        blockOptions: {
          onClick: (node: ProseMirrorNode, pos: number) =>
            setFormula({ latex: node.attrs.latex, pos, block: true }),
        },
      }),
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getMarkdown();
      emitted.current = text;
      latest.current(text);
    },
  });
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.schema && value !== emitted.current) {
      emitted.current = value;
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    }
  }, [value, editor]);
  const observed = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && e.schema
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            strike: e.isActive('strike'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            heading: e.isActive('heading', { level: 1 })
              ? '1'
              : e.isActive('heading', { level: 2 })
                ? '2'
                : e.isActive('heading', { level: 3 })
                  ? '3'
                  : '0',
            words: e.getText().trim() ? e.getText().trim().split(/\s+/u).length : 0,
            characters: e.getText().length,
          }
        : null,
  });
  const state = observed ?? {
    bold: false,
    italic: false,
    strike: false,
    bullet: false,
    ordered: false,
    quote: false,
    heading: '0',
    words: 0,
    characters: 0,
  };
  if (!editor) return null;
  const button = (title: string, icon: React.ReactNode, run: () => void, pressed?: boolean) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      className={pressed ? 'pressed' : ''}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon}
    </button>
  );
  return (
    <div
      className="document-editor"
      style={{ '--document-height': minHeight } as React.CSSProperties}
    >
      <div className="document-formatbar" role="toolbar" aria-label="Document formatting">
        {button('Undo', <Undo2 size={16} />, () => editor.chain().focus().undo().run())}
        {button('Redo', <Redo2 size={16} />, () => editor.chain().focus().redo().run())}
        <span className="toolbar-divider" />
        <select
          aria-label="Paragraph style"
          value={state.heading}
          onChange={(e) => {
            const level = Number(e.target.value);
            if (level)
              editor
                .chain()
                .focus()
                .setHeading({ level: level as 1 | 2 | 3 })
                .run();
            else editor.chain().focus().setParagraph().run();
          }}
        >
          <option value="0">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
        <span className="toolbar-divider" />
        {button(
          'Bold',
          <Bold size={16} />,
          () => editor.chain().focus().toggleBold().run(),
          state.bold,
        )}
        {button(
          'Italic',
          <Italic size={16} />,
          () => editor.chain().focus().toggleItalic().run(),
          state.italic,
        )}
        {button(
          'Strikethrough',
          <Strikethrough size={16} />,
          () => editor.chain().focus().toggleStrike().run(),
          state.strike,
        )}
        <span className="toolbar-divider" />
        {button(
          'Bulleted list',
          <List size={17} />,
          () => editor.chain().focus().toggleBulletList().run(),
          state.bullet,
        )}
        {button(
          'Numbered list',
          <ListOrdered size={17} />,
          () => editor.chain().focus().toggleOrderedList().run(),
          state.ordered,
        )}
        {button(
          'Block quote',
          <Quote size={16} />,
          () => editor.chain().focus().toggleBlockquote().run(),
          state.quote,
        )}
        {button('Insert link', <LinkIcon size={16} />, () =>
          setLink(editor.getAttributes('link').href || ''),
        )}
        {button('Insert equation', <Sigma size={17} />, () =>
          setFormula({ latex: '', block: false }),
        )}
        {button('Horizontal rule', <Minus size={16} />, () =>
          editor.chain().focus().setHorizontalRule().run(),
        )}
      </div>
      <div className="document-desk">
        <EditorContent editor={editor} className="document-paper" />
      </div>
      <footer className="document-status">
        <span>
          {state.words.toLocaleString()} {state.words === 1 ? 'word' : 'words'}
        </span>
      </footer>
      {link !== null && (
        <Modal title="Insert a link" onClose={() => setLink(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim())
                editor.chain().focus().extendMarkRange('link').setLink({ href: link.trim() }).run();
              else editor.chain().focus().unsetLink().run();
              setLink(null);
            }}
          >
            <label className="field">
              ADDRESS
              <input
                autoFocus
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <footer className="form-footer">
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLink(null);
                }}
              >
                Remove link
              </button>
              <button className="primary">Apply link</button>
            </footer>
          </form>
        </Modal>
      )}
      {formula && (
        <Modal title="Equation" onClose={() => setFormula(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const chain = editor.chain().focus();
              if (formula.pos !== undefined) chain.setNodeSelection(formula.pos);
              if (formula.pos !== undefined) {
                if (formula.block) chain.updateBlockMath({ latex: formula.latex }).run();
                else chain.updateInlineMath({ latex: formula.latex }).run();
              } else if (formula.block) chain.insertBlockMath({ latex: formula.latex }).run();
              else chain.insertInlineMath({ latex: formula.latex }).run();
              setFormula(null);
            }}
          >
            <label className="field">
              LATEX
              <input
                autoFocus
                required
                aria-label="Equation LaTeX"
                value={formula.latex}
                onChange={(e) => setFormula({ ...formula, latex: e.target.value })}
                placeholder="\\mathrm{Var}(\\bar X) = \\sigma^2/n"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formula.block}
                disabled={formula.pos !== undefined}
                onChange={(e) => setFormula({ ...formula, block: e.target.checked })}
              />
              Display on its own line
            </label>
            <footer className="form-footer">
              <span>Click an equation to edit it later.</span>
              <button className="primary">Insert equation</button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
