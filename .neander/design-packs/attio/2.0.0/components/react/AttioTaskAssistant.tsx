"use client";
import { Button } from "@/components/ui/button";
import { useState } from 'react';
import { AttioButton, AttioCheckbox, AttioTextarea } from './AttioBlocks';
import { AttioMenu, AttioNotice } from './AttioStates';
import type { FrameworkTask } from './AttioFramework';
import './attio-task-assistant.css';

/** Optional contextual panel. The host owns answers; this component never invents them. */
export type FrameworkTaskAssistant = { title: string; initialQuestion?: string; initialAnswer?: string; sourceLabel?: string; initiallyOpen?: boolean };

export function AttioTaskAssistant({ assistant, tasks, onAsk, onToggleTask, onClose }: {
  assistant: FrameworkTaskAssistant;
  tasks: FrameworkTask[];
  onAsk?: (question: string) => string | false | Promise<string | false>;
  onToggleTask?: (id: string, done: boolean) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(assistant.initialQuestion ?? '');
  const [answer, setAnswer] = useState(assistant.initialAnswer ?? '');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const ask = async () => {
    if (!draft.trim() || !onAsk || pending) return;
    const nextQuestion = draft.trim();
    setPending(true); setError('');
    try {
      const nextAnswer = await onAsk(nextQuestion);
      if (nextAnswer === false) { setError('A response is unavailable. Please try again.'); return; }
      setHistory((current) => [...current, { question: nextQuestion, answer: nextAnswer }]);
      setQuestion(nextQuestion); setAnswer(nextAnswer); setDraft('');
    } catch { setError('A response is unavailable. Please try again.'); }
    finally { setPending(false); }
  };
  const reset = () => { setQuestion(''); setAnswer(''); setDraft(''); setError(''); setHistoryOpen(false); };
  const openHistory = () => setHistoryOpen((value) => !value);
  const groups = [...new Set(tasks.filter((task) => !task.done).map((task) => task.group))];
  return <aside className="at-task-assistant" aria-label={assistant.title}>
    <div className="at-task-assistant__head"><strong>{assistant.title}</strong><div className="at-task-assistant__head-actions"><AttioButton variant="ghost" leadingIcon="star" aria-label={favorite ? 'Remove favorite' : 'Favorite conversation'} aria-pressed={favorite} onClick={() => setFavorite((value) => !value)}/><AttioButton variant="ghost" leadingIcon="plus" aria-label="New conversation" onClick={reset}/><AttioButton variant="ghost" leadingIcon="clock" aria-label="Conversation history" aria-expanded={historyOpen} onClick={openHistory}/><AttioMenu label="⋮" ariaLabel="Conversation options" align="end" triggerVariant="ghost" items={[{ id: 'clear', label: 'Clear conversation', icon: 'close', onSelect: reset }, { id: 'history', label: 'View history', icon: 'clock', onSelect: openHistory }]}/><AttioButton variant="ghost" leadingIcon="close" aria-label="Close assistant" onClick={onClose}/></div></div>
    <div className="at-task-assistant__body">
      {historyOpen ? <section className="at-task-assistant__history"><h2>Conversation history</h2>{history.length ? history.map((item, index) => <Button variant="ghost" size="sm" key={index} type="button" onClick={() => { setQuestion(item.question); setAnswer(item.answer); setHistoryOpen(false); }}>{item.question}</Button>) : <p>No earlier questions</p>}</section> : <>
        {question && <div className="at-task-assistant__question">{question}</div>}
        {answer ? <div className="at-task-assistant__answer">{assistant.sourceLabel && <span className="at-task-assistant__source">{assistant.sourceLabel}</span>}<p>{answer}</p>{groups.map((group) => <section key={group}><h2>{group}</h2>{tasks.filter((task) => !task.done && task.group === group).map((task) => <div className="at-task-assistant__card" key={task.id}><AttioCheckbox label={task.title} checked={false} disabled={!onToggleTask} onChange={(done) => onToggleTask?.(task.id, done)}/><div><span>{task.assignee || 'You'}</span><span>{task.due}</span>{task.record && <span>{task.record}</span>}</div></div>)}</section>)}</div> : <p className="at-task-assistant__empty">Ask about your tasks to see a summary here.</p>}
      </>}
    </div>
    {onAsk && <div className="at-task-assistant__composer"><AttioTextarea aria-label="Reply" placeholder="Reply…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }}/><AttioButton variant="primary" leadingIcon="arrow" aria-label="Send message" disabled={!draft.trim() || pending} onClick={() => { void ask(); }}/></div>}
    {error && <AttioNotice tone="error" onDismiss={() => setError('')}>{error}</AttioNotice>}
  </aside>;
}
