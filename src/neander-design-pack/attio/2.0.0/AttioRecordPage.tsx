"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from 'react';
import { AttioBadge, AttioButton } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';
import { AttioEmpty } from './AttioStates';
import './attio-record-page.css';

/** Metadata and highlights hold one compact value each; rich content belongs in a section or tab. */
export type AttioScalar = string | number | null | undefined;
export type AttioRecordProperty = { label: string; icon: IconName; value: AttioScalar; href?: string };
export type AttioRecordHighlight = { label: string; icon: IconName; value: AttioScalar; detail?: string };
export type AttioRecordEvent = { id: string; actor: string; action: ReactNode; time: string; system?: boolean };
export type AttioRecordCustomAction = { id: string; label: string; icon?: IconName; tone?: 'default' | 'danger' };
/** Built-in tabs render framework layouts; any other id renders its own content or empty state. */
export type AttioRecordTab = { id: 'metadata' | 'overview' | 'activity' | (string & {}); label: string; icon: IconName; count?: number; content?: ReactNode; empty?: { title: string; description?: string } };
/** Full-width Overview block for rich, customer-owned content such as a score breakdown. */
export type AttioRecordSection = { id: string; title: string; count?: number; action?: AttioRecordCustomAction; content: ReactNode };
/** Header controls the framework can render. None appear unless the app lists them. */
export type AttioRecordBuiltInAction = 'edit' | 'favorite' | 'compose-email' | 'add-to-list' | 'create-note' | 'copy-link' | 'create-task' | 'view-values';
export type AttioRecordAction = AttioRecordBuiltInAction | 'view-activity' | `custom:${string}`;

export const ATTIO_DEFAULT_RECORD_TABS: AttioRecordTab[] = [
  { id: 'metadata', label: 'Metadata', icon: 'company' },
];

const ICON_ACTIONS: { id: AttioRecordBuiltInAction; label: string; icon: IconName }[] = [
  { id: 'add-to-list', label: 'Add record to list', icon: 'company' },
  { id: 'create-note', label: 'Create note', icon: 'note' },
  { id: 'copy-link', label: 'Copy record link', icon: 'link' },
  { id: 'create-task', label: 'Create task', icon: 'task' },
];

function isScalar(value: unknown): value is AttioScalar {
  return value === null || value === undefined || typeof value === 'string' || typeof value === 'number';
}

function ScalarValue({ value, href, label }: { value: unknown; href?: string; label: string }) {
  if (!isScalar(value)) {
    console.error(`[attio] Metadata "${label}" must be a string or number. Move rich content to a record section.`);
    return <span className="at-record-page__property-muted">Unsupported value</span>;
  }
  if (value === null || value === undefined || value === '') return <span className="at-record-page__property-muted">Not set</span>;
  return href ? <a href={href}>{value}</a> : <>{value}</>;
}

export function AttioRecordPage({
  name,
  icon,
  properties,
  highlights = [],
  events = [],
  tabs = ATTIO_DEFAULT_RECORD_TABS,
  actions = [],
  isFavorite = false,
  primaryAction,
  secondaryActions = [],
  sections = [],
  activityEmpty = { title: 'No activity yet', description: 'Activity for this record will appear here.' },
  onAction,
}: {
  name: string;
  icon: IconName;
  properties: AttioRecordProperty[];
  highlights?: AttioRecordHighlight[];
  events?: AttioRecordEvent[];
  tabs?: AttioRecordTab[];
  actions?: AttioRecordBuiltInAction[];
  isFavorite?: boolean;
  primaryAction?: AttioRecordCustomAction;
  secondaryActions?: AttioRecordCustomAction[];
  sections?: AttioRecordSection[];
  activityEmpty?: { title: string; description?: string };
  onAction?: (action: AttioRecordAction) => void;
}) {
  const [tab, setTab] = useState(tabs[0]?.id ?? 'metadata');
  useEffect(() => { if (!tabs.some((item) => item.id === tab)) setTab(tabs[0]?.id ?? 'metadata'); }, [tabs, tab]);

  // A control exists only when the app both declares it and can handle it.
  const enabled = new Set(onAction ? actions : []);
  const custom = onAction ? secondaryActions : [];
  const primary = onAction ? primaryAction : undefined;
  const iconActions = ICON_ACTIONS.filter((item) => enabled.has(item.id));
  const hasActionRow = enabled.has('compose-email') || !!primary || custom.length > 0 || iconActions.length > 0;
  const run = (action: AttioRecordAction) => onAction?.(action);
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  const activityCard = events.length
    ? <div className="at-record-page__activity-card">{events.map((event) => <div key={event.id}><span className={event.system ? 'is-system' : ''}>{event.system ? <Icon name="settings" size={12}/> : event.actor[0]}</span><div><strong>{event.actor}</strong> {event.action}</div><time>{event.time}</time></div>)}</div>
    : <AttioEmpty title={activityEmpty.title} description={activityEmpty.description}/>;

  let body: ReactNode;
  if (active?.id === 'metadata') {
    body = <div className="at-record-page__metadata">
      <section className="at-record-page__details"><dl>{properties.map((property) => <div key={property.label}><dt><Icon name={property.icon} size={14}/>{property.label}</dt><dd><ScalarValue value={property.value} href={property.href} label={property.label}/></dd></div>)}</dl>{enabled.has('view-values') && <Button variant="ghost" size="sm" type="button" className="at-record-page__view-values" onClick={() => run('view-values')}>View all values</Button>}</section>
      {enabled.has('add-to-list') && <section className="at-record-page__lists"><div><h2>Lists</h2><Button variant="ghost" size="sm" type="button" onClick={() => run('add-to-list')}>Add to list</Button></div><p>This record has not been added to any lists</p></section>}
    </div>;
  } else if (active?.id === 'overview') {
    body = <div className="at-record-page__overview">
      {highlights.length > 0 && <section className="at-record-page__highlights"><h2>Highlights</h2><div>{highlights.map((item) => <article key={item.label}><header><span>{item.label}</span><Icon name={item.icon} size={14}/></header><strong><ScalarValue value={item.value} label={item.label}/></strong>{item.detail && <small>{item.detail}</small>}</article>)}</div></section>}
      {sections.map((section) => <RecordSection key={section.id} title={section.title} count={section.count} action={section.action && onAction ? { label: section.action.label, onClick: () => run(`custom:${section.action!.id}`) } : undefined}><div className="at-record-page__section-body">{section.content}</div></RecordSection>)}
      {tabs.some((item) => item.id === 'activity') && <RecordSection title="Activity" count={events.length} action={events.length ? { label: 'View all', onClick: () => { setTab('activity'); run('view-activity'); } } : undefined}>{activityCard}</RecordSection>}
    </div>;
  } else if (active?.id === 'activity') {
    body = <div className="at-record-page__overview">{activityCard}</div>;
  } else if (active) {
    body = active.content ? <div className="at-record-page__overview">{active.content}</div> : <AttioEmpty title={active.empty?.title ?? `No ${active.label.toLowerCase()} yet`} description={active.empty?.description}/>;
  }

  return <section className="at-record-page" aria-label="Record details">
    <header className="at-record-page__properties">
      <div className="at-record-page__identity">
        <span className="at-record-page__object-mark"><Icon name={icon} size={15}/></span>
        <strong title={name}>{name}</strong>
        <span className="at-spacer"/>
        {enabled.has('edit') && <AttioButton variant="ghost" className="at-record-page__icon-button" leadingIcon="note" aria-label="Edit record" onClick={() => run('edit')}>Edit record</AttioButton>}
        {enabled.has('favorite') && <AttioButton variant="ghost" className={`at-record-page__icon-button${isFavorite ? ' is-active' : ''}`} leadingIcon="star" aria-label={isFavorite ? 'Remove record from favorites' : 'Favorite record'} aria-pressed={isFavorite} onClick={() => run('favorite')}>Favorite record</AttioButton>}
      </div>
      {hasActionRow && <div className="at-record-page__actions">
        {enabled.has('compose-email') ? <AttioButton className="at-record-page__compose" leadingIcon="mail" onClick={() => run('compose-email')}>Compose email</AttioButton> : <span className="at-spacer"/>}
        {custom.map((action) => <AttioButton key={action.id} className={action.tone === 'danger' ? 'at-record-page__danger' : undefined} leadingIcon={action.icon} onClick={() => run(`custom:${action.id}`)}>{action.label}</AttioButton>)}
        {primary && <AttioButton variant="primary" leadingIcon={primary.icon ?? 'plus'} onClick={() => run(`custom:${primary.id}`)}>{primary.label}</AttioButton>}
        {iconActions.map((item) => <AttioButton key={item.id} className="at-record-page__square" leadingIcon={item.icon} aria-label={item.label} title={item.label} onClick={() => run(item.id)}>{item.label}</AttioButton>)}
      </div>}
    </header>

    <section className="at-record-page__workspace">
      {tabs.length > 1 && <nav className="at-record-page__tabs" aria-label="Record sections">{tabs.map((item) => <Button variant="ghost" size="sm" key={item.id} type="button" className={active?.id === item.id ? 'is-active' : ''} aria-current={active?.id === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><Icon name={item.icon} size={14}/><span>{item.label}</span>{item.count !== undefined && <AttioBadge>{item.count}</AttioBadge>}</Button>)}</nav>}
      {body}
    </section>
  </section>;
}

function RecordSection({ title, count, action, children }: { title: string; count?: number; action?: { label: string; onClick: () => void }; children?: ReactNode }) {
  return <section className="at-record-page__section"><header><h2>{title}</h2>{count !== undefined && <AttioBadge>{count}</AttioBadge>}<span className="at-spacer"/>{action && <Button variant="ghost" size="sm" type="button" onClick={action.onClick}>{action.label}</Button>}</header>{children}</section>;
}
