"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AttioButton, AttioSelect } from './AttioBlocks';
import { AttioNotice } from './AttioStates';
import { Icon } from './AttioIcon';
import { NODE_WIDTH, inputPoint, nodeHeight, outputPoint, outputsFor, positionOf, type FrameworkWorkflow, type WorkflowBlockType, type WorkflowPoint, type WorkflowSource, type WorkflowIssue } from './AttioWorkflowGraph';
import './attio-workflow-graph.css';

export type WorkflowViewport = { x: number; y: number; zoom: number };
type Viewport = WorkflowViewport;
type Gesture = { kind: 'move' | 'pan' | 'connect' | 'select'; pointerId: number; start: WorkflowPoint; view: Viewport; ids: string[]; moved: boolean; positions?: Record<string, WorkflowPoint>; source?: WorkflowSource };
const curve = (from: WorkflowPoint, to: WorkflowPoint) => { const bend = Math.max(60, Math.abs(to.x - from.x) / 2); return `M${from.x},${from.y} C${from.x + bend},${from.y} ${to.x - bend},${to.y} ${to.x},${to.y}`; };

export function AttioWorkflowHistory({ onUndo, onRedo, canUndo, canRedo }: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean }) {
  return <><AttioButton variant="ghost" leadingIcon="undo" aria-label="Undo workflow change" title="Undo" disabled={!canUndo} onClick={onUndo}/><AttioButton variant="ghost" leadingIcon="redo" aria-label="Redo workflow change" title="Redo" disabled={!canRedo} onClick={onRedo}/></>;
}

export function AttioWorkflowCanvas({ workflow, blockTypes, selected, selectedConnection, issues, editable, onChange, onSelect, onSelectConnection, onConnect, onAdd, onDelete, onDuplicate, onUndo, onRedo, canUndo, canRedo, initialViewport, onViewportChange }: {
  workflow: FrameworkWorkflow; blockTypes: WorkflowBlockType[]; selected: string[]; selectedConnection?: string;
  issues: WorkflowIssue[]; editable: boolean; onChange: (workflow: FrameworkWorkflow) => void;
  onSelect: (ids: string[], inspect?: boolean) => void; onSelectConnection: (id: string) => void;
  onConnect: (source: WorkflowSource, target: string) => string | undefined;
  onAdd: (source?: WorkflowSource, anchor?: WorkflowPoint) => void; onDelete: () => void; onDuplicate: () => void;
  initialViewport?: WorkflowViewport; onViewportChange?: (viewport: WorkflowViewport) => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [viewport, setViewportState] = useState<Viewport>(initialViewport ?? { x: 40, y: 60, zoom: 1 });
  const viewRef = useRef(viewport);
  const setViewport = (view: Viewport) => { viewRef.current = view; setViewportState(view); onViewportChange?.(view); };
  const gesture = useRef<Gesture | null>(null);
  const [positions, setPositions] = useState<Record<string, WorkflowPoint>>({});
  const positionsRef = useRef(positions);
  const [connection, setConnection] = useState<WorkflowSource | null>(null);
  const [cursor, setCursor] = useState<WorkflowPoint | null>(null);
  const [selection, setSelection] = useState<{ start: WorkflowPoint; end: WorkflowPoint } | null>(null);
  const [mode, setMode] = useState<'select' | 'pan'>('select');
  const [message, setMessage] = useState('');
  const space = useRef(false);
  const touches = useRef(new Map<number, WorkflowPoint>());
  const pinch = useRef<{ distance: number; view: Viewport; center: WorkflowPoint } | null>(null);
  const currentSelection = useRef(selected); currentSelection.current = selected;
  const lastWorkflow = useRef(workflow);
  lastWorkflow.current = workflow;
  const toWorld = (point: WorkflowPoint, view = viewRef.current) => { const rect = root.current!.getBoundingClientRect(); return { x: (point.x - rect.left - view.x) / view.zoom, y: (point.y - rect.top - view.y) / view.zoom }; };
  const zoomAt = (zoom: number, point?: WorkflowPoint) => {
    const rect = root.current!.getBoundingClientRect();
    const anchor = point ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const world = toWorld(anchor); const next = Math.max(.25, Math.min(2, zoom));
    setViewport({ x: anchor.x - rect.left - world.x * next, y: anchor.y - rect.top - world.y * next, zoom: next });
  };
  const fitWanted = useRef(!initialViewport);
  const fit = (overview = true) => {
    const rect = root.current?.getBoundingClientRect(); const blocks = lastWorkflow.current.blocks;
    if (!rect?.width || !blocks.length) return;
    const left = Math.min(...blocks.map((block) => positionOf(block).x)); const top = Math.min(...blocks.map((block) => positionOf(block).y));
    const right = Math.max(...blocks.map((block) => positionOf(block).x + NODE_WIDTH)); const bottom = Math.max(...blocks.map((block) => positionOf(block).y + nodeHeight(blockTypes.find((type) => type.id === block.type))));
    fitWanted.current = false;
    if (!overview && window.matchMedia('(max-width:720px)').matches) {
      const focus = blocks.find((block) => block.id === currentSelection.current[0]) ?? blocks[0];
      const point = positionOf(focus); const zoom = .8;
      setViewport({ zoom, x: rect.width / 2 - (point.x + NODE_WIDTH / 2) * zoom, y: (rect.height - 80) / 2 - (point.y + 44) * zoom }); return;
    }
    const zoom = Math.max(.25, Math.min(1, (rect.width - 100) / (right - left), (rect.height - 130) / (bottom - top)));
    setViewport({ x: (rect.width - (right - left) * zoom) / 2 - left * zoom, y: (rect.height - 80 - (bottom - top) * zoom) / 2 - top * zoom, zoom });
  };
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => { if (fitWanted.current) fit(false); });
    const resize = new ResizeObserver(() => { if (fitWanted.current) fit(false); }); resize.observe(node);
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('.at-workflow-graph__controls, .at-notice')) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) zoomAt(viewRef.current.zoom * Math.exp(-event.deltaY * .005), { x: event.clientX, y: event.clientY });
      else setViewport({ ...viewRef.current, x: viewRef.current.x - event.deltaX, y: viewRef.current.y - event.deltaY });
    };
    node.addEventListener('wheel', wheel, { passive: false });
    const releaseSpace = () => { space.current = false; };
    window.addEventListener('blur', releaseSpace);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); node.removeEventListener('wheel', wheel); window.removeEventListener('blur', releaseSpace); };
  }, []);
  const blockCount = useRef(workflow.blocks.length);
  useEffect(() => { if (blockCount.current !== workflow.blocks.length) { blockCount.current = workflow.blocks.length; fitWanted.current = true; const frame = requestAnimationFrame(() => fit(false)); return () => cancelAnimationFrame(frame); } }, [workflow.blocks.length]);
  const cancel = () => { gesture.current = null; pinch.current = null; positionsRef.current = {}; setPositions({}); setSelection(null); setConnection(null); setCursor(null); };
  const completeConnection = (source: WorkflowSource, target: string) => {
    const error = onConnect(source, target); setMessage(error ?? 'Connection updated.'); setConnection(null); setCursor(null);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as Element;
    // React events from the select's portal still bubble through this canvas.
    // They belong to the overlay, not a graph selection/pan gesture.
    if (!event.currentTarget.contains(target)) return;
    if (target.closest('.at-workflow-graph__controls, .at-notice, [data-workflow-input], [data-workflow-add], [data-workflow-edge]')) return;
    const point = { x: event.clientX, y: event.clientY };
    touches.current.set(event.pointerId, point);
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      cancel(); pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), view: { ...viewRef.current }, center: toWorld({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) };
      root.current?.setPointerCapture(event.pointerId); return;
    }
    const output = target.closest<HTMLElement>('[data-workflow-output]');
    const handle = target.closest<HTMLElement>('[data-node-handle]');
    let kind: Gesture['kind'] = mode === 'pan' || space.current || event.button === 1 ? 'pan' : event.pointerType === 'touch' ? 'pan' : 'select';
    let ids: string[] = [];
    let source: WorkflowSource | undefined;
    if (mode === 'pan' || space.current || event.button === 1) kind = 'pan';
    else if (output && editable) { source = { blockId: output.dataset.blockId!, portId: output.dataset.workflowOutput! }; kind = 'connect'; setConnection(source); setCursor(toWorld(point)); }
    else if (handle) {
      const id = handle.dataset.nodeHandle!;
      ids = event.shiftKey ? selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] : selected.includes(id) ? selected : [id];
      onSelect(ids); kind = 'move';
    } else if (target.closest('button, input, textarea, [role=button]')) return;
    event.preventDefault(); root.current?.focus(); root.current?.setPointerCapture(event.pointerId);
    gesture.current = { kind, pointerId: event.pointerId, start: point, view: { ...viewRef.current }, ids, moved: false, source, positions: Object.fromEntries(workflow.blocks.map((block) => [block.id, positionOf(block)])) };
    if (kind === 'select' && !handle) setSelection({ start: toWorld(point), end: toWorld(point) });
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = { x: event.clientX, y: event.clientY };
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, point);
    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()]; const rect = root.current!.getBoundingClientRect();
      const zoom = Math.max(.25, Math.min(2, pinch.current.view.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance));
      setViewport({ zoom, x: (a.x + b.x) / 2 - rect.left - pinch.current.center.x * zoom, y: (a.y + b.y) / 2 - rect.top - pinch.current.center.y * zoom }); return;
    }
    const active = gesture.current;
    if (!active) { if (connection) setCursor(toWorld(point)); return; }
    const dx = point.x - active.start.x; const dy = point.y - active.start.y;
    if (Math.hypot(dx, dy) > 3) active.moved = true;
    if (active.kind === 'pan') setViewport({ ...active.view, x: active.view.x + dx, y: active.view.y + dy });
    if (active.kind === 'move' && editable) { const next = Object.fromEntries(active.ids.map((id) => [id, { x: active.positions![id].x + dx / active.view.zoom, y: active.positions![id].y + dy / active.view.zoom }])); positionsRef.current = next; setPositions(next); }
    if (active.kind === 'connect') setCursor(toWorld(point));
    if (active.kind === 'select' && selection) setSelection({ start: selection.start, end: toWorld(point) });
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId);
    if (pinch.current) { if (touches.current.size < 2) pinch.current = null; gesture.current = null; return; }
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.kind === 'move') {
      if (active.moved && editable) onChange({ ...workflow, blocks: workflow.blocks.map((block) => ({ ...block, position: positionsRef.current[block.id] ?? positionOf(block) })) });
      else onSelect(active.ids, true);
    }
    if (active.kind === 'connect' && active.source) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-workflow-input], [data-node-handle]');
      const id = target?.dataset.workflowInput ?? target?.dataset.nodeHandle;
      if (id && active.moved) completeConnection(active.source, id);
      else if (active.moved) { setConnection(null); setCursor(null); setMessage('Connection canceled. Drop on an input port to connect.'); }
    }
    if (active.kind === 'select' && selection) {
      const left = Math.min(selection.start.x, selection.end.x); const right = Math.max(selection.start.x, selection.end.x); const top = Math.min(selection.start.y, selection.end.y); const bottom = Math.max(selection.start.y, selection.end.y);
      onSelect(active.moved ? workflow.blocks.filter((block) => { const p = positionOf(block); return p.x + NODE_WIDTH >= left && p.x <= right && p.y + nodeHeight(blockTypes.find((type) => type.id === block.type)) >= top && p.y <= bottom; }).map((block) => block.id) : []);
    }
    gesture.current = null; positionsRef.current = {}; setPositions({}); setSelection(null);
  };
  const visibleBlocks = workflow.blocks.map((block) => ({ ...block, position: positions[block.id] ?? positionOf(block) }));
  const zoomLabel = `${Math.round(viewport.zoom * 100)}%`;
  return <div ref={root} className={`at-workflow-graph at-workflow-graph--${mode}`} role="region" aria-label="Workflow canvas" tabIndex={0} data-zoom={viewport.zoom} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { touches.current.clear(); cancel(); }} onKeyDown={(event) => {
    if (event.defaultPrevented || (event.target as Element).closest('input, textarea, select, [contenteditable=true], [role=menu], [role=listbox], .at-workflow-graph__controls, .at-notice')) return;
    const command = event.metaKey || event.ctrlKey;
    if (event.key === 'Escape' && (gesture.current || connection || selected.length || selectedConnection)) { event.preventDefault(); cancel(); onSelect([]); }
    else if (event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); space.current = true; }
    else if (command && event.key.toLowerCase() === 'z' && editable) { event.preventDefault(); event.shiftKey ? onRedo() : onUndo(); }
    else if (command && event.key.toLowerCase() === 'd' && editable) { event.preventDefault(); onDuplicate(); }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && editable) { event.preventDefault(); onDelete(); }
    else if (event.key === 'Home') { event.preventDefault(); fit(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(viewport.zoom + .1); }
    else if (event.key === '-') { event.preventDefault(); zoomAt(viewport.zoom - .1); }
    else if (event.key.startsWith('Arrow') && editable && selected.length) { event.preventDefault(); const distance = event.shiftKey ? 50 : 10; onChange({ ...workflow, blocks: workflow.blocks.map((block) => selected.includes(block.id) ? { ...block, position: { x: positionOf(block).x + (event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0), y: positionOf(block).y + (event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0) } } : block) }); }
  }} onKeyUp={(event) => { if (event.key === ' ') space.current = false; }}>
    <div className="at-workflow-graph__world" style={{ transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }}>
      <svg className="at-workflow-graph__edges" aria-label="Workflow connections">{workflow.connections?.map((edge) => { const from = visibleBlocks.find((block) => block.id === edge.source); const to = visibleBlocks.find((block) => block.id === edge.target); if (!from || !to) return null; const type = blockTypes.find((item) => item.id === from.type); const label = `Connection from ${type?.label ?? from.type} (${outputsFor(type).find((port) => port.id === edge.sourcePort)?.label ?? edge.sourcePort}) to ${blockTypes.find((item) => item.id === to.type)?.label ?? to.type}`; return <g key={edge.id} className={selectedConnection === edge.id ? 'is-selected' : ''}><path className="at-workflow-graph__edge-line" d={curve(outputPoint(from, type, edge.sourcePort), inputPoint(to))}/><path data-workflow-edge={edge.id} className="at-workflow-graph__edge-hit" d={curve(outputPoint(from, type, edge.sourcePort), inputPoint(to))} role="button" aria-label={label} tabIndex={0} onClick={() => onSelectConnection(edge.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectConnection(edge.id); } }}/></g>; })}{connection && cursor && (() => { const from = visibleBlocks.find((block) => block.id === connection.blockId); return from ? <path className="at-workflow-graph__edge-line is-preview" d={curve(outputPoint(from, blockTypes.find((type) => type.id === from.type), connection.portId), cursor)}/> : null; })()}</svg>
      {visibleBlocks.map((block) => { const type = blockTypes.find((item) => item.id === block.type); const outputs = outputsFor(type); const errors = issues.filter((issue) => issue.blockId === block.id); return <div key={block.id} className={`at-workflow-graph__node${selected.includes(block.id) ? ' is-selected' : ''}${outputs.length > 1 ? ' has-branches' : ''}`} style={{ transform: `translate(${block.position.x}px,${block.position.y}px)`, minHeight: nodeHeight(type) }} data-node-id={block.id} role="group" aria-label={`${type?.label ?? block.type} block`}>
        {type?.kind === 'trigger' && <span className="at-workflow-graph__trigger">Trigger</span>}
        <Button variant="ghost" size="sm" type="button" className="at-workflow-graph__node-handle" data-node-handle={block.id} aria-label={`Select ${type?.label ?? block.type}`} aria-pressed={selected.includes(block.id)} onClick={(event) => { if (event.detail === 0) onSelect([block.id], true); }}><span><Icon name={type?.icon ?? 'grid'}/><strong>{type?.label ?? block.type}</strong></span><small>{block.description || 'Add a description…'}</small>{errors.length > 0 && <span className="at-workflow-graph__error" title={errors.map((issue) => issue.message).join(' ')} aria-label={`${errors.length} configuration issues`}>!</span>}</Button>
        {type?.kind !== 'trigger' && editable && <Button variant="ghost" size="sm" type="button" className="at-workflow-graph__port at-workflow-graph__port--input" data-workflow-input={block.id} aria-label={`Connect to ${type?.label ?? block.type}`} onClick={() => { if (connection) completeConnection(connection, block.id); else setMessage('Choose an output port first, then connect it to this input.'); }}/>}
        {editable && outputs.map((port, index) => <div className="at-workflow-graph__output" key={port.id} style={{ top: 44 + (index - (outputs.length - 1) / 2) * 24 }}><span>{outputs.length > 1 ? port.label : ''}</span><Button variant="ghost" size="sm" type="button" className={`at-workflow-graph__port${connection?.blockId === block.id && connection.portId === port.id ? ' is-connecting' : ''}`} data-block-id={block.id} data-workflow-output={port.id} aria-label={`Connect from ${type?.label ?? block.type} (${port.label})`} onClick={(event) => { if (event.detail === 0) { setConnection({ blockId: block.id, portId: port.id }); setMessage('Choose an input port to connect. Press Escape to cancel.'); } }}/><Button variant="ghost" size="sm" type="button" className="at-workflow-graph__add" data-workflow-add aria-label={`Add after ${type?.label ?? block.type} (${port.label})`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onAdd({ blockId: block.id, portId: port.id }, { x: rect.right + 8, y: rect.top }); }}><Icon name="plus" size={12}/></Button></div>)}
      </div>; })}
      {selection && <div className="at-workflow-graph__marquee" style={{ left: Math.min(selection.start.x, selection.end.x), top: Math.min(selection.start.y, selection.end.y), width: Math.abs(selection.start.x - selection.end.x), height: Math.abs(selection.start.y - selection.end.y) }}/>}
    </div>
    {message && <div className="at-workflow-graph__message"><AttioNotice tone={message.includes('cannot') || message.includes('cycle') ? 'error' : 'info'} onDismiss={() => setMessage('')}>{message}</AttioNotice></div>}
    <div className="at-workflow-graph__controls" role="toolbar" aria-label="Workflow canvas controls"><AttioSelect label="Canvas zoom" ariaLabel="Canvas zoom" value={zoomLabel} options={[...new Set(['25%', '50%', '75%', '100%', '125%', '150%', '200%', zoomLabel])]} onChange={(value) => zoomAt(parseInt(value) / 100)}/><AttioButton variant="ghost" leadingIcon="fit" aria-label="Fit workflow" title="Fit workflow" onClick={() => fit()}/><AttioButton variant="ghost" leadingIcon="hand" aria-label="Pan canvas" title="Pan canvas" aria-pressed={mode === 'pan'} onClick={() => setMode(mode === 'pan' ? 'select' : 'pan')}/><AttioButton variant="ghost" leadingIcon="cursor" aria-label="Select nodes" title="Select nodes" aria-pressed={mode === 'select'} onClick={() => setMode('select')}/>{editable && <><AttioButton leadingIcon="plus" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onAdd(undefined, { x: rect.left, y: rect.top }); }}>Add block</AttioButton><AttioWorkflowHistory onUndo={onUndo} onRedo={onRedo} canUndo={canUndo} canRedo={canRedo}/></>}</div>
    <span className="at-workflow-graph__sr" aria-live="polite">{selected.length ? `${selected.length} blocks selected.` : 'Drag nodes to move. Drag output ports to inputs to connect. Use Space to pan, Shift to select multiple, and arrow keys to move selected nodes.'}</span>
  </div>;
}
