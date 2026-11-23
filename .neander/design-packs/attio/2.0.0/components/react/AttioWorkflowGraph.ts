import type { IconName } from './AttioIcon';

export type WorkflowPoint = { x: number; y: number };
export type WorkflowValue = string | string[];
export type WorkflowField = { key: string; label: string; type?: 'text' | 'textarea' | 'select' | 'number' | 'list'; options?: string[]; required?: boolean; defaultValue?: WorkflowValue; hint?: string };
export type WorkflowPort = { id: string; label: string };
export type WorkflowBlockType = { id: string; label: string; category: string; icon: IconName; kind?: 'trigger' | 'action'; fields?: WorkflowField[]; outputs?: WorkflowPort[] };
export type WorkflowBlock = { id: string; type: string; description: string; inputs: Record<string, WorkflowValue>; position?: WorkflowPoint };
export type WorkflowConnection = { id: string; source: string; target: string; sourcePort: string };
export type FrameworkWorkflow = { id: string; title: string; status: 'draft' | 'published'; blocks: WorkflowBlock[]; connections?: WorkflowConnection[]; settings?: Record<string, WorkflowValue>; enabled?: boolean };
export type WorkflowRun = { id: string; started: string; status: string; detail: string };
export type WorkflowIssue = { blockId?: string; field?: string; message: string };
export type WorkflowTemplate = { id: string; label: string; description?: string; icon?: IconName; blocks: WorkflowBlock[]; connections: WorkflowConnection[] };
export type WorkflowSource = { blockId: string; portId: string };
export const NODE_WIDTH = 240;
export const outputsFor = (type?: WorkflowBlockType): WorkflowPort[] => type?.outputs ?? [{ id: 'next', label: 'Next step' }];
export const positionOf = (block: WorkflowBlock, index = 0): WorkflowPoint => block.position ?? { x: 80 + index * 340, y: 160 };
export const nodeHeight = (type?: WorkflowBlockType) => Math.max(88, 64 + outputsFor(type).length * 22);
export const inputPoint = (block: WorkflowBlock): WorkflowPoint => ({ x: positionOf(block).x, y: positionOf(block).y + 44 });
export function outputPoint(block: WorkflowBlock, type: WorkflowBlockType | undefined, port: string): WorkflowPoint {
  const outputs = outputsFor(type);
  return { x: positionOf(block).x + NODE_WIDTH, y: positionOf(block).y + 44 + (outputs.findIndex((item) => item.id === port) - (outputs.length - 1) / 2) * 24 };
}

/** Legacy ordered drafts migrate once; an explicitly empty connections array stays empty. */
export function normalizeWorkflow(workflow: FrameworkWorkflow, types: WorkflowBlockType[]): FrameworkWorkflow {
  return { ...workflow, blocks: workflow.blocks.map((block, index) => ({ ...block, position: positionOf(block, index) })), connections: workflow.connections ?? workflow.blocks.slice(1).map((block, index) => ({ id: `legacy-${index}`, source: workflow.blocks[index].id, sourcePort: outputsFor(types.find((type) => type.id === workflow.blocks[index].type))[0]?.id ?? 'next', target: block.id })) };
}

export function fieldError(field: WorkflowField, value: WorkflowValue | undefined): string | undefined {
  if (field.required && (Array.isArray(value) ? value.length === 0 || value.some((item) => !item.trim()) : !value?.trim())) return `${field.label} is required.`;
  if (field.type === 'number' && typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) return `${field.label} must be a number.`;
  return undefined;
}

export function validateWorkflow(workflow: FrameworkWorkflow, types: WorkflowBlockType[]): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  if (!workflow.title.trim()) issues.push({ message: 'Give this workflow a name.' });
  if (!workflow.blocks.length) issues.push({ message: 'Add a trigger to start the workflow.' });
  const triggers = workflow.blocks.filter((block) => types.find((type) => type.id === block.type)?.kind === 'trigger');
  if (types.some((type) => type.kind === 'trigger') && workflow.blocks.length && !triggers.length) issues.push({ message: 'Add a trigger to start the workflow.' });
  workflow.blocks.forEach((block) => {
    const type = types.find((item) => item.id === block.type);
    if (!type) issues.push({ blockId: block.id, message: 'Choose an available block type.' });
    type?.fields?.forEach((field) => { const error = fieldError(field, block.inputs[field.key]); if (error) issues.push({ blockId: block.id, field: field.key, message: error }); });
  });
  const seenPorts = new Set<string>();
  workflow.connections?.forEach((edge, index, all) => {
    const key = `${edge.source}:${edge.sourcePort}`;
    if (seenPorts.has(key)) issues.push({ blockId: edge.source, message: 'An output can connect to one next block. Use separate branch outputs for multiple paths.' });
    seenPorts.add(key);
    const check = connectBlocks({ ...workflow, connections: all.slice(0, index) }, types, { blockId: edge.source, portId: edge.sourcePort }, edge.target);
    if (check.error) issues.push({ blockId: edge.source, message: check.error });
  });
  const reached = new Set(triggers.map((block) => block.id));
  if (triggers.length) {
    for (let step = 0; step < workflow.blocks.length; step++) workflow.connections?.forEach((edge) => { if (reached.has(edge.source)) reached.add(edge.target); });
    workflow.blocks.filter((block) => !reached.has(block.id)).forEach((block) => issues.push({ blockId: block.id, message: 'Connect this block to a trigger.' }));
  }
  return issues;
}

export function connectBlocks(workflow: FrameworkWorkflow, types: WorkflowBlockType[], source: WorkflowSource, target: string): { workflow?: FrameworkWorkflow; error?: string } {
  const from = workflow.blocks.find((block) => block.id === source.blockId);
  const to = workflow.blocks.find((block) => block.id === target);
  if (!from || !to) return { error: 'Choose an existing block.' };
  if (from.id === to.id) return { error: 'A block cannot connect to itself.' };
  if (types.find((type) => type.id === to.type)?.kind === 'trigger') return { error: 'A trigger is a starting point and has no incoming connection.' };
  if (!outputsFor(types.find((type) => type.id === from.type)).some((port) => port.id === source.portId)) return { error: 'Choose an available output.' };
  const connections = (workflow.connections ?? []).filter((edge) => !(edge.source === source.blockId && edge.sourcePort === source.portId));
  const reached = new Set([target]);
  for (let step = 0; step < workflow.blocks.length; step++) connections.forEach((edge) => { if (reached.has(edge.source)) reached.add(edge.target); });
  if (reached.has(source.blockId)) return { error: 'This connection would create a cycle. Choose another block.' };
  return { workflow: { ...workflow, connections: [...connections, { id: `${source.blockId}:${source.portId}`, source: source.blockId, sourcePort: source.portId, target }] } };
}

export function arrangeWorkflow(workflow: FrameworkWorkflow): FrameworkWorkflow {
  const level = new Map<string, number>();
  const incoming = new Set(workflow.connections?.map((edge) => edge.target));
  workflow.blocks.filter((block) => !incoming.has(block.id)).forEach((block) => level.set(block.id, 0));
  for (let step = 0; step < workflow.blocks.length; step++) workflow.connections?.forEach((edge) => { if (level.has(edge.source)) level.set(edge.target, Math.max(level.get(edge.target) ?? 0, (level.get(edge.source) ?? 0) + 1)); });
  const rows = new Map<number, number>();
  return { ...workflow, blocks: workflow.blocks.map((block) => { const column = level.get(block.id) ?? 0; const row = rows.get(column) ?? 0; rows.set(column, row + 1); return { ...block, position: { x: 80 + column * 340, y: 120 + row * 180 } }; }) };
}

export function removeWorkflowBlocks(workflow: FrameworkWorkflow, ids: string[]): FrameworkWorkflow {
  return { ...workflow, blocks: workflow.blocks.filter((block) => !ids.includes(block.id)), connections: workflow.connections?.filter((edge) => !ids.includes(edge.source) && !ids.includes(edge.target)) };
}
