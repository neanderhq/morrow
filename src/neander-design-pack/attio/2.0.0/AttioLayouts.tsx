"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AttioButton } from './AttioBlocks';
import './attio-layouts.css';

/** The product owns branding, navigation, data and actions; the pack owns geometry. */
export function AttioWorkspace({ sidebar, header, children, navigationLabel = 'Navigation', navigationCollapsed = false, navigationKey }: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  navigationLabel?: string;
  navigationCollapsed?: boolean;
  navigationKey?: string;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => { setNavigationOpen(false); }, [navigationKey, navigationCollapsed]);
  return <div className={`at-workspace${navigationCollapsed ? ' is-navigation-collapsed' : ''}`}>
    <div className={`at-workspace__navigation${navigationOpen ? ' is-open' : ''}`} aria-label={navigationLabel} onClick={(event) => { if ((event.target as Element).closest('.at-nav-row')) setNavigationOpen(false); }}>
      {sidebar}
    </div>
    {navigationOpen && <Button variant="ghost" size="sm" type="button" className="at-workspace__scrim" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
    <main className="at-workspace__main">
      <div className="at-workspace__header">
        <AttioButton className="at-workspace__menu-button" variant="ghost" leadingIcon="panel" aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)} />
        {header}
      </div>
      {children}
    </main>
  </div>;
}

/** A full canvas record list with an optional details pane, never a dashboard card. */
export function AttioRecordsLayout({ toolbar, children, detail }: {
  toolbar?: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return <div className={`at-records-layout${detail ? ' at-records-layout--split' : ''}`}>
    <section className="at-records-layout__list" aria-label="Records">
      {toolbar && <div className="at-records-layout__toolbar">{toolbar}</div>}
      <div className="at-records-layout__content">{children}</div>
    </section>
    {detail && <aside className="at-records-layout__detail" aria-label="Record details">{detail}</aside>}
  </div>;
}

/* Page composition primitives. Any page, view or widget the framework has no
   ready-made screen for is built from these and the shared controls, so it
   inherits the same spacing, type scale and control geometry. */

export type AttioSpace = 1 | 2 | 3 | 4 | 5 | 6 | 8;
const spaceVar = (gap: AttioSpace) => ({ '--at-gap': `var(--at-space-${gap})` }) as CSSProperties;

/** A scrolling, padded page body with an optional title row. */
export function AttioPage({ title, description, actions, width = 'default', children }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
  children: ReactNode;
}) {
  return <div className="at-page">
    <div className={`at-page__inner at-page__inner--${width}`}>
      {(title || actions) && <header className="at-page__head">
        <div className="at-page__titles">{title && <h1>{title}</h1>}{description && <p>{description}</p>}</div>
        {actions && <div className="at-page__actions">{actions}</div>}
      </header>}
      {children}
    </div>
  </div>;
}

/** A titled group of related content inside a page. */
export function AttioSection({ title, description, actions, children }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <section className="at-section">
    {(title || actions) && <header className="at-section__head">
      <div className="at-section__titles">{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
      {actions && <div className="at-section__actions">{actions}</div>}
    </header>}
    {children}
  </section>;
}

/** A bordered surface for a single block of content. */
export function AttioCard({ children, padding = 4 }: { children: ReactNode; padding?: AttioSpace }) {
  return <Card className="at-card" style={{ '--at-card-padding': `var(--at-space-${padding})` } as CSSProperties}>{children}</Card>;
}

/** Vertical rhythm. Children keep their natural width; blocks fill the column. */
export function AttioStack({ gap = 4, children }: { gap?: AttioSpace; children: ReactNode }) {
  return <div className="at-stack" style={spaceVar(gap)}>{children}</div>;
}

/** A wrapping horizontal row, e.g. a group of buttons or badges. */
export function AttioInline({ gap = 2, align = 'center', justify = 'start', children }: {
  gap?: AttioSpace;
  align?: 'start' | 'center' | 'baseline';
  justify?: 'start' | 'between' | 'end';
  children: ReactNode;
}) {
  return <div className={`at-inline at-inline--align-${align} at-inline--justify-${justify}`} style={spaceVar(gap)}>{children}</div>;
}

/** A responsive grid that collapses to one column on narrow screens. */
export function AttioGrid({ columns = 3, min = 220, gap = 3, children }: {
  columns?: 1 | 2 | 3 | 4;
  min?: number;
  gap?: AttioSpace;
  children: ReactNode;
}) {
  return <div className="at-grid" style={{ ...spaceVar(gap), '--at-grid-columns': columns, '--at-grid-min': `${min}px` } as CSSProperties}>{children}</div>;
}

/** A single figure in the record-highlight style. */
export function AttioStat({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return <div className="at-stat"><span className="at-stat__label">{label}</span><strong className="at-stat__value">{value}</strong>{detail && <span className="at-stat__detail">{detail}</span>}</div>;
}

/** Figures in one frame divided by hairlines. Use for every metric summary. */
export function AttioStats({ children }: { children: ReactNode }) {
  return <div className="at-stats">{children}</div>;
}

export type AttioListItem = { id: string; title: ReactNode; description?: ReactNode; meta?: ReactNode; onSelect?: () => void };

/** Rows in one frame divided by hairlines, e.g. follow-ups or recent records. */
export function AttioList({ items, empty }: { items: AttioListItem[]; empty?: ReactNode }) {
  if (!items.length && empty) return <>{empty}</>;
  return <ul className="at-list">{items.map((item) => {
    const body = <><span className="at-list__text"><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</span>{item.meta && <span className="at-list__meta">{item.meta}</span>}</>;
    return <li key={item.id}>{item.onSelect ? <Button variant="ghost" size="sm" type="button" className="at-list__row" onClick={item.onSelect}>{body}</Button> : <div className="at-list__row">{body}</div>}</li>;
  })}</ul>;
}
