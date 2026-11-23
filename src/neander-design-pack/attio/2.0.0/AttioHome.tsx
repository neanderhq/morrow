"use client";
import { useState } from 'react';
import { AttioButton, AttioCheckbox, AttioTextarea } from './AttioBlocks';
import { AttioMenu, AttioNotice } from './AttioStates';
import { AttioPage, AttioSection } from './AttioLayouts';
import { Icon } from './AttioIcon';
import type { ConfirmedFlowResult, FrameworkTask } from './AttioFramework';
import './attio-home.css';

/** Each home widget is opt-in. A customer app supplies its data and real actions. */
export type FrameworkHome = {
  greeting: string;
  workflow?: { placeholder?: string };
  meetings?: { title?: string; emptyTitle: string; emptyDescription?: string; connections?: { id: string; label: string }[]; connectedLabel?: string };
  tasks?: { title?: string; limit?: number };
};

export function AttioHome({ home, tasks = [], onWorkflow, onConnect, onToggleTask, onViewTasks, onNewTask }: {
  home: FrameworkHome;
  tasks?: FrameworkTask[];
  onWorkflow?: (prompt: string) => ConfirmedFlowResult;
  onConnect?: (id: string) => ConfirmedFlowResult;
  onToggleTask?: (id: string, done: boolean) => void;
  onViewTasks?: () => void;
  onNewTask?: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const dayLabel = `${dayOffset === 0 ? 'Today, ' : ''}${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const submitWorkflow = async () => {
    if (!prompt.trim() || !onWorkflow || pending) return;
    setPending(true); setMessage('');
    try {
      if (await onWorkflow(prompt.trim()) === true) { setPrompt(''); setMessage('Workflow request saved'); }
      else setMessage('The workflow request could not be saved.');
    } catch { setMessage('The workflow request could not be saved.'); }
    finally { setPending(false); }
  };
  const connect = async (id: string) => {
    if (!onConnect || pending) return;
    setPending(true); setMessage('');
    try { if (await onConnect(id) !== true) setMessage('The account could not be connected.'); }
    catch { setMessage('The account could not be connected.'); }
    finally { setPending(false); }
  };
  return <AttioPage width="wide"><div className="at-home">
    <h1>{home.greeting}</h1>
    {home.workflow && onWorkflow && <div className="at-home__composer"><AttioTextarea aria-label="Create a new workflow" placeholder={home.workflow.placeholder ?? 'Create a new workflow…'} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void submitWorkflow(); } }}/><div className="at-home__composer-actions"><AttioButton variant="primary" leadingIcon="arrow" aria-label="Create workflow" disabled={!prompt.trim() || pending} onClick={() => { void submitWorkflow(); }}/></div></div>}
    {message && <AttioNotice tone={message.includes('could not') ? 'error' : 'success'} onDismiss={() => setMessage('')}>{message}</AttioNotice>}
    {home.meetings && <AttioSection title={home.meetings.title ?? 'Meetings'} actions={<div className="at-home__meeting-controls"><span>{dayLabel}</span><AttioButton variant="ghost" leadingIcon="chevron" aria-label="Previous day" onClick={() => setDayOffset((value) => value - 1)}/><AttioButton variant="ghost" leadingIcon="chevron" aria-label="Next day" onClick={() => setDayOffset((value) => value + 1)}/><AttioMenu label={<Icon name="more" size={16}/>} ariaLabel="Meeting options" triggerVariant="ghost" align="end" items={[{ id: 'today', label: 'Go to today', icon: 'clock', onSelect: () => setDayOffset(0) }]}/></div>}><div className="at-home__meeting-empty"><strong>{home.meetings.connectedLabel ?? home.meetings.emptyTitle}</strong>{!home.meetings.connectedLabel && home.meetings.emptyDescription && <span>{home.meetings.emptyDescription}</span>}{!home.meetings.connectedLabel && onConnect && home.meetings.connections && <div className="at-home__connections">{home.meetings.connections.map((connection) => <AttioButton key={connection.id} disabled={pending} onClick={() => { void connect(connection.id); }}>{connection.label}</AttioButton>)}</div>}</div></AttioSection>}
    {home.tasks && <AttioSection title={`${home.tasks.title ?? 'Tasks'} ${tasks.filter((task) => !task.done).length}`} actions={<><AttioButton variant="ghost" onClick={onViewTasks} disabled={!onViewTasks}>View all</AttioButton>{onNewTask && <AttioButton variant="ghost" leadingIcon="plus" aria-label="New task" onClick={onNewTask}/>}</>}><div className="at-home__tasks">{tasks.filter((task) => !task.done).slice(0, home.tasks.limit ?? 5).map((task) => <div className="at-home__task" key={task.id}><AttioCheckbox label={task.title} checked={!!task.done} disabled={!onToggleTask} onChange={(done) => onToggleTask?.(task.id, done)}/><span className={task.due.toLowerCase().includes('ago') || task.due.toLowerCase().includes('overdue') ? 'is-overdue' : ''}>{task.due}</span></div>)}{tasks.every((task) => task.done) && <p className="at-home__empty-tasks">No open tasks</p>}</div></AttioSection>}
  </div></AttioPage>;
}
