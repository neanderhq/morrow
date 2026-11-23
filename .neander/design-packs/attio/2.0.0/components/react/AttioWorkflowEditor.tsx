"use client";
import { useId, useMemo, useRef, useState } from 'react';
import { AttioBadge, AttioButton, AttioField, AttioInput, AttioSelect, AttioSwitch, AttioTabs, AttioTextarea } from './AttioBlocks';
import { AttioEditor, AttioEditorFeedback, AttioEditorSaveActions, useAttioEditorDraft, type AttioEditorResult } from './AttioEditor';
import { AttioEmpty } from './AttioStates';
import { AttioDataTable } from './AttioCrmBlocks';
import { Icon, type IconName } from './AttioIcon';
import { AttioWorkflowCanvas, AttioWorkflowHistory, type WorkflowViewport } from './AttioWorkflowCanvas';
import { AttioWorkflowFields } from './AttioWorkflowFields';
import { AttioWorkflowPalette } from './AttioWorkflowPalette';
import { AttioWorkflowStart } from './AttioWorkflowStart';
import { arrangeWorkflow, connectBlocks, fieldError, validateWorkflow as validateDraft, normalizeWorkflow, outputsFor, positionOf, removeWorkflowBlocks, type FrameworkWorkflow, type WorkflowBlock, type WorkflowBlockType, type WorkflowField, type WorkflowIssue, type WorkflowPoint, type WorkflowRun, type WorkflowSource, type WorkflowTemplate } from './AttioWorkflowGraph';
export type { FrameworkWorkflow, WorkflowBlock, WorkflowBlockType, WorkflowField, WorkflowRun, WorkflowConnection, WorkflowTemplate, WorkflowIssue } from './AttioWorkflowGraph';

/** A graph authoring surface. The host owns generation, validation policy, persistence and execution. */
export function AttioWorkflowEditor({ workflow, blockTypes, runs, settingsFields, templates, onSave, onPublish, onSetLive, onGenerate, onValidate, onSelectRun }: {
  workflow: FrameworkWorkflow; blockTypes: WorkflowBlockType[]; runs?: WorkflowRun[]; settingsFields?: WorkflowField[]; templates?: WorkflowTemplate[];
  onSave?: (draft: FrameworkWorkflow) => AttioEditorResult; onPublish?: (draft: FrameworkWorkflow) => AttioEditorResult;
  onSetLive?: (live: boolean, draft: FrameworkWorkflow) => AttioEditorResult;
  onGenerate?: (prompt: string) => FrameworkWorkflow | false | Promise<FrameworkWorkflow | false>;
  onValidate?: (draft: FrameworkWorkflow) => WorkflowIssue[]; onSelectRun?: (id: string) => void;
}) {
  const initial = useMemo(() => normalizeWorkflow(workflow, blockTypes), [workflow, blockTypes]);
  const editor = useAttioEditorDraft(initial);
  const { draft, pending } = editor;
  const [selected, setSelected] = useState<string[]>(workflow.blocks[0] ? [workflow.blocks[0].id] : []);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [tab, setTab] = useState('editor');
  const [inspectorOpen, setInspectorOpen] = useState(workflow.blocks.length > 0 && !window.matchMedia('(max-width:720px)').matches);
  const [past, setPast] = useState<FrameworkWorkflow[]>([]);
  const [future, setFuture] = useState<FrameworkWorkflow[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [published, setPublished] = useState(workflow.status === 'published');
  const hasPublished = published || workflow.status === 'published' || editor.baseline.status === 'published';
  const [palette, setPalette] = useState<{ source?: WorkflowSource; anchor: WorkflowPoint; triggerOnly?: boolean } | null>(null);
  const viewport = useRef<WorkflowViewport | undefined>(undefined);
  const prefix = useId(); const [sequence, setSequence] = useState(0);
  const canEdit = Boolean(onSave || onPublish);
  const commit = (next: FrameworkWorkflow) => {
    if (pending || JSON.stringify(next) === JSON.stringify(draft)) return;
    setPast((items) => [...items, draft].slice(-50)); setFuture([]); editor.change({ ...next, status: 'draft' });
  };
  // History restores authored content, never a previous host-confirmed publication or Live state.
  const restore = (snapshot: FrameworkWorkflow) => {
    const next = { ...snapshot, status: editor.baseline.status, enabled: editor.baseline.enabled };
    editor.change({ ...next, status: JSON.stringify(next) === JSON.stringify(editor.baseline) ? editor.baseline.status : 'draft' });
    setSelected((ids) => ids.filter((id) => next.blocks.some((block) => block.id === id))); setSelectedConnection(''); setConnectionError('');
  };
  const undo = () => { if (!pending && past.length) { restore(past[past.length - 1]); setPast(past.slice(0, -1)); setFuture([...future, draft]); } };
  const redo = () => { if (!pending && future.length) { restore(future[future.length - 1]); setFuture(future.slice(0, -1)); setPast([...past, draft]); } };
  const select = (ids: string[], inspect = false) => { setSelected(ids); setSelectedConnection(''); if (inspect && ids.length) setInspectorOpen(true); };
  const block = draft.blocks.find((item) => item.id === selected[0]);
  const definition = blockTypes.find((type) => type.id === block?.type);
  const edge = draft.connections?.find((item) => item.id === selectedConnection);
  const blockLabel = (id: string) => { const item = draft.blocks.find((entry) => entry.id === id); return item ? `${item.description || blockTypes.find((type) => type.id === item.type)?.label || 'Block'} · ${draft.blocks.indexOf(item) + 1}` : 'Unavailable block'; };
  const issues = [...validateDraft(draft, blockTypes), ...(onValidate?.(draft) ?? []), ...(settingsFields ?? []).flatMap((field) => { const error = fieldError(field, draft.settings?.[field.key]); return error ? [{ field: field.key, message: error }] : []; })];
  const openPalette = (source?: WorkflowSource, anchor?: WorkflowPoint, triggerOnly = false) => setPalette({ source, anchor: anchor ?? { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 160 }, triggerOnly });
  const connect = (source: WorkflowSource, target: string) => { setConnectionError(''); const result = connectBlocks(draft, blockTypes, source, target); if (result.workflow) commit(result.workflow); return result.error; };
  const addBlock = (type: WorkflowBlockType) => {
    const id = `${prefix}-${sequence}`; setSequence(sequence + 1);
    const source = palette?.source; const from = draft.blocks.find((item) => item.id === source?.blockId);
    const position = from ? { x: positionOf(from).x + 340, y: positionOf(from).y + Math.max(0, outputsFor(blockTypes.find((item) => item.id === from.type)).findIndex((port) => port.id === source?.portId)) * 170 } : { x: draft.blocks.length ? Math.max(...draft.blocks.map((item) => positionOf(item).x)) + 340 : 80, y: 160 };
    let next: FrameworkWorkflow = { ...draft, blocks: [...draft.blocks, { id, type: type.id, description: '', position, inputs: Object.fromEntries((type.fields ?? []).map((field) => [field.key, field.defaultValue ?? (field.type === 'list' ? [''] : '')])) }] };
    if (source) next = connectBlocks(next, blockTypes, source, id).workflow ?? next;
    commit(next); select([id], true);
  };
  const updateBlock = (patch: Partial<WorkflowBlock>) => {
    if (!block) return;
    const next = { ...block, ...patch }; const type = blockTypes.find((item) => item.id === next.type);
    commit({ ...draft, blocks: draft.blocks.map((item) => item.id === block.id ? next : item), connections: draft.connections?.filter((connection) => (connection.target !== block.id || type?.kind !== 'trigger') && (connection.source !== block.id || outputsFor(type).some((port) => port.id === connection.sourcePort))) });
  };
  const remove = () => { if (!canEdit || pending) return; commit(selectedConnection ? { ...draft, connections: draft.connections?.filter((item) => item.id !== selectedConnection) } : removeWorkflowBlocks(draft, selected)); select([]); };
  const duplicate = () => {
    if (!selected.length || !canEdit || pending) return;
    const ids = new Map(selected.map((id, index) => [id, `${prefix}-${sequence + index}`])); setSequence(sequence + selected.length);
    const copies = draft.blocks.filter((item) => ids.has(item.id)).map((item) => ({ ...item, id: ids.get(item.id)!, inputs: { ...item.inputs }, position: { x: positionOf(item).x + 40, y: positionOf(item).y + 140 } }));
    commit({ ...draft, blocks: [...draft.blocks, ...copies], connections: [...(draft.connections ?? []), ...(draft.connections ?? []).filter((item) => ids.has(item.source) && ids.has(item.target)).map((item) => ({ ...item, id: `${ids.get(item.source)}:${item.sourcePort}`, source: ids.get(item.source)!, target: ids.get(item.target)! }))] }); select(copies.map((item) => item.id));
  };
  const discard = () => { editor.discard(); setPast([]); setFuture([]); select([]); setAttempted(false); setConnectionError(''); };
  const showIssue = (issue: WorkflowIssue) => { if (issue.blockId) { select([issue.blockId], true); setTab('editor'); } else if (issue.field) setTab('settings'); };
  const publish = async () => { setAttempted(true); if (issues.length) { setInspectorOpen(true); showIssue(issues[0]); return; } if (await editor.submit(onPublish, { ...draft, status: 'published' })) setPublished(true); };
  const nextSteps = block && <section className="at-workflow-inspector__next"><h3>Next step</h3><p>Define what happens after this block.</p>{outputsFor(definition).map((port) => {
    const connection = draft.connections?.find((item) => item.source === block.id && item.sourcePort === port.id);
    const candidates = draft.blocks.filter((item) => item.id !== block.id && blockTypes.find((type) => type.id === item.type)?.kind !== 'trigger');
    return <div key={port.id}><strong>{port.label}</strong><AttioSelect label={`Next block for ${port.label}`} ariaLabel={`Next block for ${port.label}`} value={connection ? `${draft.blocks.find((item) => item.id === connection.target)?.description || blockTypes.find((type) => type.id === draft.blocks.find((item) => item.id === connection.target)?.type)?.label} · ${draft.blocks.findIndex((item) => item.id === connection.target) + 1}` : 'Not connected'} options={['Not connected', ...candidates.map((item) => `${item.description || blockTypes.find((type) => type.id === item.type)?.label} · ${draft.blocks.indexOf(item) + 1}`)]} disabled={!canEdit || pending} onChange={(label) => {
      if (label === 'Not connected') commit({ ...draft, connections: draft.connections?.filter((item) => item.id !== connection?.id) });
      else { const target = candidates.find((item) => `${item.description || blockTypes.find((type) => type.id === item.type)?.label} · ${draft.blocks.indexOf(item) + 1}` === label); if (target) { const error = connect({ blockId: block.id, portId: port.id }, target.id); if (error) setConnectionError(error); } }
    }}/>{canEdit && <AttioButton variant="ghost" leadingIcon="plus" disabled={pending} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); openPalette({ blockId: block.id, portId: port.id }, { x: rect.left, y: rect.bottom }); }}>Add next block</AttioButton>}</div>;
  })}</section>;
  const [connectionError, setConnectionError] = useState('');
  const inspector = selected.length === 1 && block ? <div className="at-editor__fields"><div className="at-workflow__inspector-title"><Icon name={definition?.icon ?? 'grid'}/><div><small>{definition?.category ?? 'Block'}</small><strong>{definition?.label ?? block.type}</strong></div></div>
    <AttioField label="Block type">{(id) => <AttioSelect id={id} label="Block type" value={definition?.label ?? block.type} options={blockTypes.filter((type) => type.kind === definition?.kind).map((type) => type.label)} disabled={!canEdit || pending} onChange={(label) => { const type = blockTypes.find((item) => item.label === label); if (type) updateBlock({ type: type.id, inputs: Object.fromEntries((type.fields ?? []).map((field) => [field.key, field.defaultValue ?? (field.type === 'list' ? [''] : '')])) }); }}/>}</AttioField>
    <AttioField label="Description">{(id) => <AttioTextarea id={id} value={block.description} placeholder="Add a description…" disabled={!canEdit || pending} onChange={(event) => updateBlock({ description: event.target.value })}/>}</AttioField>
    <h3>Configuration</h3><AttioWorkflowFields fields={definition?.fields ?? []} values={block.inputs} disabled={!canEdit || pending} showErrors onChange={(inputs) => updateBlock({ inputs })}/>{!definition?.fields?.length && <p>No inputs for this block.</p>}{nextSteps}
    {canEdit && <div className="at-editor__button-row"><AttioButton leadingIcon="copy" disabled={pending} onClick={duplicate}>Duplicate block</AttioButton><AttioButton className="at-editor__danger" leadingIcon="close" disabled={pending} onClick={remove}>Delete block</AttioButton></div>}
  </div> : edge ? <div className="at-editor__fields"><h3>Connection</h3><p>{blockTypes.find((type) => type.id === draft.blocks.find((item) => item.id === edge.source)?.type)?.label} → {blockTypes.find((type) => type.id === draft.blocks.find((item) => item.id === edge.target)?.type)?.label}</p><AttioSelect label="Connection destination" ariaLabel="Connection destination" value={blockLabel(edge.target)} options={draft.blocks.filter((item) => item.id !== edge.source && blockTypes.find((type) => type.id === item.type)?.kind !== 'trigger').map((item) => blockLabel(item.id))} disabled={!canEdit || pending} onChange={(label) => { const target = draft.blocks.find((item) => blockLabel(item.id) === label); if (target) { const error = connect({ blockId: edge.source, portId: edge.sourcePort }, target.id); if (error) setConnectionError(error); } }}/>{canEdit && <AttioButton leadingIcon="close" disabled={pending} onClick={remove}>Remove connection</AttioButton>}</div> : <div className="at-editor__fields"><h3>{selected.length > 1 ? `${selected.length} blocks selected` : 'Workflow checklist'}</h3>{selected.length > 1 && canEdit && <div className="at-editor__button-row"><AttioButton disabled={pending} onClick={duplicate}>Duplicate selected</AttioButton><AttioButton disabled={pending} onClick={remove}>Delete selected</AttioButton></div>}{issues.length ? issues.map((issue, index) => <AttioButton variant="ghost" key={index} className="at-workflow-inspector__issue" onClick={() => showIssue(issue)}>{issue.message}</AttioButton>) : <p>All configured blocks are connected and ready to publish.</p>}</div>;
  const settings = settingsFields && <div className="at-workflow-settings"><h2>Workflow settings</h2><AttioWorkflowFields fields={settingsFields} values={draft.settings ?? {}} disabled={!canEdit || pending} showErrors={attempted} onChange={(values) => commit({ ...draft, settings: values })}/></div>;
  return <AttioEditor canvasMode={tab === 'editor' && draft.blocks.length ? 'fixed' : 'scroll'} name="Workflow editor" title={<><Icon name="link"/><AttioInput aria-label="Workflow name" value={draft.title} aria-invalid={attempted && !draft.title.trim()} disabled={!canEdit || pending} onChange={(event) => commit({ ...draft, title: event.target.value })}/><AttioBadge>{draft.status === 'published' ? 'Published' : 'Draft'}</AttioBadge></>}
    actions={<><AttioEditorSaveActions dirty={editor.dirty} pending={pending} onDiscard={discard} valid={!!draft.title.trim()} onSave={onSave ? () => { void editor.submit(onSave); } : undefined}/>{onSetLive && <AttioSwitch label="Live" ariaLabel="Live workflow" checked={!!draft.enabled} disabled={pending || editor.dirty || draft.status !== 'published'} onChange={(live) => { void editor.submit(() => onSetLive(live, draft), { ...draft, enabled: live }); }}/>}</>}
    toolbar={<><AttioTabs ariaLabel="Workflow views" active={tab} onChange={setTab} tabs={[{ id: 'editor', label: 'Editor', icon: 'grid' }, ...(runs !== undefined ? [{ id: 'runs', label: 'Runs', icon: 'activity' as IconName, count: runs.length }] : []), ...(settingsFields ? [{ id: 'settings', label: 'Settings', icon: 'settings' as IconName }] : [])]}/>{tab === 'editor' && !draft.blocks.length && canEdit && (past.length > 0 || future.length > 0) && <div className="at-workflow-editor__history" role="toolbar" aria-label="Workflow history"><AttioWorkflowHistory onUndo={undo} onRedo={redo} canUndo={past.length > 0 && !pending} canRedo={future.length > 0 && !pending}/></div>}{tab === 'editor' && draft.blocks.length > 0 && canEdit && <AttioButton className="at-workflow-editor__arrange" aria-label="Arrange blocks" leadingIcon="grid" disabled={pending} onClick={() => commit(arrangeWorkflow(draft))}>Arrange blocks</AttioButton>}</>}
    notice={<><AttioEditorFeedback error={editor.error || connectionError} saved={editor.saved}/>{attempted && issues.length > 0 && <div className="at-editor__hint" role="alert">{issues.length} configuration {issues.length === 1 ? 'issue needs' : 'issues need'} attention before publishing.</div>}</>}
    inspector={tab === 'editor' && draft.blocks.length ? inspector : undefined} inspectorTitle="Block settings" inspectorOpen={inspectorOpen} onInspectorOpenChange={setInspectorOpen} collapsibleInspector overlay={palette && <AttioWorkflowPalette types={palette.triggerOnly ? blockTypes.filter((type) => type.kind === 'trigger' || !blockTypes.some((item) => item.kind === 'trigger')) : palette.source ? blockTypes.filter((type) => type.kind !== 'trigger') : blockTypes} anchor={palette.anchor} onSelect={addBlock} onClose={() => setPalette(null)}/>}>
    {tab === 'runs' ? <div className="at-editor__runs"><AttioDataTable columns={[{ key: 'started', label: 'Started', width: 200, render: (_, run: WorkflowRun) => onSelectRun ? <AttioButton variant="ghost" onClick={() => onSelectRun(run.id)}>{run.started}</AttioButton> : run.started }, { key: 'status', label: 'Status', width: 160 }, { key: 'detail', label: 'Details', width: 350 }]} rows={runs ?? []} selectable={false}/>{!runs?.length && <AttioEmpty icon="activity" title="No runs yet" description="Workflow runs will appear here when provided by your application."/>}</div> : tab === 'settings' ? settings : <div className="at-workflow-editor">
      {draft.blocks.length > 0 && <div className="at-workflow-editor__publish"><span>{draft.status === 'published' ? 'This workflow has been published' : hasPublished ? 'This workflow has unpublished changes' : 'This workflow has not yet been published'}</span><div><AttioButton variant="ghost" onClick={() => { select([]); setInspectorOpen(true); }}>Checklist {issues.length > 0 ? `(${issues.length})` : ''}</AttioButton>{onPublish && <AttioButton variant="primary" disabled={pending || (draft.status === 'published' && !editor.dirty)} onClick={publish}>{pending ? 'Saving…' : hasPublished ? 'Publish changes' : 'Publish workflow'}</AttioButton>}</div></div>}
      {draft.blocks.length ? <AttioWorkflowCanvas initialViewport={viewport.current} onViewportChange={(view) => { viewport.current = view; }} workflow={draft} blockTypes={blockTypes} selected={selected} selectedConnection={selectedConnection} issues={issues} editable={canEdit && !pending} onChange={commit} onSelect={select} onSelectConnection={(id) => { setSelected([]); setSelectedConnection(id); setInspectorOpen(true); }} onConnect={connect} onAdd={openPalette} onDelete={remove} onDuplicate={duplicate} onUndo={undo} onRedo={redo} canUndo={past.length > 0 && !pending} canRedo={future.length > 0 && !pending}/> : <AttioWorkflowStart editable={canEdit} templates={templates} onScratch={() => openPalette(undefined, undefined, true)} onTemplate={(template) => { commit(normalizeWorkflow({ ...draft, title: template.label, blocks: template.blocks, connections: template.connections }, blockTypes)); select([]); }} onGenerate={onGenerate} onGenerated={(result) => { commit(normalizeWorkflow({ ...result, id: draft.id, status: 'draft' }, blockTypes)); select([]); }}/>}
    </div>}

  </AttioEditor>;
}
