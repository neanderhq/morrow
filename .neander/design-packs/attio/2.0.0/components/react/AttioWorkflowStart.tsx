"use client";
import { useRef, useState } from 'react';
import { AttioButton, AttioTextarea } from './AttioBlocks';
import { AttioNotice } from './AttioStates';
import type { FrameworkWorkflow, WorkflowTemplate } from './AttioWorkflowGraph';

export function AttioWorkflowStart({ editable, templates = [], onScratch, onTemplate, onGenerate, onGenerated }: {
  editable: boolean; templates?: WorkflowTemplate[]; onScratch: () => void; onTemplate: (template: WorkflowTemplate) => void;
  onGenerate?: (prompt: string) => FrameworkWorkflow | false | Promise<FrameworkWorkflow | false>; onGenerated: (workflow: FrameworkWorkflow) => void;
}) {
  const [prompt, setPrompt] = useState(''); const [pending, setPending] = useState(false); const busy = useRef(false); const [error, setError] = useState('');
  const generate = async () => {
    if (!onGenerate || !prompt.trim() || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { const result = await onGenerate(prompt.trim()); if (result === false) setError('The workflow could not be created. Your prompt is preserved.'); else onGenerated(result); }
    catch { setError('The workflow could not be created. Your prompt is preserved.'); }
    finally { busy.current = false; setPending(false); }
  };
  return <div className="at-workflow-start"><div className="at-workflow-start__content">
    {editable && onGenerate && <div className="at-workflow-start__composer"><AttioTextarea aria-label="Describe your workflow" placeholder="Describe your workflow…" value={prompt} disabled={pending} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void generate(); } }}/><AttioButton variant="primary" leadingIcon="arrow" aria-label="Generate workflow" disabled={!prompt.trim() || pending} onClick={() => { void generate(); }}/></div>}
    {error && <AttioNotice tone="error">{error}</AttioNotice>}
    {editable && templates.length > 0 && <div className="at-workflow-start__templates">{templates.map((template) => <AttioButton key={template.id} leadingIcon={template.icon ?? 'grid'} disabled={pending} title={template.description} onClick={() => onTemplate(template)}>{template.label}</AttioButton>)}</div>}
    <h2>{editable ? 'Start your workflow' : 'No workflow blocks'}</h2><p>{editable ? 'Choose a starting point, then connect the blocks on your canvas.' : 'This workflow has no blocks yet.'}</p>
    {editable && <AttioButton className="at-workflow-start__scratch" leadingIcon="plus" disabled={pending} onClick={onScratch}>Start from scratch</AttioButton>}
  </div></div>;
}
