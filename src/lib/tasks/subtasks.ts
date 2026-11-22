/**
 * Subtasks under their parent (#1200). A list keeps its order for top-level
 * tasks; each task's subtasks follow it straight after, in their own order,
 * marked so the row can indent. A subtask whose parent is not in the list (it
 * is filtered out, or in another person's group) stands on its own.
 */
export interface Nestable {
  id: string;
  parentId?: string | null;
}

export function withSubtasks<T extends Nestable>(list: readonly T[]): Array<{ task: T; nested: boolean }> {
  const ids = new Set(list.map((t) => t.id));
  const children = new Map<string, T[]>();
  for (const t of list) {
    if (t.parentId && ids.has(t.parentId)) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
  }
  const out: Array<{ task: T; nested: boolean }> = [];
  for (const t of list) {
    if (t.parentId && ids.has(t.parentId)) continue;
    out.push({ task: t, nested: false });
    for (const c of children.get(t.id) ?? []) out.push({ task: c, nested: true });
  }
  return out;
}
