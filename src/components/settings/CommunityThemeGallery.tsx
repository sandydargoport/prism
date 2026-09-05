'use client';

/**
 * Browse and install themes other people have shared.
 *
 * The counterpart to ThemeShareDialog: that one gets a theme out of an
 * instance, this one gets a theme in. Until both existed the gallery was a
 * write-only archive — a submission could be validated, reviewed and merged,
 * and still nobody could put it on a screen.
 *
 * Themes are fetched from raw.githubusercontent at browse time rather than
 * bundled, so a new theme appears without anyone updating their container. The
 * cost is that this is the one part of the palette picker that needs a network,
 * which is why installing copies the theme into the settings row: a display
 * that boots offline still renders the palette it was left on.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers';
import {
  getCommunityThemeIndex,
  getCommunityTheme,
  type CommunityThemeIndexEntry,
} from '@/lib/community/index';
import { projectCommunityTheme } from '@/lib/community/validateTheme';
import { MAX_INSTALLED_THEMES, type Theme, type ThemeTokens } from '@/lib/themes/tokens';

/** The five that read as "what colour is this theme" at swatch size. */
const SWATCH_TOKENS = ['background', 'card', 'primary', 'accent', 'destructive'] as const;

function Swatches({ tokens, label }: { tokens: ThemeTokens; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {SWATCH_TOKENS.map((tok) => (
        <span
          key={tok}
          className="h-5 w-5 rounded border border-black/10"
          style={{ backgroundColor: `hsl(${tokens[tok]})` }}
        />
      ))}
    </div>
  );
}

export function CommunityThemeGallery({ onClose }: { onClose: () => void }) {
  const { installedThemes, installTheme, uninstallTheme, palette } = useTheme();

  const [entries, setEntries] = useState<CommunityThemeIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Both modes are previewed on the card, so both token sets are needed before
  // anything can be drawn. Fetched per card rather than folded into the index:
  // the index is one request that stays small as the gallery grows, and a card
  // nobody scrolls to costs nothing.
  const [previews, setPreviews] = useState<Record<string, Theme>>({});

  useEffect(() => {
    let cancelled = false;
    getCommunityThemeIndex()
      .then((index) => {
        if (cancelled) return;
        setEntries(index.themes);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.author.toLowerCase().includes(q) ||
      e.tags.some((t) => t.includes(q)),
    );
  }, [entries, search]);

  const loadPreview = useCallback(async (entry: CommunityThemeIndexEntry) => {
    const data = await getCommunityTheme(entry.file);
    if (!data) return null;
    // The same projection the submission workflow commits through: every field
    // copied by name, so a key the schema does not know about has no path into
    // the page. The file was validated before it merged, but it is fetched over
    // the network from a URL baked into the client, and re-projecting costs
    // nothing next to trusting that.
    const p = projectCommunityTheme(data, entry.id);
    return {
      id: p.id, name: p.name, description: p.description,
      light: p.light, dark: p.dark, shape: p.shape,
    } satisfies Theme;
  }, []);

  const handleInstall = useCallback(async (entry: CommunityThemeIndexEntry) => {
    setBusy(entry.id);
    setError(null);
    try {
      const theme = previews[entry.id] ?? (await loadPreview(entry));
      if (!theme) {
        setError(`Could not download "${entry.name}". Check the connection and try again.`);
        return;
      }
      const ok = await installTheme(theme);
      if (!ok) {
        setError(
          installedThemes.length >= MAX_INSTALLED_THEMES
            ? `You have ${MAX_INSTALLED_THEMES} themes installed, which is the limit. Remove one first.`
            : `"${entry.name}" could not be installed. It may be damaged — please report it.`,
        );
      }
    } finally {
      setBusy(null);
    }
  }, [previews, loadPreview, installTheme, installedThemes.length]);

  const handleUninstall = useCallback(async (id: string, name: string) => {
    setBusy(id);
    setError(null);
    try {
      const ok = await uninstallTheme(id);
      if (!ok) setError(`"${name}" could not be removed.`);
    } finally {
      setBusy(null);
    }
  }, [uninstallTheme]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-2xl w-full mx-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">Community themes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shared by other people running Prism. Installing copies the theme
              to this house, so it keeps working offline.
            </p>
          </div>
          {!loading && entries.length > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {visible.length} of {entries.length}
            </span>
          )}
        </div>

        {entries.length > 0 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, author or tag…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading themes…</p>
        ) : entries.length === 0 ? (
          // Reached both when the gallery is genuinely empty and when the fetch
          // failed, because the index falls back to an empty list rather than
          // throwing. Worded to fit both: nothing here claims the network is
          // fine, and the suggestion is useful either way.
          <div className="space-y-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">No themes to show yet.</p>
            <p className="text-xs text-muted-foreground">
              If you have made one you like, the <strong>Share</strong> button
              next to the palettes submits it to the gallery.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing matches “{search}”.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((entry) => (
              <ThemeCard
                key={entry.id}
                entry={entry}
                preview={previews[entry.id]}
                onNeedPreview={async () => {
                  const theme = await loadPreview(entry);
                  if (theme) setPreviews((prev) => ({ ...prev, [entry.id]: theme }));
                }}
                installed={installedThemes.some((t) => t.id === entry.id)}
                active={palette.id === entry.id}
                busy={busy === entry.id}
                onInstall={() => handleInstall(entry)}
                onUninstall={() => handleUninstall(entry.id, entry.name)}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  entry, preview, onNeedPreview, installed, active, busy, onInstall, onUninstall,
}: {
  entry: CommunityThemeIndexEntry;
  preview: Theme | undefined;
  onNeedPreview: () => void;
  installed: boolean;
  active: boolean;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  useEffect(() => {
    if (!preview) onNeedPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/30 p-3">
      <div className="min-h-[3.25rem] space-y-1.5">
        {preview ? (
          <>
            <Swatches tokens={preview.light} label="Light" />
            <Swatches tokens={preview.dark} label="Dark" />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Loading colours…</p>
        )}
      </div>

      <div className="mt-2.5 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{entry.name}</span>
          {active && <span className="shrink-0 text-[10px] text-primary">In use</span>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">by {entry.author}</p>

        {entry.contrastWarnings > 0 && (
          // Stated rather than hidden behind an icon. Somebody choosing a theme
          // for a screen read from across a kitchen is exactly the person who
          // needs to know this, and the number is the whole reason the
          // submission pipeline measures contrast in the first place.
          <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            {entry.contrastWarnings === 1
              ? '1 colour pair is legible but tiring at a distance.'
              : `${entry.contrastWarnings} colour pairs are legible but tiring at a distance.`}
          </p>
        )}

        {entry.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        {installed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={onUninstall}
          >
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={busy || !preview}
            onClick={onInstall}
          >
            {busy ? 'Installing…' : 'Install and use'}
          </Button>
        )}
      </div>
    </div>
  );
}
