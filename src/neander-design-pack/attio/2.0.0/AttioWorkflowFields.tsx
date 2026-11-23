"use client";
import { AttioButton, AttioField, AttioInput, AttioSelect, AttioTextarea } from './AttioBlocks';
import { fieldError, type WorkflowField, type WorkflowValue } from './AttioWorkflowGraph';

export function AttioWorkflowFields({ fields, values, disabled, showErrors, onChange }: { fields: WorkflowField[]; values: Record<string, WorkflowValue>; disabled: boolean; showErrors: boolean; onChange: (values: Record<string, WorkflowValue>) => void }) {
  return <>{fields.map((field) => {
    const value = values[field.key] ?? (field.type === 'list' ? [] : '');
    const text = typeof value === 'string' ? value : '';
    const error = showErrors ? fieldError(field, value) : undefined;
    const update = (next: WorkflowValue) => onChange({ ...values, [field.key]: next });
    return <AttioField key={field.key} label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint} error={error}>{(id, descriptionId) => field.type === 'list' ? <div className="at-workflow-fields__list">{(Array.isArray(value) ? value : [value]).map((item, index, items) => <div key={index}><AttioInput id={index === 0 ? id : undefined} aria-label={`${field.label} ${index + 1}`} value={item} aria-invalid={!!error} aria-describedby={descriptionId} disabled={disabled} onChange={(event) => update(items.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry))}/><AttioButton variant="ghost" leadingIcon="close" aria-label={`Remove ${field.label.toLowerCase()} ${index + 1}`} disabled={disabled} onClick={() => update(items.filter((_, itemIndex) => itemIndex !== index))}/></div>)}<AttioButton leadingIcon="plus" disabled={disabled} onClick={() => update([...(Array.isArray(value) ? value : [value]), ''])}>Add {field.label.toLowerCase()}</AttioButton></div> : field.type === 'select' ? <AttioSelect id={id} label={field.label} value={text || `Select ${field.label.toLowerCase()}`} options={field.options ?? []} disabled={disabled} onChange={update}/> : field.type === 'textarea' ? <AttioTextarea id={id} value={text} aria-invalid={!!error} aria-describedby={descriptionId} disabled={disabled} onChange={(event) => update(event.target.value)}/> : <AttioInput id={id} type={field.type === 'number' ? 'number' : 'text'} value={text} aria-invalid={!!error} aria-describedby={descriptionId} disabled={disabled} onChange={(event) => update(event.target.value)}/>}</AttioField>;
  })}</>;
}
