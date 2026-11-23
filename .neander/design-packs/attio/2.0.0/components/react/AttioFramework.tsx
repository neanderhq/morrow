"use client";
import "./attio.css";
import "./attio-tokens.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AttioButton, AttioCheckbox, AttioField, AttioFormGrid, AttioHeader, AttioInput, AttioModal, AttioNavItem, AttioSearch, AttioSelect, AttioSidebar, AttioTextarea } from './AttioBlocks';
import { AttioCollectionToolbar, AttioDataTable, AttioFilterToolbar, type AttioColumn } from './AttioCrmBlocks';
import { Icon, type IconName } from './AttioIcon';
import { AttioKanbanBoard, type AttioKanbanConfig } from './AttioKanban';
import { AttioNoteDetail, type NoteDocument, type EditableNote } from './AttioNoteDetail';
import { AttioHome, type FrameworkHome } from './AttioHome';
import { AttioTaskAssistant, type FrameworkTaskAssistant } from './AttioTaskAssistant';
import { AttioPage, AttioRecordsLayout, AttioWorkspace } from './AttioLayouts';
import { AttioRecordPage, type AttioRecordAction, type AttioRecordBuiltInAction, type AttioRecordCustomAction, type AttioRecordEvent, type AttioRecordHighlight, type AttioRecordProperty, type AttioRecordSection, type AttioRecordTab } from './AttioRecordPage';
import { AttioEmpty, AttioMenu, AttioNotice, type AttioMenuItem } from './AttioStates';
import { AttioWorkspaceRail, type AttioWorkspaceOption } from './AttioWorkspaceRail';
import './attio-framework.css';

export type FrameworkRecord = {
  id: string;
  name: string;
  fields: Record<string, string>;
  recordPage?: {
    properties?: AttioRecordProperty[];
    highlights?: AttioRecordHighlight[];
    events?: AttioRecordEvent[];
    /** Record tabs to show; defaults to Metadata only. Declare other tabs explicitly. */
    tabs?: AttioRecordTab[];
    /** Built-in header controls to show; none appear unless listed here. */
    actions?: AttioRecordBuiltInAction[];
    primaryAction?: AttioRecordCustomAction;
    secondaryActions?: AttioRecordCustomAction[];
    /** Full-width Overview sections for rich customer content. */
    sections?: AttioRecordSection[];
    activityEmpty?: { title: string; description?: string };
  };
};
type FrameworkRow = { id: string; name: string } & Record<string, string>;
export type FrameworkObject = {
  id: string;
  label: string;
  singular: string;
  icon: IconName;
  color?: 'blue' | 'cyan' | 'orange' | 'purple';
  columns: {
    key: string;
    label: string;
    icon?: IconName;
    kind?: 'text' | 'location' | 'date' | 'number' | 'link';
    sortable?: boolean;
    editable?: boolean;
    align?: 'left' | 'right';
    width?: number;
    headerAction?: 'add' | 'enrich';
  }[];
  records: FrameworkRecord[];
  views?: ('table' | 'kanban')[];
  defaultView?: 'table' | 'kanban';
  kanban?: AttioKanbanConfig;
  emptyState?: { title?: string; description?: string };
};
export type FrameworkModule = FrameworkObject;
/** A customer page with no ready-made framework screen (a campaign, report or settings
    page). It renders inside the shell and AttioPage; compose its content from the
    page primitives (AttioSection, AttioCard, AttioStack, AttioInline, AttioGrid,
    AttioStats, AttioStat, AttioList) and shared controls, never custom layout CSS. */
export type FrameworkPage = {
  id: string;
  label: string;
  icon: IconName;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
  /** Full-height canonical editors manage their own canvas and inspector layout. */
  layout?: 'page' | 'editor';
  content: ReactNode;
};
export type RecordActionResult = boolean | void | Promise<boolean | void>;
export type ConfirmedFlowResult = boolean | Promise<boolean>;
export type FrameworkTask = { id: string; title: string; due: string; group: string; record: string; assignee: string; done?: boolean; dueSort?: number };
export type FrameworkNote = { id: string; title: string; creator: string; record: string; created: string; favorite?: boolean; document?: NoteDocument };
export type FrameworkImport = { filename: string; total: number; completed: number; created: number; updated: number; skipped: number; failed: number; rows: FrameworkRecord[] };
export type AttioFrameworkModel = {
  workspace: string;
  initials: string;
  workspaceId?: string;
  workspaceColor?: string;
  workspaces?: AttioWorkspaceOption[];
  featureNav?: { id: string; label: string; icon: IconName; badge?: number }[];
  favorites?: { id: string; label: string; meta?: string; icon?: IconName; collectionId?: string }[];
  lists?: { id: string; label: string }[];
  chats?: { id: string; label: string }[];
  trialDays?: number;
  showHome?: boolean;
  home?: FrameworkHome;
  taskAssistant?: FrameworkTaskAssistant;
  objects: FrameworkObject[];
  modules?: FrameworkModule[];
  pages?: FrameworkPage[];
  tasks?: FrameworkTask[];
  notes?: FrameworkNote[];
  importRun?: FrameworkImport;
  profile?: { firstName: string; lastName: string; email: string; timezone: string };
  assistant?: { label?: string };
};
export type AttioFrameworkActions = {
  /** Resolve true only after the record is saved; failure keeps the create form open. */
  createRecord?: (objectId: string, fields: Record<string, string>) => ConfirmedFlowResult;
  /** Return true (or resolve true) once the records are saved; edit confirmations wait for it. */
  updateRecords?: (objectId: string, records: FrameworkRecord[]) => RecordActionResult;
  createModuleRecord?: (moduleId: string, fields: Record<string, string>) => ConfirmedFlowResult;
  updateModuleRecords?: (moduleId: string, records: FrameworkRecord[]) => RecordActionResult;
  toggleTask?: (id: string, done: boolean) => void;
  createTask?: (title: string, due: string) => ConfirmedFlowResult;
  createWorkflowFromPrompt?: (prompt: string) => ConfirmedFlowResult;
  connectMeetingProvider?: (providerId: string) => ConfirmedFlowResult;
  askTaskAssistant?: (question: string) => string | false | Promise<string | false>;
  /** Resolve true only after the note is saved; failure keeps the draft editable. */
  createNote?: (title: string, record: string) => ConfirmedFlowResult;
  updateNote?: (note: EditableNote) => ConfirmedFlowResult;
  favoriteNote?: (id: string, favorite: boolean) => ConfirmedFlowResult;
  deleteNote?: (id: string) => ConfirmedFlowResult;
  /** Resolve true only after the profile is saved; false or rejection keeps the draft editable. */
  updateProfile?: (profile: NonNullable<AttioFrameworkModel['profile']>) => ConfirmedFlowResult;
  uploadAvatar?: (file: File) => void;
  openFeature?: (id: string) => void;
  /** The host owns the invitation flow. */
  openInviteMembers?: () => void;
  /** @deprecated Use openInviteMembers. Retained as a host-owned compatibility alias. */
  inviteMembers?: (emails?: string[]) => ConfirmedFlowResult;
  openInbox?: () => void;
  /** The host owns the sharing flow. */
  openShare?: () => void;
  /** @deprecated Use openShare. Retained as a host-owned compatibility alias. */
  shareView?: (access?: string) => ConfirmedFlowResult;
  openComments?: (comment?: string) => ConfirmedFlowResult;
  openHelp?: (query?: string) => void;
  openMoreActions?: () => void;
  openAssistant?: () => void;
  importExport?: (objectId: string) => void;
  /** Return true only when the export is ready; the framework waits before confirming it. */
  exportRecords?: (objectId: string) => ConfirmedFlowResult;
  /** Return true (or resolve true) once the action really succeeded; only then does the framework confirm it. Throw or return false to report failure. */
  recordAction?: (objectId: string, recordId: string, action: AttioRecordAction, payload?: Record<string, string>) => RecordActionResult;
  switchWorkspace?: (id: string) => void;
  createWorkspace?: (workspace?: AttioWorkspaceOption) => ConfirmedFlowResult;
  deleteWorkspace?: (id: string) => ConfirmedFlowResult;
  createList?: (label?: string) => ConfirmedFlowResult;
  deleteList?: (id: string) => ConfirmedFlowResult;
  createChat?: (label?: string) => ConfirmedFlowResult;
  deleteChat?: (id: string) => ConfirmedFlowResult;
  upgradePlan?: (plan?: string) => ConfirmedFlowResult;
  signOut?: () => ConfirmedFlowResult;
};
type Page = `note:${string}` | 'home' | 'tasks' | 'notes' | 'settings' | 'import' | `object:${string}` | `module:${string}` | `page:${string}`;
type CreateMode = 'record' | 'task' | 'note' | null;
type FlowKind = 'workspace-create' | 'workspace-manage' | 'list-create' | 'chat-create' | 'comments' | 'signout' | 'record-edit' | 'add-to-list' | 'record-note';
type FrameworkFlow = { kind: FlowKind; title: string; objectId?: string; recordId?: string };

function Avatar({ name }: { name: string }) { return <span className="at-framework__avatar" aria-hidden="true">{name.trim()[0]?.toUpperCase() || '?'}</span>; }
function SectionLabel({ children }: { children: ReactNode }) { return <div className="at-framework__section-label">{children}</div>; }
function fallbackModule(id: string, label: string, icon: IconName): FrameworkModule {
  const singular = label.endsWith('s') ? label.slice(0, -1) : 'Item';
  return {
    id,
    label,
    singular,
    icon,
    columns: [
      { key: 'status', label: 'Status', sortable: true, width: 180 },
      { key: 'owner', label: 'Owner', sortable: true, width: 210 },
      { key: 'updated', label: 'Updated at', kind: 'date', sortable: true, width: 190 },
    ],
    records: [],
    emptyState: { title: `No ${label.toLowerCase()} yet`, description: `Create the first ${singular.toLowerCase()} when this workflow needs one.` },
  };
}

/** A pack-owned, navigable data workspace. Product code supplies the requested model and semantic actions. */
export function AttioFramework({ model, actions = {}, initialPage, theme = 'light' }: { model: AttioFrameworkModel; actions?: AttioFrameworkActions; initialPage?: Page; theme?: 'light' | 'dark' }) {
  const firstObject = model.objects[0];
  const firstModule = model.modules?.[0];
  const firstPage = model.pages?.[0];
  const defaultPage: Page = model.showHome ? 'home' : firstObject ? `object:${firstObject.id}` : firstModule ? `module:${firstModule.id}` : firstPage ? `page:${firstPage.id}` : model.tasks !== undefined ? 'tasks' : model.notes !== undefined ? 'notes' : model.profile ? 'settings' : 'import';
  const [page, setPage] = useState<Page>(initialPage ?? defaultPage);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [createPending, setCreatePending] = useState(false);
  const createPendingRef = useRef(false);
  const [createError, setCreateError] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [flow, setFlow] = useState<FrameworkFlow | null>(null);
  const [flowDraft, setFlowDraft] = useState<Record<string, string>>({});
  const [flowPending, setFlowPending] = useState(false);
  const flowPendingRef = useRef(false);
  const appliedRecordHash = useRef<string | null>(null);
  const detailCloseTimer = useRef<number | null>(null);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [comments, setComments] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [localModules, setLocalModules] = useState<Record<string, FrameworkModule>>({});
  const objectId = page.startsWith('object:') ? page.slice(7) : '';
  const moduleId = page.startsWith('module:') ? page.slice(7) : '';
  const object = model.objects.find((item) => item.id === objectId);
  const module = model.modules?.find((item) => item.id === moduleId) ?? localModules[moduleId];
  const isLocalModule = Boolean(module && !model.modules?.some((item) => item.id === module.id) && localModules[module.id]);
  const collection = object ?? module;
  const customPage = page.startsWith('page:') ? model.pages?.find((item) => item.id === page.slice(5)) : undefined;
  const detail = collection?.records.find((item) => item.id === detailId);
  const currentNote = page.startsWith('note:') ? model.notes?.find((item) => item.id === page.slice(5)) : undefined;
  const label = page === 'home' ? 'Home' : page === 'tasks' ? 'Tasks' : page === 'notes' ? 'Notes' : page === 'settings' ? 'Profile' : page === 'import' ? model.importRun?.filename ?? 'Import' : currentNote?.title ?? customPage?.label ?? collection?.label ?? 'Records';
  const openInviteMembers = actions.openInviteMembers ?? (actions.inviteMembers ? () => { void actions.inviteMembers?.(); } : undefined);
  const openShare = actions.openShare ?? (actions.shareView ? () => { void actions.shareView?.(); } : undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandQuery(''); setCommandOpen(true); }
      if (event.key === 'Escape' && !flowPendingRef.current && !event.defaultPrevented && !document.querySelector('dialog[open]')) { setCommandOpen(false); setFlow(null); setDetailOpen(false); if (detailCloseTimer.current !== null) window.clearTimeout(detailCloseTimer.current); detailCloseTimer.current = window.setTimeout(() => { setDetailId(null); detailCloseTimer.current = null; }, 180); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const openRecordHash = () => {
      const hash = window.location.hash;
      if (hash === appliedRecordHash.current) return;
      const match = /^#([^/]+)\/([^/]+)$/.exec(hash);
      if (!match) { appliedRecordHash.current = null; return; }
      let collectionId: string;
      let recordId: string;
      try {
        collectionId = decodeURIComponent(match[1]);
        recordId = decodeURIComponent(match[2]);
      } catch { appliedRecordHash.current = null; return; }
      const targetObject = model.objects.find((item) => item.id === collectionId);
      const targetModule = model.modules?.find((item) => item.id === collectionId) ?? localModules[collectionId];
      const target = targetObject ?? targetModule;
      if (!target?.records.some((record) => record.id === recordId && record.recordPage)) { appliedRecordHash.current = null; return; }
      appliedRecordHash.current = hash;
      if (detailCloseTimer.current !== null) window.clearTimeout(detailCloseTimer.current);
      setPage(`${targetObject ? 'object' : 'module'}:${collectionId}`);
      setSelected([]);
      setQuery('');
      setDetailId(recordId);
      setDetailOpen(true);
    };
    openRecordHash();
    window.addEventListener('hashchange', openRecordHash);
    return () => window.removeEventListener('hashchange', openRecordHash);
  }, [model.objects, model.modules, localModules]);
  const navigate = (next: Page) => { setPage(next); setSelected([]); setDetailOpen(false); setDetailId(null); setQuery(''); };
  const openDetail = (id: string) => {
    if (detailCloseTimer.current !== null) window.clearTimeout(detailCloseTimer.current);
    detailCloseTimer.current = null;
    setDetailOpen(false);
    setDetailId(id);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setDetailOpen(true)));
  };
  const closeDetail = () => {
    setDetailOpen(false);
    if (detailCloseTimer.current !== null) window.clearTimeout(detailCloseTimer.current);
    detailCloseTimer.current = window.setTimeout(() => { setDetailId(null); detailCloseTimer.current = null; }, 180);
  };
  const openCommand = () => { setCommandQuery(''); setCommandOpen(true); };
  const openFlow = (next: FrameworkFlow, values: Record<string, string> = {}) => { setFailure(''); setFlowDraft(values); setFlow(next); };
  const ensureModule = (id: string, moduleLabel: string, icon: IconName) => {
    if (!model.modules?.some((item) => item.id === id) && !localModules[id]) setLocalModules((current) => ({ ...current, [id]: fallbackModule(id, moduleLabel, icon) }));
    actions.openFeature?.(id);
    navigate(`module:${id}`);
  };
  const createLabel = createMode === 'task' ? 'New task' : createMode === 'note' ? 'New note' : `New ${collection?.singular ?? 'record'}`;
  const beginCreate = (stage?: string) => { setDraft(stage && collection?.kanban ? { [collection.kanban.groupBy]: stage } : {}); setCreateError(''); setCreateMode(page === 'tasks' ? 'task' : (page === 'notes' || currentNote) ? 'note' : 'record'); };
  const canCreate = page === 'tasks' ? !!actions.createTask : page === 'notes' ? !!actions.createNote : !!(object && actions.createRecord) || !!(module && (actions.createModuleRecord || isLocalModule));
  const submitCreate = async () => {
    if (createPendingRef.current) return;
    const name = createMode === 'record' ? draft.name?.trim() : draft.title?.trim();
    if (!name || !createMode) {
      setCreateError(`Enter a ${createMode === 'record' ? 'record name' : createMode === 'task' ? 'task title' : 'note title'} to continue.`);
      return;
    }
    createPendingRef.current = true;
    setCreatePending(true);
    setCreateError('');
    try {
      let saved = false;
      if (createMode === 'note') saved = await actions.createNote?.(name, draft.record ?? '') === true;
      else if (createMode === 'task') saved = await actions.createTask?.(name, draft.due ?? 'Today') === true;
      else if (object) saved = await actions.createRecord?.(object.id, draft) === true;
      else if (module && actions.createModuleRecord) saved = await actions.createModuleRecord(module.id, draft) === true;
      else if (module && isLocalModule) {
        setLocalModules((current) => ({ ...current, [module.id]: { ...module, records: [...module.records, { id: `${module.id}-${Date.now()}`, name, fields: Object.fromEntries(Object.entries(draft).filter(([key]) => key !== 'name')) }] } }));
        saved = true;
      }
      if (saved) setCreateMode(null);
      else setCreateError(`The ${createMode} could not be saved. Please try again.`);
    } catch {
      setCreateError(`The ${createMode} could not be saved. Please try again.`);
    } finally {
      createPendingRef.current = false;
      setCreatePending(false);
    }
  };
  const finishFlow = (message: string) => { setFlow(null); setFlowDraft({}); setFeedback(message); };
  const confirmFlow = async (action: () => RecordActionResult, message: string, onSuccess?: () => void) => {
    if (flowPendingRef.current) return;
    flowPendingRef.current = true;
    setFlowPending(true);
    setFailure('');
    try {
      if (await action() !== true) {
        setFailure('The action could not be completed. Please try again.');
        return;
      }
      onSuccess?.();
      finishFlow(message);
    } catch {
      setFailure('The action could not be completed. Please try again.');
    } finally {
      flowPendingRef.current = false;
      setFlowPending(false);
    }
  };
  // Confirm a record action only when the customer handler reports success.
  // Without a message the app owns its own confirmation; only failures surface.
  const settleRecordAction = (result: RecordActionResult, message?: string) => {
    Promise.resolve(result).then((ok) => {
      if (ok === true && message) setFeedback(message);
      else if (ok === false) setFailure('The action could not be completed');
    }, () => setFailure('The action could not be completed'));
  };
  const deleteCollection = (kind: 'list' | 'chat') => {
    if (!module) return;
    void confirmFlow(() => kind === 'list' ? actions.deleteList?.(module.id) : actions.deleteChat?.(module.id), `${module.label} deleted`, () => navigate(defaultPage));
  };
  const submitFlow = () => {
    if (!flow) return;
    if (flow.kind === 'workspace-create' && flowDraft.name?.trim()) {
      const name = flowDraft.name.trim();
      void confirmFlow(() => actions.createWorkspace?.({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, name, initials: name[0]?.toUpperCase() || 'W', color: flowDraft.color || 'var(--primary)' }), `${name} workspace created`);
    } else if (flow.kind === 'list-create' && flowDraft.name?.trim()) { const name = flowDraft.name.trim(); void confirmFlow(() => actions.createList?.(name), `${name} list created`); }
    else if (flow.kind === 'chat-create' && flowDraft.name?.trim()) { const name = flowDraft.name.trim(); void confirmFlow(() => actions.createChat?.(name), `${name} chat created`); }
    else if (flow.kind === 'comments' && flowDraft.comment?.trim()) { const comment = flowDraft.comment.trim(); void confirmFlow(() => actions.openComments?.(comment), 'Comment added', () => setComments((current) => [...current, comment])); }
    else if (flow.kind === 'signout') { void confirmFlow(() => actions.signOut?.(), 'Signed out', () => setSignedOut(true)); }
    else if (flow.kind === 'record-edit' && flow.objectId && flow.recordId) {
      const targetObject = model.objects.find((item) => item.id === flow.objectId);
      const targetModule = model.modules?.find((item) => item.id === flow.objectId) ?? localModules[flow.objectId];
      const target = targetObject ?? targetModule;
      const records = target?.records.map((record) => record.id === flow.recordId ? { ...record, name: flowDraft.name || record.name, fields: { ...record.fields, ...Object.fromEntries(Object.entries(flowDraft).filter(([key]) => key !== 'name')) } } : record);
      void confirmFlow(() => {
        if (targetObject && records) return actions.updateRecords?.(targetObject.id, records);
        if (targetModule && records && actions.updateModuleRecords) return actions.updateModuleRecords(targetModule.id, records);
        if (targetModule && records && !model.modules?.some((item) => item.id === targetModule.id) && localModules[targetModule.id]) {
          setLocalModules((current) => ({ ...current, [targetModule.id]: { ...targetModule, records } }));
          return true;
        }
        return false;
      }, 'Record updated', () => { actions.recordAction?.(flow.objectId!, flow.recordId!, 'edit', flowDraft); });
    } else if ((flow.kind === 'add-to-list' || flow.kind === 'record-note') && flow.objectId && flow.recordId) {
      const action: AttioRecordAction = flow.kind === 'add-to-list' ? 'add-to-list' : 'create-note';
      const targetRecordName = [...model.objects, ...(model.modules ?? []), ...Object.values(localModules)].find((item) => item.id === flow.objectId)?.records.find((record) => record.id === flow.recordId)?.name ?? '';
      void confirmFlow(async () => {
        if (await actions.recordAction?.(flow.objectId!, flow.recordId!, action, flowDraft) !== true) return false;
        if (flow.kind === 'record-note' && flowDraft.title?.trim() && actions.createNote) {
          return await actions.createNote(flowDraft.title.trim(), targetRecordName);
        }
        return true;
      }, flow.kind === 'add-to-list' ? 'Record added to list' : 'Note created');
    }
  };

  const sidebar = page === 'settings' ? <AttioSidebar header={<><AttioButton variant="ghost" leadingIcon="arrow" onClick={() => navigate(defaultPage)}>Settings</AttioButton></>}>
    <SectionLabel>Personal</SectionLabel><AttioNavItem icon="people" active>Profile</AttioNavItem>
  </AttioSidebar> : <AttioWorkspaceRail model={{
    workspace: { id: model.workspaceId ?? 'active', name: model.workspace, initials: model.initials, color: model.workspaceColor },
    collapsed: navigationCollapsed,
    workspaces: actions.switchWorkspace ? model.workspaces : undefined,
    primary: [
      ...(model.showHome ? [{ id: 'home', label: 'Home', icon: 'grid' as IconName, active: page === 'home' }] : []),
      ...(model.tasks !== undefined ? [{ id: 'tasks', label: 'Tasks', icon: 'task' as IconName, active: page === 'tasks', badge: model.tasks.filter((task) => !task.done).length || undefined }] : []),
      ...(model.notes !== undefined ? [{ id: 'notes', label: 'Notes', icon: 'note' as IconName, active: page === 'notes' || page.startsWith('note:') }] : []),
      ...(model.featureNav ?? []).map((item) => ({ ...item, id: `module:${item.id}`, active: page === `module:${item.id}` })),
      ...(model.pages ?? []).map((item) => ({ id: `page:${item.id}`, label: item.label, icon: item.icon, active: page === `page:${item.id}` })),
    ],
    favorites: model.favorites?.map((item) => ({ id: `favorite:${item.collectionId ? `${item.collectionId}:` : ''}${item.id}`, label: item.label, meta: item.meta, icon: item.icon ?? 'note', active: detailId === item.id && (!item.collectionId || collection?.id === item.collectionId) })),
    records: model.objects.map((item, index) => ({ id: `object:${item.id}`, label: item.label, icon: item.icon, iconTone: item.color ?? (['blue', 'blue', 'orange', 'cyan', 'purple'] as const)[index % 5], active: page === `object:${item.id}` })),
    lists: model.lists?.map((item) => ({ id: `list:${item.id}`, label: item.label, icon: 'grid', active: page === `module:${item.id}` })),
    chats: model.chats?.map((item) => ({ id: `chat:${item.id}`, label: item.label, icon: 'mail', active: page === `module:${item.id}` })),
    trialDays: model.trialDays,
    upgradeLabel: 'Keep Pro',
  }} actions={{
    onNavigate: (id) => {
      if (id === 'home') navigate('home');
      else if (id === 'tasks' || id === 'notes') navigate(id);
      else if (id.startsWith('object:') || id.startsWith('page:')) navigate(id as Page);
      else if (id.startsWith('favorite:')) {
        const favorite = model.favorites?.find((item) => id === `favorite:${item.collectionId ? `${item.collectionId}:` : ''}${item.id}`);
        if (!favorite) return;
        const owner = [...model.objects, ...(model.modules ?? []), ...Object.values(localModules)].find((item) =>
          (!favorite.collectionId || item.id === favorite.collectionId) && item.records.some((record) => record.id === favorite.id),
        );
        if (owner) {
          navigate(`${model.objects.some((item) => item.id === owner.id) ? 'object' : 'module'}:${owner.id}`);
          if (owner.records.find((record) => record.id === favorite.id)?.recordPage) openDetail(favorite.id);
        } else if (favorite.collectionId) setFailure('Favorite record is unavailable');
        else ensureModule(favorite.id, favorite.label, favorite.icon ?? 'note');
      }
      else {
        const item = [...(model.featureNav ?? []), ...(model.favorites ?? []), ...(model.lists ?? []), ...(model.chats ?? [])].find((entry) => id.endsWith(entry.id));
        const nextId = id.startsWith('module:') ? id.slice(7) : item?.id ?? id.split(':').slice(1).join(':');
        ensureModule(nextId, item?.label ?? nextId, 'icon' in (item ?? {}) ? (item as { icon?: IconName }).icon ?? 'grid' : id.startsWith('chat:') ? 'mail' : 'grid');
      }
    },
    onSearch: openCommand,
    onToggleCollapsed: () => setNavigationCollapsed((value) => !value),
    onInbox: actions.openInbox,
    onSwitchWorkspace: actions.switchWorkspace,
    onCreateWorkspace: actions.createWorkspace ? () => openFlow({ kind: 'workspace-create', title: 'New workspace' }, { color: 'var(--primary)' }) : undefined,
    onAccountSettings: model.profile ? () => navigate('settings') : undefined,
    onWorkspaceSettings: (actions.deleteWorkspace || actions.createWorkspace) ? () => openFlow({ kind: 'workspace-manage', title: 'Manage workspaces' }) : undefined,
    onInviteMembers: openInviteMembers,
    onCreateList: actions.createList ? () => openFlow({ kind: 'list-create', title: 'New list' }) : undefined,
    onCreateChat: actions.createChat ? () => openFlow({ kind: 'chat-create', title: 'New chat' }) : undefined,
    onUpgrade: actions.upgradePlan ? () => { void confirmFlow(() => actions.upgradePlan?.(), 'Plan updated'); } : undefined,
    onSignOut: actions.signOut ? () => openFlow({ kind: 'signout', title: 'Sign out' }) : undefined,
  }}/>;

  const pageIcon: IconName = customPage?.icon ?? collection?.icon ?? (page === 'home' ? 'grid' : page === 'tasks' ? 'task' : (page === 'notes' || currentNote) ? 'note' : page === 'settings' ? 'people' : 'download');
  const detailIndex = detail && collection ? collection.records.findIndex((record) => record.id === detail.id) : -1;
  const moreActionItems: AttioMenuItem[] = [
    ...(model.profile ? [{ id: 'settings', label: 'Open settings', icon: 'settings' as IconName, onSelect: () => navigate('settings') }] : []),
    ...(collection && actions.exportRecords ? [{ id: 'export', label: 'Export current view', icon: 'download' as IconName, disabled: flowPending, onSelect: () => { void confirmFlow(() => actions.exportRecords?.(collection.id), `${collection.label} exported`); } }] : []),
  ];
  const showMoreActions = Boolean(actions.openMoreActions && moreActionItems.length > 0);
  const showAssistant = Boolean(model.assistant && actions.openAssistant);
  const simpleHeader = page === 'home' || page === 'tasks';
  const showHeaderActions = Boolean(simpleHeader ? actions.openHelp : model.profile || openShare || actions.openComments || actions.openHelp || showMoreActions || showAssistant);
  const headerActions = showHeaderActions ? <div className="at-framework__header-actions">
    {!simpleHeader && model.profile && <span className="at-framework__header-avatar" aria-label={model.profile.firstName}>{model.profile.firstName[0]}</span>}
    {!simpleHeader && openShare && <AttioButton variant="ghost" className="at-framework__share-button" onClick={openShare}>Share</AttioButton>}
    {!simpleHeader && (model.profile || openShare) && (actions.openComments || actions.openHelp || showMoreActions) && <span className="at-framework__header-divider" aria-hidden="true"/>}
    {!simpleHeader && actions.openComments && <AttioButton variant="ghost" className="at-framework__icon-button" leadingIcon="comments" aria-label="Comments" onClick={() => openFlow({ kind: 'comments', title: 'Comments' })}>Comments</AttioButton>}
    {actions.openHelp && <AttioButton variant="ghost" className={simpleHeader ? 'at-framework__help-button' : 'at-framework__icon-button'} leadingIcon="help" aria-label="Help" onClick={() => actions.openHelp?.()}>Help</AttioButton>}
    {!simpleHeader && showMoreActions && <AttioMenu className="at-framework__more-menu" triggerClassName="at-framework__icon-button" triggerVariant="ghost" ariaLabel="More actions" align="end" label={<Icon name="more" size={15}/>} items={moreActionItems} onOpenChange={(open) => { if (open) actions.openMoreActions?.(); }}/>}
    {!simpleHeader && showAssistant && <AttioButton variant="secondary" className="at-framework__ask-button" leadingIcon="chat" aria-label={model.assistant?.label ?? 'Ask'} onClick={actions.openAssistant}>{model.assistant?.label ?? 'Ask'}</AttioButton>}
  </div> : undefined;
  const header = <AttioHeader actions={headerActions}>{detail && collection ? <span className="at-framework__record-navigation">
    <Button variant="ghost" size="sm" type="button" aria-label="Close record" onClick={closeDetail}><Icon name="close" size={13}/></Button>
    <Button variant="ghost" size="sm" type="button" className="is-previous" aria-label="Previous record" disabled={detailIndex <= 0} onClick={() => setDetailId(collection.records[detailIndex - 1]?.id ?? detail.id)}><Icon name="chevron" size={13}/></Button>
    <Button variant="ghost" size="sm" type="button" className="is-next" aria-label="Next record" disabled={detailIndex >= collection.records.length - 1} onClick={() => setDetailId(collection.records[detailIndex + 1]?.id ?? detail.id)}><Icon name="chevron" size={13}/></Button>
    <span>{detailIndex + 1} of {collection.records.length} in All {collection.label}</span>
  </span> : <span className="at-framework__page-title"><span className={`at-framework__page-icon at-framework__page-icon--${collection?.color ?? 'neutral'}`}><Icon name={pageIcon} size={12}/></span>{label}</span>}</AttioHeader>;

  if (signedOut) return <div className={`at-pack at-${theme} at-framework`}><AttioEmpty icon="people" title="You are signed out" description="This template keeps the signed-out state visible so the host application can reconnect authentication." action={<AttioButton variant="primary" onClick={() => setSignedOut(false)}>Sign back in</AttioButton>}/></div>;
  return <div className={`at-pack at-${theme} at-framework`}>
    <AttioWorkspace sidebar={sidebar} header={header} navigationCollapsed={navigationCollapsed} navigationKey={page}>
      {currentNote?.document ? <AttioNoteDetail key={currentNote.id} note={{ ...currentNote, document: currentNote.document }} onSave={actions.updateNote} onFavorite={actions.favoriteNote} onDelete={actions.deleteNote} onBack={() => navigate('notes')}/> : customPage?.layout === 'editor' ? <div key={page} className="at-framework__editor-page">{customPage.content}</div> : customPage ? <AttioPage key={page} title={customPage.title} description={customPage.description} actions={customPage.actions} width={customPage.width}>{customPage.content}</AttioPage> : page === 'home' && model.showHome ? <AttioHome home={model.home ?? { greeting: 'Home' }} tasks={model.tasks} onWorkflow={actions.createWorkflowFromPrompt} onConnect={actions.connectMeetingProvider} onToggleTask={actions.toggleTask} onViewTasks={model.tasks ? () => navigate('tasks') : undefined} onNewTask={actions.createTask && model.tasks ? () => { setDraft({}); setCreateError(''); setCreateMode('task'); } : undefined}/> : page === 'settings' ? <SettingsView profile={model.profile} onSave={actions.updateProfile} onUpload={actions.uploadAvatar} /> : page === 'import' ? <ImportView run={model.importRun} /> : page === 'tasks' && model.tasks !== undefined ? <TaskView tasks={model.tasks} assistant={model.taskAssistant} onAsk={actions.askTaskAssistant} query={query} onQuery={setQuery} onCreate={actions.createTask && beginCreate} onToggle={actions.toggleTask} /> : page === 'notes' && model.notes !== undefined ? <NoteView notes={model.notes} onOpen={(id) => navigate(`note:${id}`)} query={query} onQuery={setQuery} onCreate={actions.createNote && beginCreate} /> : collection ? <ObjectView key={`${page}:${collection.id}`} object={collection} favorites={model.favorites} query={query} selected={selected} onSelectionChange={setSelected} detail={detail} detailOpen={detailOpen} onDetail={openDetail} onRowsChange={object ? (actions.updateRecords ? (rows) => actions.updateRecords?.(object.id, rows) : undefined) : module ? (actions.updateModuleRecords ? (rows) => actions.updateModuleRecords?.(module.id, rows) : isLocalModule ? (rows) => { setLocalModules((current) => ({ ...current, [module.id]: { ...module, records: rows } })); return true; } : undefined) : undefined} onCreate={canCreate ? beginCreate : undefined} onDelete={module && model.lists?.some((item) => item.id === module.id) && actions.deleteList ? { label: 'Delete list', disabled: flowPending, action: () => deleteCollection('list') } : module && model.chats?.some((item) => item.id === module.id) && actions.deleteChat ? { label: 'Delete chat', disabled: flowPending, action: () => deleteCollection('chat') } : undefined} onImport={object ? (actions.importExport ? () => actions.importExport?.(object.id) : model.importRun ? () => navigate('import') : undefined) : undefined} onExport={actions.exportRecords ? () => { void confirmFlow(() => actions.exportRecords?.(collection.id), `${collection.label} exported`); } : undefined} exportPending={flowPending} canHandleRecordAction={(action) => {
        if (action === 'copy-link') return typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText);
        if (action === 'create-task') return Boolean(actions.createTask);
        if (action === 'create-note') return Boolean(actions.recordAction && actions.createNote);
        if (action === 'edit' || action === 'view-values') return object ? Boolean(actions.updateRecords) : Boolean(actions.updateModuleRecords || isLocalModule);
        return Boolean(actions.recordAction);
      }} onRecordAction={(recordId, action) => {
        const record = collection.records.find((item) => item.id === recordId);
        if (!record) return;
        if (action === 'edit') openFlow({ kind: 'record-edit', title: `Edit ${collection.singular}`, objectId: collection.id, recordId }, { name: record.name, ...record.fields });
        else if (action === 'compose-email') settleRecordAction(actions.recordAction?.(collection.id, recordId, action));
        else if (action === 'add-to-list') openFlow({ kind: 'add-to-list', title: 'Add to list', objectId: collection.id, recordId }, { list: model.lists?.[0]?.label ?? '' });
        else if (action === 'create-note') openFlow({ kind: 'record-note', title: 'Create note', objectId: collection.id, recordId }, { title: '', body: '' });
        else if (action === 'create-task') { setDraft({ title: `Follow up with ${record.name}`, due: 'Tomorrow' }); setCreateError(''); setCreateMode('task'); }
        else if (action === 'view-values') openFlow({ kind: 'record-edit', title: `All ${collection.singular} values`, objectId: collection.id, recordId }, { name: record.name, ...record.fields });
        else if (action === 'copy-link') {
          const copy = navigator.clipboard?.writeText(`${window.location.href.split('#')[0]}#${encodeURIComponent(collection.id)}/${encodeURIComponent(record.id)}`);
          if (!copy) { setFailure('Copying is not available here'); return; }
          copy.then(() => { actions.recordAction?.(collection.id, recordId, action); setFeedback('Record link copied'); }, () => setFailure('The record link could not be copied'));
        }
        // Custom and remaining actions belong to the customer app, which reports its own outcome.
        else settleRecordAction(actions.recordAction?.(collection.id, recordId, action));
      }} importLabel={actions.importExport ? 'Import / Export' : 'Import history'} /> : <AttioEmpty title="No modules configured" description="Add only the modules required by the customer brief."/>}
    </AttioWorkspace>
    {feedback && <div className="at-framework__feedback"><AttioNotice tone="success" onDismiss={() => setFeedback('')}>{feedback}</AttioNotice></div>}
    {failure && !flow && <div className="at-framework__feedback"><AttioNotice tone="error" onDismiss={() => setFailure('')}>{failure}</AttioNotice></div>}
    <AttioModal open={createMode !== null} onClose={() => { if (!createPendingRef.current) setCreateMode(null); }} title={createLabel} size="wide" footer={<><AttioButton disabled={createPending} onClick={() => setCreateMode(null)}>Cancel</AttioButton><AttioButton variant="primary" disabled={createPending} onClick={() => { void submitCreate(); }}>{createPending ? 'Creating…' : 'Create'}</AttioButton></>}>
      {createError && <AttioNotice tone="error" onDismiss={() => setCreateError('')}>{createError}</AttioNotice>}
      <AttioFormGrid>
        {(createMode === 'record' ? [{ key: 'name', label: collection?.singular ?? 'Name' }, ...(collection?.columns.filter((column) => column.key !== 'name').map((column) => ({ key: column.key, label: column.label })) ?? [])] : createMode === 'task' ? [{ key: 'title', label: 'Task' }, { key: 'due', label: 'Due date' }] : [{ key: 'title', label: 'Note title' }, { key: 'record', label: 'Related record' }]).map((field) => <AttioField key={field.key} label={field.label}>{(id) => <AttioInput id={id} value={draft[field.key] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}/>}</AttioField>)}
      </AttioFormGrid>
    </AttioModal>
    <AttioModal open={commandOpen} onClose={() => setCommandOpen(false)} title="Quick actions" size="wide">
      <div className="at-framework__command"><AttioSearch autoFocus aria-label="Search quick actions and records" placeholder="Search quick actions and records..." value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)}/><SectionLabel>Navigate</SectionLabel>{([...(model.tasks !== undefined ? [{ id: 'tasks', label: 'Tasks', icon: 'task' as IconName }] : []), ...(model.notes !== undefined ? [{ id: 'notes', label: 'Notes', icon: 'note' as IconName }] : []), ...model.objects.map((item) => ({ id: `object:${item.id}` as Page, label: item.label, icon: item.icon })), ...(model.modules ?? []).map((item) => ({ id: `module:${item.id}` as Page, label: item.label, icon: item.icon })), ...(model.pages ?? []).map((item) => ({ id: `page:${item.id}` as Page, label: item.label, icon: item.icon }))] as { id: Page; label: string; icon: IconName }[]).filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase())).map((item) => <AttioNavItem key={item.id} icon={item.icon} onClick={() => { navigate(item.id); setCommandOpen(false); }}>{item.label}</AttioNavItem>)}{commandQuery && <><SectionLabel>Records and work</SectionLabel>{[...model.objects.map((item) => ({ item, page: `object:${item.id}` as Page })), ...(model.modules ?? []).map((item) => ({ item, page: `module:${item.id}` as Page }))].flatMap(({ item, page: itemPage }) => item.records.filter((record) => record.recordPage && `${record.name} ${Object.values(record.fields).join(' ')}`.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 4).map((record) => ({ item, itemPage, record }))).map(({ item, itemPage, record }) => <AttioNavItem key={`${item.id}:${record.id}`} icon={item.icon} onClick={() => { navigate(itemPage); window.requestAnimationFrame(() => openDetail(record.id)); setCommandOpen(false); }}>{record.name}</AttioNavItem>)}{model.tasks?.filter((task) => `${task.title} ${task.record}`.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 4).map((task) => <AttioNavItem key={task.id} icon="task" onClick={() => { navigate('tasks'); setQuery(commandQuery); setCommandOpen(false); }}>{task.title}</AttioNavItem>)}{model.notes?.filter((note) => `${note.title} ${note.record}`.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 4).map((note) => <AttioNavItem key={note.id} icon="note" onClick={() => { navigate('notes'); setQuery(commandQuery); setCommandOpen(false); }}>{note.title}</AttioNavItem>)}</>}<SectionLabel>Quick action</SectionLabel>{canCreate && <AttioNavItem icon="plus" onClick={() => { setCommandOpen(false); beginCreate(); }}>Create new</AttioNavItem>}{model.profile && <AttioNavItem icon="settings" onClick={() => { navigate('settings'); setCommandOpen(false); }}>Open settings</AttioNavItem>}</div>
    </AttioModal>
    <AttioModal open={flow !== null} onClose={() => { if (!flowPendingRef.current) setFlow(null); }} title={flow?.title ?? 'Action'} size="wide" footer={flow && <><AttioButton disabled={flowPending} onClick={() => setFlow(null)}>{flow.kind === 'workspace-manage' ? 'Close' : 'Cancel'}</AttioButton>{flow.kind !== 'workspace-manage' && <AttioButton variant="primary" disabled={flowPending} onClick={submitFlow}>{flow.kind === 'signout' ? 'Sign out' : flow.kind === 'comments' ? 'Add comment' : flow.kind === 'record-edit' ? 'Save changes' : flow.kind === 'add-to-list' ? 'Add to list' : flow.kind === 'record-note' ? 'Create note' : 'Create'}</AttioButton>}</>}>
      {flow && <>{failure && <AttioNotice tone="error" onDismiss={() => setFailure('')}>{failure}</AttioNotice>}<FrameworkFlowBody flow={flow} draft={flowDraft} setDraft={setFlowDraft} model={model} actions={actions} comments={comments} onDeleteWorkspace={(id) => { void confirmFlow(() => actions.deleteWorkspace?.(id), 'Workspace deleted'); }} deletePending={flowPending}/></>}
    </AttioModal>
  </div>;
}

function FrameworkFlowBody({ flow, draft, setDraft, model, actions, comments, onDeleteWorkspace, deletePending }: { flow: FrameworkFlow; draft: Record<string, string>; setDraft: (draft: Record<string, string>) => void; model: AttioFrameworkModel; actions: AttioFrameworkActions; comments: string[]; onDeleteWorkspace: (id: string) => void; deletePending: boolean }) {
  const field = (key: string, label: string, type = 'text') => <AttioField label={label}>{(id) => <AttioInput id={id} type={type} value={draft[key] ?? ''} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}/>}</AttioField>;
  if (flow.kind === 'workspace-create') return <AttioFormGrid>{field('name', 'Workspace name')}{field('color', 'Workspace color', 'color')}</AttioFormGrid>;
  if (flow.kind === 'workspace-manage') return <div className="at-framework__manage-list">{(model.workspaces ?? [{ id: model.workspaceId ?? 'active', name: model.workspace, initials: model.initials, color: model.workspaceColor }]).map((workspace) => <div key={workspace.id}><span className="at-workspace-rail__mark" style={{ '--at-workspace-mark': workspace.color ?? 'var(--primary)' } as CSSProperties}>{workspace.initials}</span><span><strong>{workspace.name}</strong>{workspace.id === model.workspaceId && <small>Current workspace</small>}</span><AttioButton disabled={deletePending || !actions.deleteWorkspace || (model.workspaces?.length ?? 1) <= 1} onClick={() => onDeleteWorkspace(workspace.id)}>Delete</AttioButton></div>)}</div>;
  if (flow.kind === 'list-create') return field('name', 'List name');
  if (flow.kind === 'chat-create') return field('name', 'Chat name');
  if (flow.kind === 'comments') return <div className="at-framework__flow-stack">{!!comments.length && <div className="at-framework__flow-items" aria-label="Existing comments">{comments.map((comment, index) => <div key={`${comment}-${index}`}>{comment}</div>)}</div>}<AttioField label="New comment">{(id) => <AttioTextarea id={id} rows={5} value={draft.comment ?? ''} placeholder="Add context for your team" onChange={(event) => setDraft({ ...draft, comment: event.target.value })}/>}</AttioField></div>;
  if (flow.kind === 'signout') return <p>Sign out of this workspace? The framework will move to its signed-out state after confirmation.</p>;
  if (flow.kind === 'record-edit') {
    const object = [...model.objects, ...(model.modules ?? [])].find((item) => item.id === flow.objectId);
    return <AttioFormGrid>{field('name', object?.singular ?? 'Name')}{object?.columns.filter((column) => column.key !== 'name').map((column) => <span key={column.key}>{field(column.key, column.label)}</span>)}</AttioFormGrid>;
  }
  if (flow.kind === 'add-to-list') return <AttioSelect label="List" value={draft.list || model.lists?.[0]?.label || 'Choose a list'} options={model.lists?.map((item) => item.label) ?? ['Choose a list']} onChange={(list) => setDraft({ ...draft, list })}/>;
  return <div className="at-framework__flow-stack">{field('title', 'Note title')}<AttioField label="Note">{(id) => <AttioTextarea id={id} rows={6} value={draft.body ?? ''} onChange={(event) => setDraft({ ...draft, body: event.target.value })}/>}</AttioField></div>;
}

function ObjectView({ object, favorites, query, selected, onSelectionChange, detail, detailOpen, onDetail, onRowsChange, onCreate, onDelete, onImport, onExport, exportPending, canHandleRecordAction, onRecordAction, importLabel }: { object: FrameworkObject; favorites?: AttioFrameworkModel['favorites']; query: string; selected: string[]; onSelectionChange: (ids: string[]) => void; detail?: FrameworkRecord; detailOpen: boolean; onDetail: (id: string) => void; onRowsChange?: (rows: FrameworkRecord[]) => RecordActionResult; onCreate?: (stage?: string) => void; onDelete?: { label: string; disabled?: boolean; action: () => void }; onImport?: () => void; onExport?: () => void; exportPending?: boolean; canHandleRecordAction: (action: AttioRecordAction) => boolean; onRecordAction?: (recordId: string, action: AttioRecordAction) => void; importLabel: string }) {
  const [view, setView] = useState(`All ${object.label}`);
  const layouts = object.views ?? ['table'];
  const [layout, setLayout] = useState<'table' | 'kanban'>(object.defaultView ?? layouts[0] ?? 'table');
  const [sortLabel, setSortLabel] = useState('Last interaction');
  const [sortDirection, setSortDirection] = useState<1 | -1>(1);
  const [hidden, setHidden] = useState<string[]>([]);
  const [customColumns, setCustomColumns] = useState<FrameworkObject['columns']>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKey, setFilterKey] = useState('Name');
  const [filterValue, setFilterValue] = useState('');
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState('');
  const movePendingRef = useRef(false);
  const moveRecordsRef = useRef(object.records);
  useEffect(() => { moveRecordsRef.current = object.records; }, [object.records]);
  const availableColumns = [...object.columns, ...customColumns];
  const sortOptions = ['Last interaction', 'Name', ...availableColumns.filter((column) => column.key !== 'name').map((column) => column.label)];
  const keyForLabel = (label: string) => label === 'Name' ? 'name' : availableColumns.find((column) => column.label === label)?.key ?? 'name';
  const rows = useMemo(() => object.records.filter((record) => {
    if (view.startsWith('Selected') && !selected.includes(record.id)) return false;
    if (!`${record.name} ${Object.values(record.fields).join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false;
    const field = keyForLabel(filterKey);
    return !filterValue || String(field === 'name' ? record.name : record.fields[field] ?? '').toLowerCase().includes(filterValue.toLowerCase());
  }).map((record): FrameworkRow => ({ ...Object.fromEntries(customColumns.map((column) => [column.key, ''])), ...record.fields, id: record.id, name: record.name })).sort((a, b) => sortLabel === 'Last interaction' ? 0 : String(a[keyForLabel(sortLabel)] ?? '').localeCompare(String(b[keyForLabel(sortLabel)] ?? ''), undefined, { numeric: true }) * sortDirection), [object.records, query, view, selected, filterKey, filterValue, sortLabel, sortDirection, customColumns]);
  const iconForKind = (column: FrameworkObject['columns'][number]): IconName | undefined => column.icon ?? (column.kind === 'location' ? 'globe' : column.kind === 'date' ? 'clock' : column.kind === 'number' ? 'chart' : column.kind === 'link' ? 'link' : column.kind === 'text' ? 'note' : undefined);
  const hasRecordPage = (id: string) => Boolean(object.records.find((record) => record.id === id)?.recordPage);
  const columns: AttioColumn<FrameworkRow>[] = [{
    key: 'name', label: object.singular, sortable: true, width: 260, headerAction: 'add',
    render: (_, row) => hasRecordPage(row.id) ? <Button variant="ghost" size="sm" type="button" className="at-framework__record-link" onClick={() => onDetail(row.id)}><span className="at-framework__record-icon"><Icon name={object.icon} size={10}/></span><span>{row.name}</span></Button> : <span className="at-framework__record-link"><span className="at-framework__record-icon"><Icon name={object.icon} size={10}/></span><span>{row.name}</span></span>,
  }, ...availableColumns.filter((column) => column.key !== 'name' && !hidden.includes(column.key)).map((column) => ({
    key: column.key,
    label: column.label,
    icon: iconForKind(column),
    sortable: column.sortable,
    editable: column.editable,
    align: column.align ?? (column.kind === 'number' ? 'right' : 'left'),
    width: column.width,
    headerAction: column.headerAction === 'add' ? ('add' as const) : undefined,
    render: column.kind === 'link' ? (value: FrameworkRow[keyof FrameworkRow]) => <a className="at-framework__cell-link" href={String(value).startsWith('http') ? String(value) : `https://${String(value)}`} target="_blank" rel="noreferrer">{String(value)}</a> : undefined,
  }))];
  const update = async (next: FrameworkRow[]) => {
    if (movePendingRef.current) return false;
    return await onRowsChange?.(object.records.map((record) => {
      const changed = next.find((item) => item.id === record.id);
      if (!changed) return record;
      return { ...record, name: changed.name, fields: Object.fromEntries(Object.entries(changed).filter(([key]) => key !== 'id' && key !== 'name').map(([key, value]) => [key, String(value ?? '')])) };
    })) === true;
  };
  const addColumn = () => setCustomColumns((current) => {
    const index = current.length + 1;
    return [...current, { key: `custom_${index}`, label: index === 1 ? 'Custom field' : `Custom field ${index}`, kind: 'text', editable: true, width: 190 }];
  });
  let detailPage: ReactNode = null;
  if (detail?.recordPage) {
    const defaultProperties: AttioRecordProperty[] = object.columns.map((column) => ({ label: column.label, icon: iconForKind(column) ?? object.icon, value: detail.fields[column.key] || null }));
    const page = detail.recordPage;
    detailPage = <AttioRecordPage name={detail.name} icon={object.icon} isFavorite={Boolean(favorites?.some((item) => item.collectionId === object.id && item.id === detail.id))} properties={page?.properties ?? defaultProperties} highlights={page?.highlights} events={page?.events} tabs={page?.tabs} actions={page?.actions?.filter(canHandleRecordAction)} primaryAction={page?.primaryAction && canHandleRecordAction(`custom:${page.primaryAction.id}`) ? page.primaryAction : undefined} secondaryActions={page?.secondaryActions?.filter((action) => canHandleRecordAction(`custom:${action.id}`))} sections={page?.sections?.map((section) => ({ ...section, action: section.action && canHandleRecordAction(`custom:${section.action.id}`) ? section.action : undefined }))} activityEmpty={page?.activityEmpty} onAction={onRecordAction ? (action) => onRecordAction(detail.id, action) : undefined}/>;
  }
  const importItems = [...(onImport ? [{ id: 'history', label: importLabel, icon: 'download' as IconName, onSelect: onImport }] : []), ...(onExport ? [{ id: 'export', label: 'Export view', icon: 'arrow' as IconName, disabled: exportPending, onSelect: onExport }] : [])];
  const fieldLabels = Object.fromEntries(object.columns.map((column) => [column.key, column.label]));
  const moveCard = async (id: string, stage: string) => {
    if (!onRowsChange || movePendingRef.current) return;
    const next = moveRecordsRef.current.map((record) => record.id === id ? { ...record, fields: { ...record.fields, [object.kanban?.groupBy ?? 'stage']: stage } } : record);
    movePendingRef.current = true;
    setMovePending(true);
    setMoveError('');
    try {
      if (await onRowsChange(next) === true) moveRecordsRef.current = next;
      else setMoveError('The card could not be moved. Please try again.');
    } catch { setMoveError('The card could not be moved. Please try again.'); }
    finally { movePendingRef.current = false; setMovePending(false); }
  };
  const layoutSwitcher = layouts.length > 1 && <div className="at-framework__layout-switcher" role="group" aria-label="Collection layout">{layouts.map((option) => <Button variant="ghost" size="sm" key={option} type="button" disabled={movePending} className={layout === option ? 'is-active' : ''} aria-label={`${option === 'table' ? 'Table' : 'Kanban'} view`} aria-pressed={layout === option} onClick={() => setLayout(option)}><Icon name={option === 'table' ? 'panel' : 'grid'} size={14}/></Button>)}</div>;
  const secondaryAction = (importItems.length || layoutSwitcher || onDelete) ? <>{importItems.length > 0 && <AttioMenu className="at-framework__import-menu" label={<><Icon name="download" size={14}/><span>Import / Export</span><Icon name="chevron" size={12}/></>} items={importItems}/>} {onDelete && <AttioMenu ariaLabel="Collection actions" align="end" label={<Icon name="more" size={14}/>} items={[{ id: 'delete', label: onDelete.label, icon: 'close', danger: true, disabled: onDelete.disabled, onSelect: onDelete.action }]}/>} {layoutSwitcher}</> : undefined;
  return <div className="at-framework__object-view"><div className="at-framework__object-collection"><AttioCollectionToolbar view={view} views={[`All ${object.label}`, `Selected ${object.label}`]} onViewChange={setView} onViewSettings={() => setSettingsOpen(!settingsOpen)} secondaryAction={secondaryAction} primaryAction={onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={() => onCreate()}>New {object.singular}</AttioButton>}/>
    {settingsOpen && <div className="at-framework__options" aria-label="View settings"><strong>Visible columns</strong>{availableColumns.filter((column) => column.key !== 'name').map((column) => <AttioCheckbox key={column.key} label={column.label} checked={!hidden.includes(column.key)} onChange={(checked) => setHidden((current) => checked ? current.filter((key) => key !== column.key) : [...current, column.key])}/>)}</div>}
    <AttioFilterToolbar sortLabel={sortLabel} sortOptions={sortOptions} onSortChange={(label) => { setSortLabel(label); setSortDirection(1); }} onFilter={() => setFilterOpen(!filterOpen)} filterActive={filterOpen || !!filterValue}/>
    {filterOpen && <div className="at-framework__filter-panel"><AttioSelect label="Filter field" value={filterKey} options={sortOptions} onChange={setFilterKey}/><AttioSearch aria-label="Filter value" placeholder="Contains..." value={filterValue} onChange={(event) => setFilterValue(event.target.value)}/><AttioButton variant="ghost" onClick={() => { setFilterKey('Name'); setFilterValue(''); setFilterOpen(false); }}>Clear</AttioButton></div>}
    {moveError && <AttioNotice tone="error" onDismiss={() => setMoveError('')}>{moveError}</AttioNotice>}
    {layout === 'kanban' && object.kanban ? <AttioKanbanBoard singular={object.singular} icon={object.icon} records={rows.map((row) => ({ id: row.id, name: row.name, fields: Object.fromEntries(Object.entries(row).filter(([key]) => !['id', 'name'].includes(key)).map(([key, value]) => [key, String(value)])) }))} config={object.kanban} fieldLabels={fieldLabels} onOpen={onDetail} canOpen={hasRecordPage} onEdit={onRecordAction && canHandleRecordAction('edit') ? (id) => onRecordAction(id, 'edit') : undefined} onMove={onRowsChange ? moveCard : undefined} onCreate={onCreate} saving={movePending}/> : <AttioRecordsLayout>
      {rows.length ? <><AttioDataTable columns={columns} rows={rows} sort={sortLabel === 'Last interaction' ? null : { key: keyForLabel(sortLabel), direction: sortDirection }} onSortChange={(next) => { setSortLabel(next.key === 'name' ? 'Name' : availableColumns.find((column) => column.key === next.key)?.label ?? 'Name'); setSortDirection(next.direction); }} onRowsChange={onRowsChange && !movePending ? update : undefined} confirmEdits onHeaderAction={(_, action) => { if (action === 'add') addColumn(); }} selected={selected} onSelectionChange={onSelectionChange}/><div className="at-framework__table-footer">{rows.length} count</div></> : <><AttioDataTable columns={columns} rows={[]} onHeaderAction={(_, action) => { if (action === 'add') addColumn(); }} selected={selected} onSelectionChange={onSelectionChange}/><div className="at-framework__table-footer">0 count</div><AttioEmpty variant="records" icon={object.icon} title={object.emptyState?.title ?? `No ${object.singular.toLowerCase()} records`} description={object.emptyState?.description ?? (object.id === 'users' ? 'User records let you track the users of your product.' : `Create a ${object.singular.toLowerCase()} record to get started with this view.`)} secondaryAction={onImport && <AttioButton leadingIcon="download" onClick={onImport}>Import CSV</AttioButton>} action={onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={() => onCreate()}>New {object.singular}</AttioButton>}/></>}
    </AttioRecordsLayout>}</div>
    {detailPage && <section className={`at-framework__record-drawer${layout === 'kanban' ? ' at-framework__record-drawer--kanban' : ''}${detailOpen ? ' is-open' : ''}`} aria-label={`${detail?.name ?? object.singular} record panel`}>{detailPage}</section>}
  </div>;
}

function TaskView({ tasks, assistant, onAsk, query, onQuery, onCreate, onToggle }: { tasks: FrameworkTask[]; assistant?: FrameworkTaskAssistant; onAsk?: (question: string) => string | false | Promise<string | false>; query: string; onQuery: (value: string) => void; onCreate?: () => void; onToggle?: (id: string, done: boolean) => void }) {
  const [sortBy, setSortBy] = useState('Due date');
  const [showDone, setShowDone] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(Boolean(assistant?.initiallyOpen));
  const filtered = tasks.filter((task) => (showDone || !task.done) && `${task.title} ${task.record} ${task.assignee} ${task.due}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortBy === 'Task' ? a.title.localeCompare(b.title) : sortBy === 'Assignee' ? a.assignee.localeCompare(b.assignee) : (a.dueSort ?? Number.MAX_SAFE_INTEGER) - (b.dueSort ?? Number.MAX_SAFE_INTEGER) || a.due.localeCompare(b.due));
  const columns: AttioColumn<FrameworkTask>[] = [
    { key: 'title', label: 'Task', icon: 'task', sortable: true, width: 330, render: (_, task) => <span className="at-framework__task"><AttioCheckbox label={task.title} checked={!!task.done} disabled={!onToggle} onChange={(checked) => onToggle?.(task.id, checked)}/></span> },
    { key: 'due', label: 'Due date', icon: 'clock', sortable: true, width: 150, render: (value) => <span className={String(value).toLowerCase().includes('today') ? 'at-framework__due' : ''}>{String(value)}</span> },
    { key: 'record', label: 'Record', icon: 'company', sortable: true, width: 160 },
    { key: 'assignee', label: 'Assigned to', icon: 'people', sortable: true, width: 160, render: (_, task) => <span className="at-framework__assignee"><Avatar name={task.assignee}/>{task.assignee}</span> },
  ];
  return <div className="at-framework__task-workspace"><div className="at-framework__task-main"><AttioFilterToolbar sortLabel={sortBy} sortOptions={['Due date', 'Task', 'Assignee']} onSortChange={setSortBy} onFilter={() => setFilterOpen(!filterOpen)} filterActive={filterOpen || !!query} trailingAction={<><AttioButton leadingIcon="settings" onClick={() => setSettingsOpen(!settingsOpen)}>View settings</AttioButton>{onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={onCreate}>New task</AttioButton>}{assistant && !assistantOpen && <AttioButton leadingIcon="chat" onClick={() => setAssistantOpen(true)}>{assistant.title}</AttioButton>}</>}/>{settingsOpen && <div className="at-framework__options" aria-label="View settings"><strong>Task visibility</strong><AttioCheckbox label="Show completed" checked={showDone} onChange={setShowDone}/></div>}{filterOpen && <div className="at-framework__filter-panel"><AttioSearch aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => onQuery(event.target.value)}/><AttioButton variant="ghost" onClick={() => { onQuery(''); setFilterOpen(false); }}>Clear</AttioButton></div>}<AttioRecordsLayout><AttioDataTable className="at-data-table--compact" columns={columns} rows={filtered} selectable={false} groupBy={(task) => task.group}/><div className="at-framework__table-footer">{filtered.length} count</div>{filtered.length === 0 && <AttioEmpty variant="records" icon="task" title="No tasks" description="Create a task to keep work moving." action={onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={onCreate}>New task</AttioButton>}/>}</AttioRecordsLayout></div>{assistant && assistantOpen && <AttioTaskAssistant assistant={assistant} tasks={tasks} onAsk={onAsk} onToggleTask={onToggle} onClose={() => setAssistantOpen(false)}/>}</div>;
}

function NoteView({ notes, query, onQuery, onCreate, onOpen }: { notes: FrameworkNote[]; onOpen: (id: string) => void; query: string; onQuery: (value: string) => void; onCreate?: () => void }) {
  const [sortBy, setSortBy] = useState('Creation date');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filtered = notes.filter((note) => (!favoritesOnly || note.favorite) && `${note.title} ${note.record}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortBy === 'Title' ? a.title.localeCompare(b.title) : a.created.localeCompare(b.created));
  const columns: AttioColumn<FrameworkNote>[] = [
    { key: 'title', label: 'Note', icon: 'note', sortable: true, width: 390, render: (_, note) => note.document ? <Button variant="ghost" size="sm" type="button" className="at-framework__record-link" onClick={() => onOpen(note.id)}>{note.title}{note.favorite && <span className="at-framework__star">★</span>}</Button> : <span>{note.title}{note.favorite && <span className="at-framework__star">★</span>}</span> },
    { key: 'creator', label: 'Created by', icon: 'people', sortable: true, width: 220, render: (_, note) => <span className="at-framework__assignee"><Avatar name={note.creator}/>{note.creator}</span> },
    { key: 'record', label: 'Record', icon: 'company', sortable: true, width: 220 },
    { key: 'created', label: 'Created at', icon: 'clock', sortable: true, width: 190 },
  ];
  return <><AttioCollectionToolbar view={favoritesOnly ? 'Favorite notes' : 'All notes'} views={['All notes', 'Favorite notes']} onViewChange={(value) => setFavoritesOnly(value === 'Favorite notes')} onViewSettings={() => setSettingsOpen(!settingsOpen)} primaryAction={onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={onCreate}>New note</AttioButton>}/>{settingsOpen && <div className="at-framework__options" aria-label="View settings"><strong>Note visibility</strong><AttioCheckbox label="Favorites only" checked={favoritesOnly} onChange={setFavoritesOnly}/></div>}<AttioFilterToolbar sortLabel={sortBy} sortOptions={['Creation date', 'Title']} onSortChange={setSortBy} onFilter={() => setFilterOpen(!filterOpen)} filterActive={filterOpen || !!query}/>{filterOpen && <div className="at-framework__filter-panel"><AttioSearch aria-label="Search notes" placeholder="Search notes" value={query} onChange={(event) => onQuery(event.target.value)}/><AttioButton variant="ghost" onClick={() => { onQuery(''); setFilterOpen(false); }}>Clear</AttioButton></div>}<AttioRecordsLayout><AttioDataTable className="at-data-table--compact" columns={columns} rows={filtered} selectable={false}/><div className="at-framework__table-footer">{filtered.length} count</div>{filtered.length === 0 && <AttioEmpty variant="records" icon="note" title="No notes" description="Add context to a record." action={onCreate && <AttioButton variant="primary" leadingIcon="plus" onClick={onCreate}>New note</AttioButton>}/>}</AttioRecordsLayout></>;
}

function SettingsView({ profile, onSave, onUpload }: { profile?: AttioFrameworkModel['profile']; onSave?: AttioFrameworkActions['updateProfile']; onUpload?: AttioFrameworkActions['uploadAvatar'] }) {
  const [draft, setDraft] = useState(profile ?? { firstName: '', lastName: '', email: '', timezone: 'UTC' });
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const save = async () => {
    if (!onSave || pending) return;
    setSaved(false);
    setError('');
    setPending(true);
    try {
      if (await onSave(draft)) setSaved(true);
      else setError('Profile could not be saved. Please try again.');
    } catch {
      setError('Profile could not be saved. Please try again.');
    } finally {
      setPending(false);
    }
  };
  return <div className="at-framework__settings"><h1>Profile</h1><p>Manage your personal details.</p><AttioNotice>Changes to your profile will apply to all of your workspaces.</AttioNotice>{saved && <AttioNotice tone="success" onDismiss={() => setSaved(false)}>Profile saved</AttioNotice>}{error && <AttioNotice tone="error" onDismiss={() => setError('')}>{error}</AttioNotice>}<div className="at-framework__settings-profile"><Avatar name={draft.firstName}/><div><strong>Profile Picture</strong><p>Use a PNG or JPEG image.</p><Input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onUpload?.(selected); }}/><AttioButton leadingIcon="plus" disabled={!onUpload} onClick={() => file.current?.click()}>Upload image</AttioButton></div></div><AttioFormGrid><AttioField label="First Name">{(id) => <AttioInput id={id} value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}/>}</AttioField><AttioField label="Last Name">{(id) => <AttioInput id={id} value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}/>}</AttioField></AttioFormGrid><AttioField label="Primary email address">{(id) => <AttioInput id={id} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/>}</AttioField><h2>Time preferences</h2><AttioField label="Preferred Timezone">{(id) => <AttioInput id={id} value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}/>}</AttioField><AttioButton variant="primary" disabled={!onSave || pending} onClick={() => { void save(); }}>{pending ? 'Saving…' : 'Save changes'}</AttioButton></div>;
}

function ImportView({ run }: { run?: FrameworkImport }) {
  if (!run) return <AttioEmpty title="No imports" description="Import a CSV to add records."/>;
  const rows = run.rows.map((record) => ({ id: record.id, record: record.name, status: record.fields.status ?? 'Created', description: record.fields.description ?? '' }));
  const columns: AttioColumn<(typeof rows)[number]>[] = [{ key: 'record', label: 'Record', icon: 'company', sortable: true, width: 280 }, { key: 'status', label: 'Status', icon: 'check', sortable: true, width: 180 }, { key: 'description', label: 'Description', icon: 'note', width: 420 }];
  return <div className="at-framework__import"><div className="at-framework__import-progress"><div><strong>Import completed</strong><span>{run.completed} / {run.total}</span></div><progress max={run.total} value={run.completed}/></div><div className="at-framework__import-summary"><span>{run.created} created</span><span>{run.updated} updated</span><span>{run.skipped} skipped</span><span>{run.failed} failed</span></div><AttioDataTable className="at-data-table--compact" columns={columns} rows={rows} selectable={false}/></div>;
}
