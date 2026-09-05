'use client';

import { useState, useEffect } from 'react';
import { Monitor, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLayouts } from '@/lib/hooks/useLayouts';
import Link from 'next/link';

const FONT_SCALE_OPTIONS = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 150];

export function DisplaysSection() {
  const { layouts, loading } = useLayouts();
  const [saving, setSaving] = useState<string | null>(null);
  // Optimistic local scale values — keyed by layout id
  const [localScales, setLocalScales] = useState<Record<string, number>>({});

  // Initialise local scales from loaded layouts (only once per layout)
  useEffect(() => {
    if (layouts.length === 0) return;
    setLocalScales((prev) => {
      const next = { ...prev };
      for (const l of layouts) {
        if (!(l.id in next)) next[l.id] = l.fontScale ?? 100;
      }
      return next;
    });
  }, [layouts]);

  const saveTimers = useState<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateFontScale = (layoutId: string, scale: number) => {
    // Update local state immediately — slider stays responsive
    setLocalScales((prev) => ({ ...prev, [layoutId]: scale }));

    // Debounce DB write so rapid slider drags don't spam the API
    const timers = saveTimers[0];
    if (timers[layoutId]) clearTimeout(timers[layoutId]);
    timers[layoutId] = setTimeout(async () => {
      setSaving(layoutId);
      try {
        await fetch(`/api/layouts/${layoutId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fontScale: scale === 100 ? null : scale }),
        });
      } catch {
        setLocalScales((prev) => ({ ...prev, [layoutId]: layouts.find(l => l.id === layoutId)?.fontScale ?? 100 }));
      } finally {
        setSaving(null);
      }
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Text Size</h2>
        <p className="text-muted-foreground">
          How large everything reads on each of your dashboards. This scales the whole
          board at once, which is different from the per-widget text size in the layout
          editor. Most screens never need it — reach for it only if one is read from
          further away than the rest.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No dashboards yet. Create one from the dashboard toolbar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {layouts.map((layout) => {
            const scale = localScales[layout.id] ?? layout.fontScale ?? 100;
            const url = layout.slug ? `/d/${layout.slug}` : '/';
            return (
              <Card key={layout.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{layout.name}</CardTitle>
                      {layout.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <Link
                      href={url}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {layout.slug ? `/d/${layout.slug}` : '/'}
                    </Link>
                  </div>
                  {layout.slug && (
                    <CardDescription className="text-xs mt-0.5">
                      Subpages available at <code className="font-mono">/d/{layout.slug}/calendar</code>, <code className="font-mono">/tasks</code>, etc.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Collapsed by default. Reading a dashboard from across a room is a
                      real case but an uncommon one, and leaving the control open put a
                      slider in front of everyone to serve the few who need it.
                      Deliberately open when the value is not 100%: a display someone has
                      already tuned should not have that hidden, or the setting becomes
                      something you can change and then never find again. */}
                  <details open={scale !== 100} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-0.5 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                        Text size
                      </span>
                      <span className={cn(
                        'text-sm tabular-nums',
                        scale !== 100 ? 'text-primary font-medium' : 'text-muted-foreground'
                      )}>
                        {scale}%
                      </span>
                    </summary>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">A</span>
                      <div className="flex-1 relative">
                        <input
                          type="range"
                          min={75}
                          max={150}
                          step={5}
                          value={scale}
                          onChange={(e) => updateFontScale(layout.id, Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                        {/* 100% marker — sits at 33% from left on the 75–150 range */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-muted-foreground/40 pointer-events-none"
                          style={{ left: 'calc(33.3% - 1px)' }}
                          title="100% default"
                        />
                      </div>
                      <span className="text-base text-muted-foreground w-6">A</span>
                    </div>
                    {/* Quick-select labels — positioned proportionally on the 75–150 scale */}
                    <div className="relative h-5 mt-0.5">
                      {[75, 100, 125, 150].map((s) => {
                        const pct = ((s - 75) / 75) * 100;
                        return (
                          <button
                            key={s}
                            onClick={() => updateFontScale(layout.id, s)}
                            className={cn(
                              'absolute text-xs px-0.5 py-0.5 rounded transition-colors -translate-x-1/2',
                              scale === s
                                ? 'text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            style={{ left: `${pct}%` }}
                          >
                            {s}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span className="capitalize">{layout.orientation || 'landscape'}</span>
                    <span>·</span>
                    <span>{layout.widgets.length} widget{layout.widgets.length !== 1 ? 's' : ''}</span>
                    {saving === layout.id && (
                      <>
                        <span>·</span>
                        <span className="text-primary">Saving…</span>
                      </>
                    )}
                  </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Set a dedicated device to open <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/d/your-slug</code> as its home page, then set the text size here to match how far away it is read from.
            Larger text means fewer rows fit on the screen, so a dashboard read from across the room holds less than one read at the counter.
            Each named dashboard is independent — changes here don&apos;t affect other displays.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
