"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AttioDataTable, AttioPipelineBoard, type AttioColumn, type AttioPipelineStage } from './AttioCrmBlocks';
import { AttioEmpty, AttioError, AttioLoading } from './AttioStates';

/** The customer application owns these operations and their authorization. */
export type AttioTableSource<Row extends { id: string }> = {
  list: (signal: AbortSignal) => Promise<Row[]>;
  update: (row: Row) => Promise<Row>;
};

export function AttioConnectedTable<Row extends { id: string }>({ source, columns, emptyTitle = 'No records yet', onError }: {
  source: AttioTableSource<Row>;
  columns: AttioColumn<Row>[];
  emptyTitle?: string;
  onError?: (error: unknown) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    source.list(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) { setRows(loaded); setLoading(false); }
    }).catch((reason) => {
      if (!controller.signal.aborted) { setError(true); setLoading(false); errorHandler.current?.(reason); }
    });
    return () => controller.abort();
  }, [source, revision]);

  const saveRows = useCallback(async (nextRows: Row[]): Promise<boolean> => {
    if (savingRef.current) return false;
    const edited = nextRows.find((next) => {
      const previous = rows.find((row) => row.id === next.id);
      return previous && next !== previous;
    });
    if (!edited) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await source.update(edited);
      setRows((current) => current.map((row) => row.id === saved.id ? saved : row));
      return true;
    } catch (reason) {
      errorHandler.current?.(reason);
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }, [rows, source]);

  if (loading) return <AttioLoading label="Loading records"/>;
  if (error) return <AttioError message="Records could not load" onRetry={() => setRevision((current) => current + 1)}/>;
  if (!rows.length) return <AttioEmpty title={emptyTitle}/>;
  return <div aria-busy={saving}><AttioDataTable columns={columns} rows={rows} onRowsChange={saveRows} confirmEdits selected={selected} onSelectionChange={setSelected}/></div>;
}

export type AttioPipelineSource = {
  list: (signal: AbortSignal) => Promise<AttioPipelineStage[]>;
  move: (cardId: string, destination: string) => Promise<void>;
};

export function AttioConnectedPipeline({ source, avatar, onSettings, onError }: {
  source: AttioPipelineSource;
  avatar: (name: string) => ReactNode;
  onSettings: () => void;
  onError?: (error: unknown) => void;
}) {
  const [stages, setStages] = useState<AttioPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [moving, setMoving] = useState(false);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    source.list(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) { setStages(loaded); setLoading(false); }
    }).catch((reason) => {
      if (!controller.signal.aborted) { setError(true); setLoading(false); errorHandler.current?.(reason); }
    });
    return () => controller.abort();
  }, [source, revision]);

  const move = (cardId: string, destination: string) => {
    if (moving) return;
    const card = stages.flatMap((stage) => stage.cards).find((item) => item.id === cardId);
    if (!card) return;
    setMoving(true);
    setStages((current) => current.map((stage) => ({
      ...stage,
      cards: [...stage.cards.filter((item) => item.id !== cardId), ...(stage.name === destination ? [card] : [])],
    })));
    source.move(cardId, destination).catch((reason) => {
      errorHandler.current?.(reason);
      setRevision((current) => current + 1);
    }).finally(() => setMoving(false));
  };

  if (loading) return <AttioLoading label="Loading pipeline"/>;
  if (error) return <AttioError message="Pipeline could not load" onRetry={() => setRevision((current) => current + 1)}/>;
  if (!stages.length) return <AttioEmpty title="No stages yet"/>;
  return <div aria-busy={moving}><AttioPipelineBoard stages={stages} visible={Object.fromEntries(stages.map((stage) => [stage.name, true]))} onMove={move} onSettings={onSettings} avatar={avatar}/></div>;
}
