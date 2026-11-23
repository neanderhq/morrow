"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AttioButton } from './AttioBlocks';
import { AttioNotice } from './AttioStates';
import './attio-editors.css';

export type AttioEditorResult = boolean | Promise<boolean>;

/** A local UI draft. The host confirms writes; a failed write never clears the draft. */
export function useAttioEditorDraft<T>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const incoming = JSON.stringify(initial);
  const lastIncoming = useRef(incoming);
  useEffect(() => {
    if (pendingRef.current || lastIncoming.current === incoming) return;
    lastIncoming.current = incoming;
    if (incoming === JSON.stringify(baseline)) return;
    setBaseline(initial);
    if (!dirty) { setDraft(initial); setSaved(false); setError(''); }
  }, [incoming, pending]);

  const change = (next: T) => { if (!pendingRef.current) { setDraft(next); setSaved(false); setError(''); } };
  const discard = () => { if (!pendingRef.current) { setDraft(baseline); setError(''); setSaved(false); } };
  const submit = async (action: ((value: T) => AttioEditorResult) | undefined, next = draft) => {
    if (!action || pendingRef.current) return false;
    pendingRef.current = true; setPending(true); setError(''); setSaved(false);
    try {
      if (await action(next) !== true) { setError('Changes could not be saved. Your draft is preserved.'); return false; }
      setBaseline(next); setDraft(next); setSaved(true); return true;
    } catch { setError('Changes could not be saved. Your draft is preserved.'); return false; }
    finally { pendingRef.current = false; setPending(false); }
  };
  return { draft, baseline, dirty, pending, error, saved, change, discard, submit };
}

export function AttioEditor({ name, title, actions, toolbar, inspector, inspectorTitle = 'Configuration', collapsibleInspector = false, canvasMode = 'scroll', inspectorOpen: controlledOpen, onInspectorOpenChange, notice, overlay, children }: {
  name: string; title: ReactNode; actions?: ReactNode; toolbar?: ReactNode;
  inspector?: ReactNode; inspectorTitle?: string; collapsibleInspector?: boolean; canvasMode?: 'scroll' | 'fixed'; inspectorOpen?: boolean; onInspectorOpenChange?: (open: boolean) => void; notice?: ReactNode; overlay?: ReactNode; children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const inspectorOpen = controlledOpen ?? internalOpen;
  const setInspectorOpen = (open: boolean) => { setInternalOpen(open); onInspectorOpenChange?.(open); };
  const toggle = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!inspector || !inspectorOpen || !window.matchMedia('(max-width:720px)').matches) return;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !panel.current?.closest('.at-editor')?.querySelector('[aria-haspopup][aria-expanded="true"]') && !document.querySelector('dialog[open]')) { event.preventDefault(); setInternalOpen(false); onInspectorOpenChange?.(false); toggle.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [Boolean(inspector), inspectorOpen, onInspectorOpenChange]);
  return <section className={`at-editor${collapsibleInspector ? ' at-editor--collapsible' : ''}${canvasMode === 'fixed' ? ' at-editor--fixed-canvas' : ''}`} aria-label={name}>
    <header className="at-editor__header"><div className="at-editor__header-content"><div className="at-editor__title">{title}</div><div className="at-editor__actions">{actions}{inspector && <span ref={toggle} className="at-editor__inspector-toggle"><AttioButton leadingIcon="settings" aria-label={inspectorTitle} title={inspectorTitle} aria-expanded={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}>{inspectorTitle}</AttioButton></span>}</div></div></header>
    {toolbar && <div className="at-editor__toolbar">{toolbar}</div>}
    {notice}
    <div className={`at-editor__body${inspector && inspectorOpen ? ' is-inspector-open' : ''}`}><div className="at-editor__canvas">{children}</div>{inspector && <aside ref={panel} className="at-editor__inspector" aria-label={inspectorTitle}><div className="at-editor__inspector-mobile-head"><strong>{inspectorTitle}</strong><AttioButton variant="ghost" leadingIcon="close" aria-label={`Close ${inspectorTitle.toLowerCase()}`} onClick={() => { setInspectorOpen(false); toggle.current?.querySelector('button')?.focus(); }}/></div>{inspector}</aside>}</div>
    {overlay}
  </section>;
}

export function AttioEditorFeedback({ error, saved }: { error: string; saved: boolean }) {
  return error ? <AttioNotice tone="error">{error}</AttioNotice> : saved ? <AttioNotice tone="success">Changes saved</AttioNotice> : null;
}

export function AttioEditorSaveActions({ dirty, pending, valid = true, onSave, onDiscard }: { dirty: boolean; pending: boolean; valid?: boolean; onSave?: () => void; onDiscard: () => void }) {
  return onSave ? <><AttioButton className="at-editor__discard" variant="ghost" leadingIcon="undo" aria-label="Discard changes" title="Discard changes" disabled={!dirty || pending} onClick={onDiscard}>Discard changes</AttioButton><AttioButton className="at-editor__save" variant="primary" leadingIcon="check" aria-label={pending ? 'Saving changes' : 'Save changes'} title="Save changes" disabled={!dirty || pending || !valid} onClick={onSave}>{pending ? 'Saving…' : 'Save changes'}</AttioButton></> : null;
}
