"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AttioButton, AttioBadge, AttioSelect } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';
import { AttioEmpty } from './AttioStates';
import './attio-kanban.css';

export type AttioKanbanStage = { id: string; label: string; color?: string };
export type AttioKanbanConfig = {
  groupBy: string;
  stages: AttioKanbanStage[];
  cardFields?: string[];
};
export type AttioKanbanRecord = { id: string; name: string; fields: Record<string, string> };

type Drag = { id: string; from: string; over: string | null; index: number; x: number; y: number; dx: number; dy: number; width: number; height: number; settling?: { x: number; y: number } };
type Press = { id: string; from: string; x: number; y: number; el: HTMLElement };

/** The column and position under the pointer, ignoring the card being dragged. */
function dropTarget(x: number, y: number, id: string) {
  const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-stage]');
  if (!column?.dataset.stage) return { over: null, index: 0 };
  const cards = [...column.querySelectorAll<HTMLElement>('[data-record]')].filter((card) => card.dataset.record !== id);
  return { over: column.dataset.stage, index: cards.filter((card) => { const rect = card.getBoundingClientRect(); return y > rect.top + rect.height / 2; }).length };
}

export function AttioKanbanBoard({
  singular,
  icon,
  records,
  config,
  fieldLabels,
  onOpen,
  canOpen,
  onEdit,
  onMove,
  onCreate,
  saving = false,
}: {
  singular: string;
  icon: IconName;
  records: AttioKanbanRecord[];
  config: AttioKanbanConfig;
  fieldLabels: Record<string, string>;
  onOpen: (id: string) => void;
  canOpen?: (id: string) => boolean;
  onEdit?: (id: string) => void;
  onMove?: (id: string, stage: string) => void;
  onCreate?: (stage?: string) => void;
  saving?: boolean;
}) {
  const cardFields = config.cardFields ?? Object.keys(fieldLabels).filter((key) => key !== config.groupBy).slice(0, 3);
  const stageOf = (record: AttioKanbanRecord) => record.fields[config.groupBy] || config.stages[0]?.id;
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<Press | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const setDrag = (next: Drag | null) => { dragRef.current = next; setDragState(next); };

  // Mouse and pen drag cards between columns; touch and keyboard use the Stage select.
  useEffect(() => {
    if (!onMove || saving) return;
    const move = (event: PointerEvent) => {
      const pressed = press.current;
      const current = dragRef.current;
      if (!pressed || current?.settling) return;
      if (!current) {
        if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 5) return;
        const rect = pressed.el.getBoundingClientRect();
        setDrag({ id: pressed.id, from: pressed.from, ...dropTarget(event.clientX, event.clientY, pressed.id), x: event.clientX, y: event.clientY, dx: pressed.x - rect.left, dy: pressed.y - rect.top, width: rect.width, height: rect.height });
        return;
      }
      const area = board.current?.getBoundingClientRect();
      if (area && board.current) {
        if (event.clientX > area.right - 48) board.current.scrollLeft += 14;
        if (event.clientX < area.left + 48) board.current.scrollLeft -= 14;
        if (event.clientY > area.bottom - 48) board.current.scrollTop += 14;
        if (event.clientY < area.top + 48) board.current.scrollTop -= 14;
      }
      setDrag({ ...current, x: event.clientX, y: event.clientY, ...dropTarget(event.clientX, event.clientY, current.id) });
    };
    const finish = () => {
      const current = dragRef.current;
      press.current = null;
      if (!current || current.settling) return;
      const stage = current.over;
      if (!stage || stage === current.from) { setDrag(null); return; }
      const rect = slot.current?.getBoundingClientRect();
      if (!rect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { moveRef.current?.(current.id, stage); setDrag(null); return; }
      setDrag({ ...current, settling: { x: rect.left, y: rect.top } });
      window.setTimeout(() => { moveRef.current?.(current.id, stage); setDrag(null); }, 170);
    };
    const cancel = () => { press.current = null; if (!dragRef.current?.settling) setDrag(null); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && dragRef.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
    };
  }, [Boolean(onMove), saving]);

  const startPress = (event: ReactPointerEvent<HTMLElement>, record: AttioKanbanRecord) => {
    if (!onMove || saving || event.button !== 0 || event.pointerType === 'touch') return;
    if ((event.target as Element).closest('button, a, input, select, textarea, [role="listbox"], .at-block-select')) return;
    event.preventDefault();
    press.current = { id: record.id, from: stageOf(record) ?? '', x: event.clientX, y: event.clientY, el: event.currentTarget };
  };
  const face = (record: AttioKanbanRecord, interactive: boolean) => <>
    <div className="at-collection-card__title"><span><Icon name={icon} size={11}/></span>{interactive && (canOpen?.(record.id) ?? true) ? <Button variant="ghost" size="sm" type="button" onClick={() => onOpen(record.id)}>{record.name}</Button> : <strong>{record.name}</strong>}{interactive && (onEdit || (canOpen?.(record.id) ?? true)) && <div className="at-collection-card__actions">{onEdit && <Button variant="ghost" size="sm" type="button" aria-label={`Edit ${record.name}`} disabled={saving} onClick={() => onEdit(record.id)}><Icon name="note" size={13}/></Button>}{(canOpen?.(record.id) ?? true) && <Button variant="ghost" size="sm" type="button" aria-label={`Open ${record.name}`} onClick={() => onOpen(record.id)}><Icon name="panel" size={13}/></Button>}</div>}</div>
    <dl>{cardFields.map((key) => <div key={key}><dt>{fieldLabels[key] ?? key}</dt><dd>{record.fields[key] || 'Not set'}</dd></div>)}</dl>
  </>;
  const dragged = drag ? records.find((record) => record.id === drag.id) : undefined;
  return <div className="at-collection-board-shell">
    <div ref={board} className={`at-collection-board${drag ? ' is-dragging' : ''}`} role="region" aria-label={`${singular} kanban board`} aria-busy={saving}>
      {config.stages.map((stage) => {
        const cards = records.filter((record) => stageOf(record) === stage.id);
        const visible = cards.filter((record) => record.id !== drag?.id);
        const isTarget = drag?.over === stage.id;
        return <section className={`at-collection-board__column${isTarget ? ' is-drop-target' : ''}`} data-stage={stage.id} key={stage.id} style={{ '--at-stage-color': stage.color ?? 'var(--primary)' } as CSSProperties}>
          <header><span className="at-collection-board__dot"/><strong>{stage.label}</strong><AttioBadge>{cards.length}</AttioBadge><span className="at-spacer"/>{onCreate && <AttioButton variant="ghost" leadingIcon="plus" aria-label={`Create ${singular} in ${stage.label}`} disabled={saving} onClick={() => onCreate(stage.id)}>Create</AttioButton>}</header>
          <div className="at-collection-board__cards">
            {visible.flatMap((record, index) => {
              const card = <article className="at-collection-card" data-record={record.id} data-draggable={onMove && !saving ? 'true' : undefined} key={record.id} onPointerDown={(event) => startPress(event, record)}>
                {face(record, true)}
                {onMove && <div className="at-collection-card__move"><span>Stage</span><AttioSelect className="at-collection-card__stage-select" label="Stage" ariaLabel={`Move ${record.name} to stage`} disabled={saving} value={config.stages.find((option) => option.id === (record.fields[config.groupBy] || config.stages[0]?.id))?.label ?? config.stages[0]?.label ?? ''} options={config.stages.map((option) => option.label)} onChange={(next) => { const stage = config.stages.find((option) => option.label === next); if (stage) onMove(record.id, stage.id); }}/></div>}
              </article>;
              return drag && isTarget && drag.index === index ? [<div ref={slot} key="slot" className="at-collection-board__slot" style={{ '--at-slot-height': `${drag.height}px` } as CSSProperties}/>, card] : [card];
            })}
            {drag && isTarget && drag.index >= visible.length && <div ref={slot} key="slot" className="at-collection-board__slot" style={{ '--at-slot-height': `${drag.height}px` } as CSSProperties}/>}
            {visible.length === 0 && !isTarget && onCreate && <Button variant="ghost" size="sm" type="button" className="at-collection-board__new" disabled={saving} onClick={() => onCreate(stage.id)}><Icon name="plus" size={14}/>New {singular}</Button>}
          </div>
        </section>;
      })}
    </div>
    {drag && dragged && <article className={`at-collection-card at-collection-card--floating${drag.settling ? ' is-settling' : ''}`} aria-hidden="true" style={{ left: drag.settling?.x ?? drag.x - drag.dx, top: drag.settling?.y ?? drag.y - drag.dy, width: drag.width }}>{face(dragged, false)}</article>}
    {records.length === 0 && <AttioEmpty variant="records" icon={icon} title={`No ${singular.toLowerCase()} records`} description={`Create a ${singular.toLowerCase()} to start this workflow.`} action={onCreate && <AttioButton variant="primary" leadingIcon="plus" disabled={saving} onClick={() => onCreate(config.stages[0]?.id)}>New {singular}</AttioButton>}/>}
  </div>;
}
