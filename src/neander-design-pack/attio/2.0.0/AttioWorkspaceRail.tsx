"use client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState, type CSSProperties } from 'react';
import { AttioNavItem } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';

export type AttioWorkspaceOption = { id: string; name: string; initials: string; color?: string };
export type AttioRailItem = { id: string; label: string; icon: IconName; active?: boolean; badge?: number; meta?: string; iconTone?: 'blue' | 'cyan' | 'orange' | 'purple' };
export type AttioWorkspaceRailModel = {
  workspace: AttioWorkspaceOption;
  collapsed?: boolean;
  workspaces?: AttioWorkspaceOption[];
  primary: AttioRailItem[];
  favorites?: AttioRailItem[];
  records: AttioRailItem[];
  lists?: AttioRailItem[];
  chats?: AttioRailItem[];
  trialDays?: number;
  upgradeLabel?: string;
};
export type AttioWorkspaceRailActions = {
  onNavigate: (id: string) => void;
  onSearch: () => void;
  onToggleCollapsed?: () => void;
  onInbox?: () => void;
  onSwitchWorkspace?: (id: string) => void;
  onCreateWorkspace?: () => void;
  onAccountSettings?: () => void;
  onWorkspaceSettings?: () => void;
  onInviteMembers?: () => void;
  onCreateList?: () => void;
  onCreateChat?: () => void;
  onUpgrade?: () => void;
  onSignOut?: () => void;
};

function WorkspaceMark({ workspace }: { workspace: AttioWorkspaceOption }) {
  return <span className="at-workspace-rail__mark" style={{ '--at-workspace-mark': workspace.color ?? 'var(--primary)' } as CSSProperties} aria-hidden="true">{workspace.initials.slice(0, 1).toUpperCase()}</span>;
}

function RailSection({ label, items, actions, collapsed = false }: { label: string; items?: AttioRailItem[]; actions: AttioWorkspaceRailActions; collapsed?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!items?.length) return null;
  return <section className="at-workspace-rail__section">
    <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__section-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="chevron" size={13}/><span>{label}</span></Button>
    <div className={`at-workspace-rail__section-items${open ? ' is-open' : ''}`} aria-hidden={!open}><div>{items.map((item) => <AttioNavItem key={item.id} icon={item.icon} iconTone={item.iconTone} badge={item.badge} active={item.active} title={collapsed ? item.label : undefined} onClick={() => actions.onNavigate(item.id)}>{item.label}{item.meta && <small>{item.meta}</small>}</AttioNavItem>)}</div></div>
  </section>;
}

export function AttioWorkspaceRail({ model, actions }: { model: AttioWorkspaceRailModel; actions: AttioWorkspaceRailActions }) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const chooseWorkspace = (id: string) => { actions.onSwitchWorkspace?.(id); setWorkspaceOpen(false); };
  const workspaceActions = [
    { label: 'Account settings', icon: 'people' as IconName, action: actions.onAccountSettings },
    { label: 'Workspace settings', icon: 'settings' as IconName, action: actions.onWorkspaceSettings },
    { label: 'Invite members', icon: 'plus' as IconName, action: actions.onInviteMembers },
  ].filter((item) => item.action);
  return <aside className={`at-sidebar at-workspace-rail${model.collapsed ? ' is-collapsed' : ''}`}>
    <DropdownMenu open={workspaceOpen} onOpenChange={setWorkspaceOpen}><div className="at-workspace-rail__workspace">
      {model.collapsed ? <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__workspace-trigger at-workspace-rail__workspace-trigger--collapsed" aria-label="Expand navigation" title="Expand navigation" onClick={actions.onToggleCollapsed}><WorkspaceMark workspace={model.workspace}/><strong>{model.workspace.name}</strong><span className="at-workspace-rail__expand-icon"><Icon name="panel" size={17}/></span></Button> : <div className="at-workspace-rail__workspace-row"><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" type="button" className="at-workspace-rail__workspace-trigger" aria-haspopup="menu" aria-expanded={workspaceOpen} ><WorkspaceMark workspace={model.workspace}/><strong>{model.workspace.name}</strong><Icon name="chevron" size={14}/></Button></DropdownMenuTrigger>{actions.onToggleCollapsed && <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__collapse" aria-label="Collapse navigation" title="Collapse navigation" onClick={actions.onToggleCollapsed}><Icon name="panel" size={17}/></Button>}</div>}
      <DropdownMenuContent className="at-overlay" align="start">
        {(model.workspaces?.length ? model.workspaces : [model.workspace]).map((workspace) => <DropdownMenuItem aria-current={workspace.id === model.workspace.id ? "true" : undefined} key={workspace.id} onSelect={() => chooseWorkspace(workspace.id)}><WorkspaceMark workspace={workspace}/><span>{workspace.name}</span>{workspace.id === model.workspace.id && <Icon name="check" size={14}/>}</DropdownMenuItem>)}
        {actions.onCreateWorkspace && <DropdownMenuItem role="menuitem" onSelect={() => { actions.onCreateWorkspace?.(); setWorkspaceOpen(false); }}><Icon name="plus"/><span>New workspace</span></DropdownMenuItem>}
        {!!workspaceActions.length && <div className="at-workspace-rail__menu-divider"/>}
        {workspaceActions.map((item) => <DropdownMenuItem role="menuitem" key={item.label} onSelect={() => { item.action?.(); setWorkspaceOpen(false); }}><Icon name={item.icon}/><span>{item.label}</span></DropdownMenuItem>)}
        {actions.onSignOut && <><div className="at-workspace-rail__menu-divider"/><DropdownMenuItem role="menuitem" onSelect={() => { actions.onSignOut?.(); setWorkspaceOpen(false); }}><Icon name="arrow"/><span>Sign out</span></DropdownMenuItem></>}
      </DropdownMenuContent>
    </div></DropdownMenu>
    <div className={`at-workspace-rail__search-row${actions.onInbox ? '' : ' at-workspace-rail__search-row--single'}`}><Button variant="ghost" size="sm" type="button" className="at-framework__search-trigger" onClick={actions.onSearch}><Icon name="search"/><span>Search</span><kbd>⌘</kbd><kbd>K</kbd></Button>{actions.onInbox && <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__inbox" aria-label="Inbox" onClick={actions.onInbox}><Icon name="mail"/></Button>}</div>
    <nav className="at-workspace-rail__body" aria-label="Workspace">
      <div className="at-workspace-rail__primary">{model.primary.map((item) => <AttioNavItem key={item.id} icon={item.icon} iconTone={item.iconTone} badge={item.badge} active={item.active} title={model.collapsed ? item.label : undefined} onClick={() => actions.onNavigate(item.id)}>{item.label}</AttioNavItem>)}</div>
      <RailSection label="Favorites" items={model.favorites} actions={actions} collapsed={model.collapsed}/>
      <RailSection label="Records" items={model.records} actions={actions} collapsed={model.collapsed}/>
      <RailSection label="Lists" items={model.lists} actions={actions} collapsed={model.collapsed}/>
      {actions.onCreateList && <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__create" onClick={actions.onCreateList}><Icon name="plus"/>New list</Button>}
      <RailSection label="Chats" items={model.chats} actions={actions} collapsed={model.collapsed}/>
      {actions.onCreateChat && <Button variant="ghost" size="sm" type="button" className="at-workspace-rail__create" onClick={actions.onCreateChat}><Icon name="plus"/>New chat</Button>}
    </nav>
    <div className="at-workspace-rail__footer">
      {actions.onInviteMembers && <Button variant="ghost" size="sm" type="button" onClick={actions.onInviteMembers}><Icon name="people"/><span>Invite members</span></Button>}
      {model.trialDays !== undefined && <div className="at-workspace-rail__trial"><Icon name="spark"/><span>{model.trialDays} days left on trial!</span>{actions.onUpgrade && <Button variant="ghost" size="sm" type="button" onClick={actions.onUpgrade}>{model.upgradeLabel ?? 'Keep Pro'}</Button>}</div>}
    </div>
  </aside>;
}
