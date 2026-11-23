"use client";
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { AttioButton, AttioSearch } from './AttioBlocks';
import { Icon } from './AttioIcon';
import type { WorkflowBlockType, WorkflowPoint } from './AttioWorkflowGraph';

/** Host-supplied block choices in the foundation's anchored, dismissible surface. */
export function AttioWorkflowPalette({ types, anchor, onSelect, onClose }: { types: WorkflowBlockType[]; anchor: WorkflowPoint; onSelect: (type: WorkflowBlockType) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const virtualRef = useMemo(() => ({ current: { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) } }), [anchor.x, anchor.y]);
  const choices = types.filter(type => `${type.label} ${type.category}`.toLowerCase().includes(query.toLowerCase()));
  return <Popover open onOpenChange={open => { if(!open) onClose(); }}><PopoverAnchor virtualRef={virtualRef}/><PopoverContent ref={root} className="at-overlay at-workflow-palette" aria-label="Choose workflow block" align="start" sideOffset={0} collisionPadding={12}
    onEscapeKeyDown={event => event.stopPropagation()}
    onCloseAutoFocus={event => { if(previousFocus.current?.isConnected) { event.preventDefault();previousFocus.current.focus(); } }}
    onKeyDown={event => {
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('[data-block-choice]')];const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(event.key === 'ArrowDown' ? 1 : buttons.length-1)+buttons.length)%buttons.length]?.focus();
      }
    }}>
    <div className="at-workflow-palette__search"><AttioSearch aria-label="Search workflow blocks" placeholder="Search blocks…" value={query} onChange={event => setQuery(event.target.value)}/><AttioButton variant="ghost" leadingIcon="close" aria-label="Close block picker" onClick={onClose}/></div>
    <div className="at-workflow-palette__choices">{[...new Set(choices.map(type => type.category))].map(category => <section key={category}><h3>{category}</h3>{choices.filter(type => type.category === category).map(type => <Button variant="ghost" size="sm" data-block-choice key={type.id} onClick={() => { const editor=previousFocus.current?.closest('.at-editor');onSelect(type);onClose();requestAnimationFrame(() => editor?.querySelector<HTMLButtonElement>('.at-editor__inspector .at-block-select__trigger')?.focus()); }}><Icon name={type.icon}/><span>{type.label}</span></Button>)}</section>)}{!choices.length && <p>No matching blocks</p>}</div>
  </PopoverContent></Popover>;
}
