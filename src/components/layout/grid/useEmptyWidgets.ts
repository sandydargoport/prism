'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Which widgets in a grid are showing their empty state right now (#738).
 *
 * `reporterFor(id)` is what a cell hands its widget through
 * WidgetEmptyReportContext. It keeps one identity per id, so WidgetEmpty's
 * effect runs once per mount rather than on every render of the grid.
 */
export function useEmptyWidgets(onChange?: (emptyIds: ReadonlySet<string>) => void) {
  const [emptyIds, setEmptyIds] = useState<ReadonlySet<string>>(() => new Set());
  const reporters = useRef(new Map<string, (empty: boolean) => void>());

  const reporterFor = useCallback((id: string) => {
    let report = reporters.current.get(id);
    if (!report) {
      report = (empty: boolean) => setEmptyIds((prev) => {
        if (prev.has(id) === empty) return prev;
        const next = new Set(prev);
        if (empty) next.add(id); else next.delete(id);
        return next;
      });
      reporters.current.set(id, report);
    }
    return report;
  }, []);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => { onChangeRef.current?.(emptyIds); }, [emptyIds]);

  return { emptyIds, reporterFor };
}
