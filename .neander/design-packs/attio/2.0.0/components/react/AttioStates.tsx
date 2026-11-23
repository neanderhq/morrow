"use client";
import { useId, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AttioButton, AttioInput, AttioSelect } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';
import './attio-states.css';

export type AttioMenuItem = { id: string; label: string; icon?: IconName; danger?: boolean; disabled?: boolean; onSelect: () => void };
export function AttioMenu({ label, items, open: controlledOpen, onOpenChange, className = '', triggerClassName = '', triggerVariant = 'secondary', ariaLabel, align = 'start' }: {
  label: ReactNode; items: AttioMenuItem[]; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; triggerClassName?: string; triggerVariant?: 'secondary' | 'ghost'; ariaLabel?: string; align?: 'start' | 'end';
}) {
  const [internalOpen,setInternalOpen]=useState(false);
  return <DropdownMenu open={controlledOpen ?? internalOpen} onOpenChange={value => { setInternalOpen(value);onOpenChange?.(value); }}><span className={`at-menu ${className}`}><DropdownMenuTrigger asChild><AttioButton variant={triggerVariant} className={triggerClassName} aria-label={ariaLabel}>{label}</AttioButton></DropdownMenuTrigger></span><DropdownMenuContent className="at-overlay" align={align}>{items.map(item => <DropdownMenuItem key={item.id} disabled={item.disabled} variant={item.danger ? 'destructive' : 'default'} onSelect={item.onSelect}>{item.icon && <Icon name={item.icon}/>}<span>{item.label}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
export function AttioTooltip({ text, children }: { text:string; children:ReactNode }) { return <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="at-tooltip" tabIndex={0}>{children}</span></TooltipTrigger><TooltipContent>{text}</TooltipContent></Tooltip></TooltipProvider>; }
export function AttioNotice({tone='info',children,onDismiss}: {tone?:'info'|'success'|'error';children:ReactNode;onDismiss?:()=>void}) { return <Alert variant={tone === 'error' ? 'destructive' : 'default'} role={tone === 'error' ? 'alert' : 'status'} className="at-notice"><Icon name={tone === 'error' ? 'close' : 'check'}/><AlertDescription>{children}</AlertDescription>{onDismiss && <AttioButton variant="ghost" leadingIcon="close" aria-label="Dismiss notice" onClick={onDismiss}/>}</Alert>; }

export function AttioDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <label className="at-special-field" htmlFor={id}><span>{label}</span><AttioInput id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)}/></label>;
}
export function AttioCurrencyField({ label, value, onChange, currency = 'USD' }: { label: string; value: number; onChange: (value: number) => void; currency?: string }) {
  const id = useId();
  return <label className="at-special-field" htmlFor={id}><span>{label}</span><span className="at-currency-input"><span>{currency}</span><AttioInput id={id} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))}/></span></label>;
}
export function AttioRelationField({label,options,selected,onChange}: {label:string;options:string[];selected:string[];onChange:(value:string[])=>void}) { return <fieldset className="at-relation-field"><legend>{label}</legend><div className="at-relation-field__chips">{selected.map(name => <AttioButton key={name} aria-label={`Remove ${name}`} onClick={() => onChange(selected.filter(value => value !== name))}>{name} ×</AttioButton>)}</div><AttioSelect label={`Add ${label}`} value="" options={options.filter(option => !selected.includes(option))} onChange={value => onChange([...selected,value])}/></fieldset>; }
export function AttioLoading({ label = 'Loading records' }: { label?: string }) { return <div className="at-state" role="status"><Skeleton className="h-4 w-24" aria-hidden="true"/>{label}</div>; }
export function AttioEmpty({ title, description, action, secondaryAction, variant = 'compact', icon = 'grid' }: {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  variant?: 'compact' | 'records';
  icon?: IconName;
}) {
  return <div className={`at-state at-state--${variant}`}>
    {variant === 'records' ? <div className="at-state__record-illustration" aria-hidden="true"><span><Icon name={icon} size={23}/><i/><i/></span></div> : <Icon name={icon} size={26}/>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {(secondaryAction || action) && <div className="at-state__actions">{secondaryAction}{action}</div>}
  </div>;
}
export function AttioError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="at-state at-state--error" role="alert"><Icon name="close" size={26}/><strong>{message}</strong>{onRetry && <AttioButton onClick={onRetry}>Try again</AttioButton>}</div>; }
