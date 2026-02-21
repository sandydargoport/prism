'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutPreview } from './LayoutPreview';
import {
  getCommunityLayout,
  filterCommunityLayouts,
  type CommunityFilterOptions,
} from '@/lib/community/index';
import type { CommunityIndexEntry } from '@/lib/community/validateLayout';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface CommunityGalleryProps {
  mode: 'dashboard' | 'screensaver';
  onApplyLayout: (widgets: WidgetConfig[]) => void;
}

const SCREEN_SIZE_OPTIONS = ['15"', '24"', '27"', '32"'];

export function CommunityGallery({ mode, onApplyLayout }: CommunityGalleryProps) {
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [screenSize, setScreenSize] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<CommunityIndexEntry[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);

  const filters: CommunityFilterOptions = useMemo(() => ({
    mode,
    ...(screenSize ? { screenSize } : {}),
    ...(search ? { search } : {}),
  }), [mode, screenSize, search]);

  useEffect(() => {
    let cancelled = false;
    setLoadingIndex(true);
    filterCommunityLayouts(filters).then(result => {
      if (!cancelled) {
        setLayouts(result);
        setLoadingIndex(false);
      }
    });
    return () => { cancelled = true; };
  }, [filters]);

  const handleUseLayout = useCallback(async (entry: CommunityIndexEntry) => {
    setLoading(entry.id);
    try {
      const data = await getCommunityLayout(entry.file);
      if (data) {
        const widgets: WidgetConfig[] = data.widgets.map(w => ({
          i: w.i,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          visible: true,
        }));
        onApplyLayout(widgets);
      }
    } finally {
      setLoading(null);
    }
  }, [onApplyLayout]);

  if (loadingIndex) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Loading community layouts...
      </div>
    );
  }

  if (layouts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4 space-y-2">
        <p>No community layouts found{search ? ` matching "${search}"` : ''}.</p>
        {(search || screenSize) && (
          <button
            onClick={() => { setPendingSearch(''); setSearch(''); setScreenSize(''); }}
            className="px-3 py-1 text-xs rounded-md bg-muted hover:bg-accent border border-border transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <input
            type="text"
            value={pendingSearch}
            onChange={e => {
              setPendingSearch(e.target.value);
              if (!e.target.value) setSearch('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') setSearch(pendingSearch);
            }}
            placeholder="Search layouts... (Enter)"
            className="px-2 py-1 pr-7 text-sm bg-muted border border-border rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {pendingSearch && (
            <button
              onClick={() => { setPendingSearch(''); setSearch(''); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {SCREEN_SIZE_OPTIONS.map(size => (
            <button
              key={size}
              onClick={() => setScreenSize(prev => prev === size ? '' : size)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                screenSize === size
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Layout cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {layouts.map(entry => (
          <CommunityLayoutCard
            key={entry.id}
            entry={entry}
            isLoading={loading === entry.id}
            onUse={() => handleUseLayout(entry)}
          />
        ))}
      </div>
    </div>
  );
}

function CommunityLayoutCard({
  entry,
  isLoading,
  onUse,
}: {
  entry: CommunityIndexEntry;
  isLoading: boolean;
  onUse: () => void;
}) {
  const [widgets, setWidgets] = useState<Array<{ i: string; x: number; y: number; w: number; h: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    getCommunityLayout(entry.file).then(data => {
      if (!cancelled && data) {
        setWidgets(data.widgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h })));
      }
    });
    return () => { cancelled = true; };
  }, [entry.file]);

  return (
    <div className="bg-muted/50 rounded-lg border border-border p-2 space-y-2 hover:border-primary/50 transition-colors">
      <LayoutPreview widgets={widgets} width={160} height={100} />
      <div>
        <div className="text-sm font-medium leading-tight">{entry.name}</div>
        <div className="text-xs text-muted-foreground line-clamp-2">{entry.description}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">by {entry.author}</span>
          <span className="text-xs text-muted-foreground">{entry.widgetCount} widgets</span>
        </div>
        {entry.screenSizes.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {entry.screenSizes.map(s => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full border border-border">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onUse}
        disabled={isLoading}
        className="w-full px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Loading...' : 'Use Layout'}
      </button>
    </div>
  );
}
