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
  onApplyLayout: (widgets: WidgetConfig[], name: string) => void;
}

const SCREEN_SIZE_OPTIONS = ['1920x1080', '2560x1440', '3840x2160', '2560x1600', '2048x1536', '1366x768'];

// Checkered "open space is the wallpaper" field the preview boards float on —
// theme-agnostic neutral so it reads on both light and dark grounds.
const PHOTO_FIELD: React.CSSProperties = {
  backgroundColor: 'hsl(var(--muted) / 0.4)',
  backgroundImage:
    'linear-gradient(45deg, rgba(127,127,127,0.10) 25%, transparent 25%, transparent 50%, rgba(127,127,127,0.10) 50%, rgba(127,127,127,0.10) 75%, transparent 75%)',
  backgroundSize: '12px 12px',
};

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
        onApplyLayout(widgets, entry.name);
      }
    } finally {
      setLoading(null);
    }
  }, [onApplyLayout]);

  const hasFilters = Boolean(search || screenSize);
  const clearFilters = useCallback(() => {
    setPendingSearch(''); setSearch(''); setScreenSize('');
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Community layouts</h3>
          <p className="text-xs text-muted-foreground">
            Browse and apply {mode} layouts shared by the community.
          </p>
        </div>
        {!loadingIndex && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {layouts.length} {layouts.length === 1 ? 'layout' : 'layouts'}
          </span>
        )}
      </div>

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
            placeholder="Search layouts… (Enter)"
            className="px-2.5 py-1.5 pr-7 text-sm bg-muted/60 border border-border rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-muted"
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
        <div className="flex gap-1 flex-wrap">
          {SCREEN_SIZE_OPTIONS.map(size => (
            <button
              key={size}
              onClick={() => setScreenSize(prev => prev === size ? '' : size)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                screenSize === size
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/60 border-border text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loadingIndex ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading community layouts…
        </div>
      ) : layouts.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
          <p>No community layouts found{search ? ` matching "${search}"` : ''}.</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-xs rounded-md bg-muted hover:bg-accent border border-border transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {layouts.map(entry => (
            <CommunityLayoutCard
              key={entry.id}
              entry={entry}
              isLoading={loading === entry.id}
              onUse={() => handleUseLayout(entry)}
            />
          ))}
        </div>
      )}
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

  // Orientation from the content bbox so portrait boards don't overflow the frame:
  // feed the preview a max px on its dominant axis and let it contain-fit.
  const isPortrait = useMemo(() => {
    let maxX = 1, maxY = 1;
    for (const w of widgets) { maxX = Math.max(maxX, w.x + w.w); maxY = Math.max(maxY, w.y + w.h); }
    return maxY > maxX;
  }, [widgets]);
  const previewPx = isPortrait ? 130 : 190;

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-muted/30 p-2.5 transition-colors hover:border-primary/40">
      {/* Preview board floating on the photo field */}
      <div
        className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-lg border border-border/70"
        style={PHOTO_FIELD}
      >
        {widgets.length > 0 && (
          <LayoutPreview
            widgets={widgets}
            width={previewPx}
            height={previewPx}
            showGrid={false}
            className="!bg-transparent"
          />
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col px-0.5 pt-2">
        <div className="truncate text-[13px] font-semibold leading-tight">{entry.name}</div>
        <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-xs leading-snug text-muted-foreground">
          {entry.description}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">by {entry.author}</span>
          <span className="opacity-40">·</span>
          <span className="shrink-0 tabular-nums">{entry.widgetCount}w</span>
        </div>
        {entry.screenSizes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entry.screenSizes.map(s => (
              <span key={s} className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onUse}
        disabled={isLoading}
        className="mt-2.5 w-full rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
      >
        {isLoading ? 'Applying…' : 'Apply layout'}
      </button>
    </div>
  );
}
