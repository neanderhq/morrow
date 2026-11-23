"use client";
import { useId, useState } from 'react';
import { AttioBadge, AttioButton, AttioCheckbox, AttioInput, AttioModal, AttioSelect, AttioTextarea } from './AttioBlocks';
import { AttioEditor, AttioEditorFeedback, AttioEditorSaveActions, useAttioEditorDraft, type AttioEditorResult } from './AttioEditor';
import { AttioEmpty, AttioMenu } from './AttioStates';
import { Icon } from './AttioIcon';

export type NoteBlock = { id: string; type: 'Paragraph' | 'Heading' | 'Bullet list' | 'Quote' | 'Checklist'; text: string; checked?: boolean };
export type NoteDocument = { blocks: NoteBlock[] };
export type EditableNote = { id: string; title: string; creator: string; created: string; record: string; favorite?: boolean; document: NoteDocument };
const blockTypes: NoteBlock['type'][] = ['Paragraph', 'Heading', 'Bullet list', 'Quote', 'Checklist'];

function NoteContent({ blocks }: NoteDocument) {
  return <div className="at-note-detail__content">{blocks.map((block) => block.type === 'Heading' ? <h2 key={block.id}>{block.text}</h2> : block.type === 'Quote' ? <blockquote key={block.id}>{block.text}</blockquote> : block.type === 'Bullet list' ? <ul key={block.id}>{block.text.split('\n').map((line, index) => <li key={index}>{line}</li>)}</ul> : block.type === 'Checklist' ? <AttioCheckbox key={block.id} label={block.text} checked={!!block.checked} disabled/> : <p key={block.id}>{block.text}</p>)}</div>;
}

/** Structured text is rendered as React text, never as arbitrary HTML. */
export function AttioNoteDetail({ note, onSave, onFavorite, onDelete, onBack }: {
  note: EditableNote; onSave?: (note: EditableNote) => AttioEditorResult;
  onFavorite?: (id: string, favorite: boolean) => AttioEditorResult;
  onDelete?: (id: string) => AttioEditorResult; onBack?: () => void;
}) {
  const editor = useAttioEditorDraft(note);
  const { draft, change, pending } = editor;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [removed, setRemoved] = useState(false);
  const prefix = useId();
  const [sequence, setSequence] = useState(0);
  const updateBlocks = (blocks: NoteBlock[]) => change({ ...draft, document: { blocks } });
  const updateBlock = (id: string, patch: Partial<NoteBlock>) => updateBlocks(draft.document.blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  const move = (index: number, direction: number) => {
    const blocks = [...draft.document.blocks];
    [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
    updateBlocks(blocks);
  };
  const add = (type: NoteBlock['type']) => { updateBlocks([...draft.document.blocks, { id: `${prefix}-${sequence}`, type, text: '' }]); setSequence(sequence + 1); };
  const save = async () => { if (await editor.submit(onSave)) setEditing(false); };
  const favorite = () => { const next = { ...draft, favorite: !draft.favorite }; void editor.submit(onFavorite ? () => onFavorite(draft.id, !!next.favorite) : undefined, next); };
  const deleteNote = async () => {
    if (await editor.submit(onDelete ? () => onDelete(draft.id) : undefined)) { setConfirm(null); setRemoved(true); onBack?.(); }
  };
  const back = () => { if (editor.dirty) setConfirm('discard'); else onBack?.(); };
  if (removed) return <AttioEmpty icon="note" title="Note deleted" action={onBack && <AttioButton onClick={onBack}>Back to notes</AttioButton>}/>;
  return <AttioEditor name="Note detail" title={<>{onBack && <AttioButton variant="ghost" leadingIcon="chevron" className="at-note-detail__back" aria-label="Back to notes" disabled={pending} onClick={back}/>}<Icon name="note"/><span>{draft.record || 'Note'}</span></>}
    actions={<>{onFavorite && <AttioButton variant="ghost" leadingIcon="star" aria-label={draft.favorite ? 'Remove note from favorites' : 'Favorite note'} aria-pressed={!!draft.favorite} disabled={pending || editor.dirty} onClick={favorite}/>} {editing ? <AttioEditorSaveActions dirty={editor.dirty} pending={pending} onDiscard={() => { editor.discard(); setEditing(false); }} valid={!!draft.title.trim()} onSave={onSave ? () => { void save(); } : undefined}/> : onSave && <AttioButton leadingIcon="note" onClick={() => setEditing(true)}>Edit note</AttioButton>}{onDelete && <AttioMenu ariaLabel="Note actions" align="end" label={<Icon name="more"/>} items={[{ id: 'delete', label: 'Delete note', icon: 'close', danger: true, disabled: pending, onSelect: () => setConfirm('delete') }]}/>}</>}
    notice={<AttioEditorFeedback error={editor.error} saved={editor.saved}/>}>
    <article className="at-note-detail"><div className="at-note-detail__metadata"><span className="at-framework__avatar" aria-hidden="true">{draft.creator[0] ?? '?'}</span><span>{draft.creator}</span><span>{draft.created}</span></div>
      {editing ? <AttioInput className="at-note-detail__title-input" aria-label="Note title" value={draft.title} disabled={pending} onChange={(event) => change({ ...draft, title: event.target.value })}/> : <h1>{draft.title}</h1>}
      {draft.record && <AttioBadge><Icon name="company" size={12}/>{draft.record}</AttioBadge>}
      {editing ? <div className="at-note-detail__blocks">{draft.document.blocks.map((block, index) => <section className="at-note-detail__block" key={block.id} aria-label={`Block ${index + 1}`}><div className="at-note-detail__block-toolbar"><AttioSelect label="Block type" ariaLabel={`Block ${index + 1} type`} value={block.type} options={blockTypes} disabled={pending} onChange={(type) => updateBlock(block.id, { type: type as NoteBlock['type'] })}/><div className="at-editor__button-row"><AttioButton variant="ghost" leadingIcon="sort" aria-label={`Move block ${index + 1} up`} disabled={pending || index === 0} onClick={() => move(index, -1)}/><AttioButton variant="ghost" leadingIcon="arrow" aria-label={`Move block ${index + 1} down`} disabled={pending || index === draft.document.blocks.length - 1} onClick={() => move(index, 1)}/><AttioButton variant="ghost" leadingIcon="close" aria-label={`Delete block ${index + 1}`} disabled={pending} onClick={() => updateBlocks(draft.document.blocks.filter((item) => item.id !== block.id))}/></div></div><AttioTextarea aria-label={`Block ${index + 1} text`} value={block.text} placeholder={block.type === 'Bullet list' ? 'One item per line…' : 'Start typing…'} disabled={pending} onChange={(event) => updateBlock(block.id, { text: event.target.value })}/>{block.type === 'Checklist' && <AttioCheckbox label="Completed" checked={!!block.checked} disabled={pending} onChange={(checked) => updateBlock(block.id, { checked })}/>}</section>)}<AttioMenu ariaLabel="Add note block" label={<><Icon name="plus"/>Add content</>} items={blockTypes.map((type) => ({ id: type, label: type, disabled: pending, onSelect: () => add(type) }))}/></div> : draft.document.blocks.length ? <NoteContent blocks={draft.document.blocks}/> : <AttioEmpty icon="note" title="No content yet" description="Add context, meeting notes, or next steps." action={onSave && <AttioButton onClick={() => setEditing(true)}>Write a note</AttioButton>}/>}
    </article>
    <AttioModal open={confirm !== null} title={confirm === 'delete' ? 'Delete note?' : 'Discard changes?'} onClose={() => { if (!pending) setConfirm(null); }} footer={<><AttioButton disabled={pending} onClick={() => setConfirm(null)}>Cancel</AttioButton><AttioButton variant="primary" disabled={pending} onClick={() => { if (confirm === 'delete') void deleteNote(); else { editor.discard(); setConfirm(null); onBack?.(); } }}>{pending ? 'Deleting…' : confirm === 'delete' ? 'Delete note' : 'Discard and leave'}</AttioButton></>}><p>{confirm === 'delete' ? 'This note will be deleted when your application confirms the action.' : 'Your unsaved changes will be discarded.'}</p>{editor.error && <AttioEditorFeedback error={editor.error} saved={false}/>}</AttioModal>
  </AttioEditor>;
}
