"use client";
import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Icon, type IconName } from './AttioIcon';
import './attio-blocks.css';

type ButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & { variant?: 'primary' | 'secondary' | 'ghost'; leadingIcon?: IconName; trailingIcon?: IconName };
export function AttioButton({ variant = 'secondary', leadingIcon, trailingIcon, children, className = '', size, ...props }: ButtonProps) {
  const hasLabel = children !== undefined && children !== null && children !== '' && typeof children !== 'boolean';
  return <Button type="button" variant={variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost'} size={size ?? (hasLabel ? 'sm' : 'icon-sm')} className={`at-block-button at-block-button--${variant} ${className}`} {...props}>
    {leadingIcon && <Icon name={leadingIcon}/>} {hasLabel && (typeof children === "string" || typeof children === "number" ? <span>{children}</span> : children)} {trailingIcon && <Icon name={trailingIcon}/>}
  </Button>;
}
export function AttioInput({ className = '', ...props }: ComponentProps<typeof Input>) { return <Input className={`at-block-input ${className}`} {...props}/>; }
export function AttioTextarea({ className = '', ...props }: ComponentProps<typeof Textarea>) { return <Textarea className={`at-block-textarea ${className}`} {...props}/>; }
export function AttioSearch({ className = '', ...props }: ComponentProps<typeof Input>) { return <div className={`at-block-search ${className}`}><Icon name="search"/><AttioInput type="search" {...props}/></div>; }
export function AttioField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, descriptionId?: string) => ReactNode }) {
  const id = useId(), descriptionId = hint || error ? `${id}-description` : undefined;
  return <Field className="at-block-field" data-invalid={!!error}><FieldLabel htmlFor={id}>{label}</FieldLabel>{children(id, descriptionId)}{error ? <FieldError id={descriptionId}>{error}</FieldError> : hint && <FieldDescription id={descriptionId}>{hint}</FieldDescription>}</Field>;
}
export function AttioBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <Badge variant={tone === 'red' ? 'destructive' : 'secondary'} className={`at-pill at-pill--${tone}`}>{children}</Badge>; }
export function AttioSidebar({ header, search, footer, children }: { header: ReactNode; search?: ReactNode; footer?: ReactNode; children: ReactNode }) { return <aside className="at-sidebar"><div className="at-sidebar-head">{header}</div>{search}{children}{footer}</aside>; }
export function AttioNavItem({ icon, children, active = false, inset = false, badge, iconTone, onClick, title }: { icon: IconName; children: ReactNode; active?: boolean; inset?: boolean; badge?: ReactNode; iconTone?: 'blue' | 'cyan' | 'orange' | 'purple'; onClick?: () => void; title?: string }) {
  const className = `at-nav-row${active ? ' is-active' : ''}${inset ? ' is-inset' : ''}`;
  const content = <>{iconTone ? <span className={`at-nav-row__object-icon at-nav-row__object-icon--${iconTone}`} aria-hidden="true"><Icon name={icon}/></span> : <Icon name={icon}/>}<span className="at-nav-row__label">{children}</span>{badge !== undefined && <AttioBadge>{badge}</AttioBadge>}</>;
  return onClick ? <Button variant="ghost" size="sm" aria-current={active ? 'page' : undefined} aria-label={title} title={title} className={className} onClick={onClick}>{content}</Button> : <div className={className} title={title}>{content}</div>;
}
export function AttioHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) { return <header className="at-main-head at-block-header"><strong>{children}</strong>{actions && <div className="at-block-header__actions">{actions}</div>}</header>; }
export function AttioTabs({ tabs, active, onChange, ariaLabel = 'Sections' }: { tabs: { id: string; label: string; icon?: IconName; count?: number }[]; active: string; onChange: (id: string) => void; ariaLabel?: string }) {
  return <Tabs value={active} onValueChange={onChange}><TabsList className="at-tabs at-block-tabs" aria-label={ariaLabel}>{tabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.icon && <Icon name={tab.icon}/>} {tab.label} {tab.count !== undefined && <AttioBadge>{tab.count}</AttioBadge>}</TabsTrigger>)}</TabsList></Tabs>;
}
export function AttioSelect({ id, label, ariaLabel, options, icon, className = '', disabled = false, value: controlledValue, onChange }: { id?: string; label: string; ariaLabel?: string; options: string[]; icon?: IconName; className?: string; disabled?: boolean; value?: string; onChange?: (value: string) => void }) {
  const [internal, setInternal] = useState(label);
  return <Select value={controlledValue ?? internal} disabled={disabled} onValueChange={value => { setInternal(value); onChange?.(value); }}><SelectTrigger id={id} aria-label={ariaLabel ?? (id ? undefined : label)} className={`at-block-select__trigger ${className}`}>{icon && <Icon name={icon}/>}<SelectValue placeholder={label}/></SelectTrigger><SelectContent className="at-overlay">{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
}
export function AttioModal({ open, onClose, title, children, footer, size = 'default' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'default' | 'wide' }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent ref={contentRef} aria-describedby={undefined} showCloseButton={false} className={`at-overlay at-foundation-dialog ${size === 'wide' ? 'sm:max-w-3xl' : ''}`}
    onOpenAutoFocus={event => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; const first = contentRef.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), [role="combobox"]'); if(first) { event.preventDefault();first.focus(); } }}
    onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
    <DialogHeader className="at-block-modal__head"><DialogTitle>{title}</DialogTitle><AttioButton variant="ghost" leadingIcon="close" aria-label="Close dialog" onClick={onClose}/></DialogHeader>
    <div className="at-block-modal__body">{children}</div>{footer && <div className="at-block-modal__footer">{footer}</div>}
  </DialogContent></Dialog>;
}
export function AttioFormGrid({ children }: { children: ReactNode }) { return <div className="at-block-form-grid">{children}</div>; }
export function AttioCheckbox({ label, ariaLabel, defaultChecked = false, checked, onChange, disabled = false }: { label: string; ariaLabel?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId();return <label htmlFor={id} className="at-block-check"><Checkbox id={id} aria-label={ariaLabel} defaultChecked={defaultChecked} checked={checked} onCheckedChange={value => onChange?.(value === true)} disabled={disabled}/><span>{label}</span></label>;
}
export function AttioRadioGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id=useId();return <RadioGroup aria-label={label} value={value} onValueChange={onChange}>{options.map((option,index) => <label key={option} htmlFor={`${id}-${index}`} className="at-block-check"><RadioGroupItem id={`${id}-${index}`} value={option}/>{option}</label>)}</RadioGroup>;
}
export function AttioSwitch({ label, ariaLabel, defaultChecked = false, checked, onChange, disabled = false }: { label: string; ariaLabel?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  const id=useId();return <label htmlFor={id} className="at-block-switch"><span>{label}</span><Switch id={id} aria-label={ariaLabel} defaultChecked={defaultChecked} checked={checked} onCheckedChange={onChange} disabled={disabled}/></label>;
}
export function AttioTable({ headers, rows }: { headers: ReactNode[]; rows: { key: string; cells: ReactNode[] }[] }) { return <Table className="at-table"><TableHeader><TableRow>{headers.map((header,index) => <TableHead key={index}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.key}>{row.cells.map((cell,index) => <TableCell key={index}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>; }
