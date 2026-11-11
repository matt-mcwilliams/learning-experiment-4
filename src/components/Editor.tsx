import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
const theme = EditorView.theme({
  '&': { fontSize: '15px', backgroundColor: 'transparent' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '20px 0', minHeight: '260px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#a3a29a' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: '#eeeee780' },
});
export default function Editor({
  value,
  onChange,
  language = 'markdown',
  label = 'Your work',
  minHeight = '300px',
}: {
  value: string;
  onChange: (v: string) => void;
  language?: 'markdown' | 'python';
  label?: string;
  minHeight?: string;
}) {
  return (
    <CodeMirror
      aria-label={label}
      value={value}
      onChange={onChange}
      extensions={[language === 'python' ? python() : markdown(), theme, EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: language === 'python',
        foldGutter: language === 'python',
        highlightActiveLine: false,
        autocompletion: language === 'python',
      }}
      minHeight={minHeight}
    />
  );
}
