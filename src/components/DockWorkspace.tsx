import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  DockviewReact,
  type DockviewApi,
  type IDockviewPanelProps,
  type IDockviewPanelHeaderProps,
  type IDockviewHeaderActionsProps,
  type DockviewReadyEvent,
} from 'dockview-react';
import { Columns2, Rows2, RotateCcw, Plus } from 'lucide-react';
import 'dockview-react/dist/styles/dockview.css';
import { api as request } from '../api';
export type WorkspaceTab =
  'brief' | 'read' | 'write' | 'lab' | 'review' | 'sources' | 'notes' | 'files' | 'tutor';
const titles: Record<WorkspaceTab, string> = {
  brief: 'Session brief',
  read: 'Read',
  write: 'Work',
  lab: 'Laboratory',
  review: 'Review',
  sources: 'PDF & sources',
  notes: 'Notebook',
  files: 'Files',
  tutor: 'AI chat',
};
const initialTabs: WorkspaceTab[] = ['brief', 'read', 'write', 'lab', 'sources', 'tutor'];
export type DockHandle = { open: (tab: WorkspaceTab) => void };
const ViewContext = createContext<(tab: WorkspaceTab) => ReactNode>(() => null);
function View({ params }: IDockviewPanelProps<{ tab: WorkspaceTab }>) {
  const render = useContext(ViewContext);
  return <div className={'dock-panel-view view-' + params.tab}>{render(params.tab)}</div>;
}
function TabHeader(props: IDockviewPanelHeaderProps) {
  return (
    <div className="margin-tab-label">
      <span>{props.api.title}</span>
      <span
        aria-hidden="true"
        className="tab-close-glyph"
        title="Close tab"
        onClick={(e) => {
          e.stopPropagation();
          props.api.close();
        }}
      >
        ×
      </span>
    </div>
  );
}
const HeaderControlsContext = createContext<ReactNode>(null);
function HeaderControls({ isGroupActive }: IDockviewHeaderActionsProps) {
  const controls = useContext(HeaderControlsContext);
  return isGroupActive ? controls : null;
}
function HeaderMargin({ containerApi, group }: IDockviewHeaderActionsProps) {
  return containerApi.groups[0]?.id === group.id ? <span className="header-margin" /> : null;
}
function EmptyWorkspace() {
  const controls = useContext(HeaderControlsContext);
  return (
    <div className="empty-workspace">
      <p>Choose a view to keep working.</p>
      {controls}
    </div>
  );
}
const components = { workspace: View };
export default function DockWorkspace({
  sessionId,
  savedLayout,
  render,
  handle,
  allowed,
  report,
}: {
  sessionId: string;
  savedLayout?: Record<string, unknown>;
  render: (tab: WorkspaceTab) => ReactNode;
  handle: RefObject<DockHandle | null>;
  allowed: WorkspaceTab[];
  report: (message: string) => void;
}) {
  const known = useRef(new Set(allowed)),
    recallLayout = useRef<ReturnType<DockviewApi['toJSON']> | null>(null);
  const dock = useRef<DockviewApi | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [available, setAvailable] = useState(false),
    [menu, setMenu] = useState(false),
    [activeTab, setActiveTab] = useState<WorkspaceTab>('brief');
  const key = 'margin-layout-v1-' + sessionId;
  const saveCallback = useRef(() => {});
  const open = (tab: WorkspaceTab) => {
    const d = dock.current;
    if (!d || !allowed.includes(tab)) return;
    const found = d.getPanel(tab);
    if (found) found.api.setActive();
    else
      d.addPanel({
        id: tab,
        title: titles[tab],
        component: 'workspace',
        params: { tab },
        renderer: 'always',
        minimumWidth: 230,
      });
  };
  handle.current = { open };
  const defaults = (d: DockviewApi) => {
    d.clear();
    for (const tab of initialTabs.filter((tab) => allowed.includes(tab))) {
      d.addPanel({
        id: tab,
        title: titles[tab],
        component: 'workspace',
        params: { tab },
        renderer: 'always',
        inactive: tab !== 'brief',
        minimumWidth: 230,
        position: d.panels.length
          ? { referencePanel: d.panels[0].id, direction: 'within' }
          : undefined,
      });
    }
    d.getPanel('brief')?.api.setActive();
  };
  saveCallback.current = () => {
    const d = dock.current;
    if (!d || recallLayout.current) return;
    let layout;
    try {
      layout = d.toJSON();
      if (!layout.grid?.root) return;
    } catch {
      return;
    }
    localStorage.setItem(key, JSON.stringify(layout));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void request(`/sessions/${sessionId}`, 'PATCH', { workspaceLayout: layout }).catch((e) =>
        report(e.message),
      );
    }, 600);
  };
  const ready = ({ api: d }: DockviewReadyEvent) => {
    dock.current = d;
    let restored = false;
    try {
      const saved = localStorage.getItem(key) || JSON.stringify(savedLayout ?? null);
      if (saved && saved !== 'null') {
        d.fromJSON(JSON.parse(saved));
        restored = true;
      }
    } catch {
      d.clear();
    }
    if (!restored || !d.panels.length) defaults(d);
    for (const p of [...d.panels]) if (!allowed.includes(p.id as WorkspaceTab)) d.removePanel(p);
    d.onDidLayoutChange(() => saveCallback.current());
    setActiveTab((d.activePanel?.id as WorkspaceTab) ?? 'brief');
    d.onDidActivePanelChange(({ panel }) => {
      if (panel) setActiveTab(panel.id as WorkspaceTab);
      saveCallback.current();
    });
    d.onDidActiveGroupChange(() => saveCallback.current());
    setAvailable(true);
  };
  useEffect(() => {
    const d = dock.current;
    if (!d) return;
    if (known.current.has('read') && !allowed.includes('read')) recallLayout.current = d.toJSON();
    if (allowed.includes('read') && recallLayout.current) {
      const saved = recallLayout.current;
      d.fromJSON(saved);
      recallLayout.current = null;
    }
    for (const p of [...d.panels]) if (!allowed.includes(p.id as WorkspaceTab)) d.removePanel(p);
    for (const tab of allowed)
      if (initialTabs.includes(tab) && !known.current.has(tab) && !d.getPanel(tab))
        d.addPanel({
          id: tab,
          title: titles[tab],
          component: 'workspace',
          params: { tab },
          renderer: 'always',
          inactive: true,
          position: d.panels.length
            ? {
                referencePanel: d.panels[0].id,
                direction: 'within',
                index: initialTabs.indexOf(tab),
              }
            : undefined,
        });
    known.current = new Set(allowed);
  }, [allowed.join('|')]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const d = dock.current;
      if (d) {
        try {
          const workspaceLayout = recallLayout.current ?? d.toJSON();
          localStorage.setItem(key, JSON.stringify(workspaceLayout));
          void request(`/sessions/${sessionId}`, 'PATCH', { workspaceLayout }).catch(() => {});
        } catch {}
      }
      handle.current = null;
    },
    [key, sessionId, handle],
  );
  const split = (direction: 'right' | 'below') => {
    const d = dock.current,
      active = d?.activePanel;
    if (!d || !active) return;
    const other = d.panels.find((p) => p.group === active.group && p.id !== active.id);
    if (other) {
      const originalGroup = active.group;
      active.api.moveTo({
        group: active.group,
        position: direction === 'below' ? 'bottom' : 'right',
      });
      const companion = d.getPanel(active.id === 'read' ? 'write' : 'read');
      if (companion?.group === originalGroup) companion.api.setActive();
      active.api.setActive();
    } else {
      const tab = allowed.find((t) => !d.getPanel(t));
      if (tab)
        d.addPanel({
          id: tab,
          title: titles[tab],
          component: 'workspace',
          params: { tab },
          renderer: 'always',
          position: { referencePanel: active.id, direction },
        });
    }
  };
  const controls = (
    <div className="layout-controls">
      <select
        className="mobile-view-select"
        aria-label="Current view"
        value={activeTab}
        onChange={(event) => open(event.target.value as WorkspaceTab)}
      >
        {allowed.map((tab) => (
          <option key={tab} value={tab}>
            {titles[tab]}
          </option>
        ))}
      </select>
      <div>
        <button
          className="icon-button views-button"
          aria-label="Views: open a tab"
          aria-expanded={menu}
          title="Open a tab"
          onClick={() => setMenu(!menu)}
        >
          <Plus size={16} />
          <span>Views</span>
        </button>
        <button
          className="icon-button"
          aria-label="Split right"
          title="Split right"
          disabled={!available}
          onClick={() => split('right')}
        >
          <Columns2 size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Split below"
          title="Split below"
          disabled={!available}
          onClick={() => split('below')}
        >
          <Rows2 size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Close active tab"
          title="Close active tab"
          onClick={() => dock.current?.activePanel?.api.close()}
        >
          ×
        </button>
        <button
          className="icon-button"
          aria-label="Reset workspace layout"
          title="Reset layout"
          onClick={() => {
            if (dock.current) defaults(dock.current);
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      {menu && (
        <div className="tab-menu">
          {allowed.map((t) => (
            <button
              key={t}
              onClick={() => {
                open(t);
                setMenu(false);
              }}
            >
              {titles[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className="dock-workspace">
      <HeaderControlsContext.Provider value={controls}>
        <ViewContext.Provider value={render}>
          <DockviewReact
            className="dockview-theme-light margin-dock"
            components={components}
            defaultTabComponent={TabHeader}
            rightHeaderActionsComponent={HeaderControls}
            prefixHeaderActionsComponent={HeaderMargin}
            watermarkComponent={EmptyWorkspace}
            onReady={ready}
            disableFloatingGroups
            popoutUrl={undefined}
          />
        </ViewContext.Provider>
      </HeaderControlsContext.Provider>
    </div>
  );
}
