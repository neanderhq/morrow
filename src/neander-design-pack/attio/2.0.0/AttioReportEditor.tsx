"use client";
import { useEffect, useRef, useState } from 'react';
import { AttioButton, AttioField, AttioInput, AttioSelect, AttioSwitch } from './AttioBlocks';
import { AttioDataTable } from './AttioCrmBlocks';
import { AttioEditor, AttioEditorFeedback, AttioEditorSaveActions, useAttioEditorDraft, type AttioEditorResult } from './AttioEditor';
import { AttioEmpty, AttioNotice } from './AttioStates';
import { Icon } from './AttioIcon';

export type ReportConfig = { source: string; metric: string; groupBy: string; visualization: 'Bar' | 'Pie' | 'Single metric'; showLabels: boolean; stacked: boolean; segmentBy?: string; filter?: { field: string; value: string } };
export type ReportRow = { id: string; label: string; value: number; segments?: { label: string; value: number }[] };
/** Results are aggregated by the host. The renderer only draws the supplied values. */
export type ReportData = { rows: ReportRow[]; metricLabel: string; summary?: string };
export type FrameworkReport = { id: string; title: string; config: ReportConfig; data: ReportData };
const dataKey = (config: ReportConfig) => JSON.stringify([config.source, config.metric, config.groupBy, config.segmentBy, config.filter]);
export type ReportSource = { id: string; label: string; metrics: string[]; groups: string[]; segments?: string[]; filters?: string[] };

function ReportChart({ data, config }: { data: ReportData; config: ReportConfig }) {
  const colors = Array.from({ length: 6 }, (_, index) => `var(--at-chart-${index + 1})`);
  const [dataVisible, setDataVisible] = useState(false);
  const rows = data.rows;
  const legend = [...new Set(rows.flatMap((row) => row.segments?.map((segment) => segment.label) ?? []))];
  const max = Math.max(1, ...rows.map((row) => config.stacked && row.segments?.length ? row.segments.reduce((total, segment) => total + Math.max(0, segment.value), 0) : Math.max(0, row.value)));
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  let offset = 0;
  const sliceWidth = 560 / Math.max(1, rows.length);
  return <div className="at-report-preview">
    {rows.length === 0 ? <AttioEmpty icon="chart" title="No data to display" description="Update the report configuration or add records in your application."/> : config.visualization === 'Single metric' ? <div className="at-report-preview__metric"><span>{data.metricLabel}</span><strong>{data.summary ?? '—'}</strong></div> : config.visualization === 'Pie' ? <div className="at-report-preview__pie"><svg viewBox="0 0 240 240" role="img" aria-label={`${data.metricLabel} by ${config.groupBy}`}><title>{data.metricLabel} by {config.groupBy}</title><circle cx="120" cy="120" r="85" fill="none" stroke="var(--at-border)" strokeWidth="44"/>{rows.map((row, index) => { const fraction = total ? Math.max(0, row.value) / total : 0; const start = offset; offset += fraction * 100; return <circle key={row.id} cx="120" cy="120" r="85" fill="none" stroke={colors[index % colors.length]} strokeWidth="44" pathLength="100" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-start} transform="rotate(-90 120 120)"><title>{row.label}: {row.value}</title></circle>; })}</svg><div className="at-report-preview__legend">{rows.map((row, index) => <span key={row.id}><i style={{ background: colors[index % colors.length] }}/>{row.label} <strong>{row.value}</strong></span>)}</div></div> : <><div className="at-report-preview__legend">{legend.map((label, index) => <span key={label}><i style={{ background: colors[index % colors.length] }}/>{label}</span>)}</div><svg className="at-report-preview__bar" viewBox="0 0 680 390" role="img" aria-label={`${data.metricLabel} by ${config.groupBy}`}><title>{data.metricLabel} by {config.groupBy}</title>{[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1="60" x2="650" y1={320 - tick * 70} y2={320 - tick * 70} stroke="var(--at-border)" strokeDasharray="3 4"/><text x="48" y={324 - tick * 70} textAnchor="end">{(max * tick / 4).toLocaleString(undefined, { maximumFractionDigits: 1 })}</text></g>)}{rows.map((row, index) => { const x = 75 + index * sliceWidth; const width = Math.max(3, sliceWidth - 16); let height = 0; return <g key={row.id}>{config.stacked && row.segments?.length ? row.segments.map((segment) => { const barHeight = Math.max(0, segment.value) / max * 280; height += barHeight; return <rect key={segment.label} x={x} y={320 - height} width={width} height={barHeight} rx="2" fill={colors[legend.indexOf(segment.label) % colors.length]}><title>{row.label} · {segment.label}: {segment.value}</title></rect>; }) : <rect x={x} y={320 - Math.max(0, row.value) / max * 280} width={width} height={Math.max(0, row.value) / max * 280} rx="4" fill={colors[0]}><title>{row.label}: {row.value}</title></rect>}{config.showLabels && <text x={x + width / 2} y="345" textAnchor="middle">{row.label.length > 15 ? `${row.label.slice(0, 13)}…` : row.label}</text>}</g>; })}<text x="350" y="380" textAnchor="middle">{config.groupBy}</text></svg></>}
    <div className="at-report-preview__footer"><span>{data.metricLabel}</span><AttioButton variant="ghost" leadingIcon="panel" aria-expanded={dataVisible} onClick={() => setDataVisible(!dataVisible)}>{dataVisible ? 'Hide contributing data' : 'View contributing data'}</AttioButton></div>
    {dataVisible && <AttioDataTable rows={rows.map((row) => ({ id: row.id, label: row.label, value: row.value }))} selectable={false} columns={[{ key: 'label', label: config.groupBy || 'Group', width: 240 }, { key: 'value', label: data.metricLabel, width: 160 }]}/>}
  </div>;
}

export function AttioReportEditor({ report, sources, onPreview, onSave }: {
  report: FrameworkReport; sources: ReportSource[];
  onPreview?: (config: ReportConfig) => ReportData | false | Promise<ReportData | false>;
  onSave?: (report: FrameworkReport) => AttioEditorResult;
}) {
  const editor = useAttioEditorDraft(report);
  const { draft, change } = editor;
  const [preview, setPreview] = useState(report.data);
  const [previewConfig, setPreviewConfig] = useState(report.config);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setPreview(editor.baseline.data);
    setPreviewConfig(editor.baseline.config);
    setError('');
  }, [editor.baseline]);
  const source = sources.find((item) => item.id === draft.config.source);
  const busy = editor.pending || pending;
  const stale = dataKey(previewConfig) !== dataKey(draft.config);
  const configure = (patch: Partial<ReportConfig>) => { change({ ...draft, config: { ...draft.config, ...patch } }); setError(''); };
  const updatePreview = async () => {
    if (!onPreview || pendingRef.current || editor.pending) return;
    pendingRef.current = true; setPending(true); setError('');
    const config = { ...draft.config };
    try {
      const result = await onPreview(config);
      if (result === false) setError('The report preview could not be loaded. Please try again.');
      else { setPreview(result); setPreviewConfig(config); }
    } catch { setError('The report preview could not be loaded. Please try again.'); }
    finally { pendingRef.current = false; setPending(false); }
  };
  const discard = () => { editor.discard(); setPreview(editor.baseline.data); setPreviewConfig(editor.baseline.config); setError(''); };
  return <AttioEditor name="Report editor" title={<><Icon name="chart"/><AttioInput aria-label="Report name" value={draft.title} disabled={!onSave || busy} onChange={(event) => change({ ...draft, title: event.target.value })}/></>}
    actions={<AttioEditorSaveActions dirty={editor.dirty} pending={busy} onDiscard={discard} valid={!!draft.title.trim() && !stale} onSave={onSave ? () => { void editor.submit(onSave, { ...draft, data: preview }); } : undefined}/>}
    notice={<><AttioEditorFeedback error={editor.error} saved={editor.saved}/>{error && <AttioNotice tone="error">{error}</AttioNotice>}</>}
    inspectorTitle="Report settings" inspector={<div className="at-editor__fields">
      <h3>Insight</h3><AttioField label="Data source">{(id) => <AttioSelect id={id} label="Data source" value={source?.label ?? draft.config.source} options={sources.map((item) => item.label)} disabled={!onPreview || busy} onChange={(label) => { const next = sources.find((item) => item.label === label); if (next) configure({ source: next.id, metric: next.metrics[0] ?? '', groupBy: next.groups[0] ?? '', segmentBy: undefined, filter: undefined }); }}/>}</AttioField>
      <AttioField label="Metric">{(id) => <AttioSelect id={id} label="Metric" value={draft.config.metric} options={source?.metrics ?? []} disabled={!onPreview || busy} onChange={(metric) => configure({ metric })}/>}</AttioField>
      <AttioField label="Grouped by">{(id) => <AttioSelect id={id} label="Grouped by" value={draft.config.groupBy} options={source?.groups ?? []} disabled={!onPreview || busy} onChange={(groupBy) => configure({ groupBy })}/>}</AttioField>
      {source?.segments?.length ? <AttioField label="Segmented by">{(id) => <AttioSelect id={id} label="Segmented by" value={draft.config.segmentBy ?? 'None'} options={['None', ...source.segments!]} disabled={!onPreview || busy} onChange={(value) => configure({ segmentBy: value === 'None' ? undefined : value })}/>}</AttioField> : null}
      {source?.filters?.length && onPreview && !draft.config.filter ? <AttioButton leadingIcon="filter" disabled={busy} onClick={() => configure({ filter: { field: source.filters![0], value: '' } })}>Add filter</AttioButton> : null}
      {draft.config.filter && <div className="at-editor__filter"><AttioSelect label="Filter field" ariaLabel="Filter field" value={draft.config.filter.field} options={source?.filters ?? []} disabled={!onPreview || busy} onChange={(field) => configure({ filter: { field, value: draft.config.filter!.value } })}/><AttioInput aria-label="Filter value" placeholder="Contains…" value={draft.config.filter.value} disabled={!onPreview || busy} onChange={(event) => configure({ filter: { field: draft.config.filter!.field, value: event.target.value } })}/><AttioButton variant="ghost" disabled={!onPreview || busy} onClick={() => configure({ filter: undefined })}>Remove filter</AttioButton></div>}
      <h3>Visualization</h3><AttioSelect label="Visualization" ariaLabel="Visualization" value={draft.config.visualization} options={['Bar', 'Pie', 'Single metric']} disabled={!onSave || busy} onChange={(visualization) => configure({ visualization: visualization as ReportConfig['visualization'] })}/>
      {draft.config.visualization === 'Bar' && <><AttioSwitch label="Show axis labels" checked={draft.config.showLabels} disabled={!onSave || busy} onChange={(showLabels) => configure({ showLabels })}/><AttioSwitch label="Stack bars" checked={draft.config.stacked} disabled={!onSave || busy} onChange={(stacked) => configure({ stacked })}/></>}
      {onPreview && <AttioButton leadingIcon="activity" disabled={busy} onClick={() => { void updatePreview(); }}>{pending ? 'Updating…' : 'Update preview'}</AttioButton>}
    </div>}>
    <div className="at-report-canvas" aria-busy={pending}>{stale && <div className="at-editor__hint" role="status">Configuration changed. Update the preview to refresh the data.</div>}<ReportChart data={preview} config={{ ...draft.config, groupBy: previewConfig.groupBy }}/></div>
  </AttioEditor>;
}
