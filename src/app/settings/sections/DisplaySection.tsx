'use client';

import { PHOTO_DATE_SETTING, PHOTO_ON_THIS_DAY_SETTING, PHOTO_PLACE_SETTING } from '@/lib/photos/caption';
import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor, Share2, Store, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useAppLocale, APP_LOCALES } from '@/components/providers/LocaleProvider';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { ThemeShareDialog } from '@/components/settings/ThemeShareDialog';
import { CommunityThemeGallery } from '@/components/settings/CommunityThemeGallery';
import { ThemeImportButton } from '@/components/settings/ThemeImportButton';
import { useWallpaperSettings, useAutoOrientationSetting } from '@/components/layout/WallpaperBackground';
import { useAwayModeTimeout } from '@/lib/hooks/useAwayModeTimeout';
import { AWAY_AUTO_OPTIONS } from '@/lib/awayMode/autoAfter';
import { AURORA_SETTING } from '@/lib/integrations/aurora';

function getCurrentMonthNum(): number {
  return new Date().getMonth() + 1;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/**
 * A rarely changed setting, folded to one line with its current value (#1017);
 * a tap opens it. Native <details>, so it works with the keyboard and reader.
 */
function FoldCard({ id, title, value, children }: { id: string; title: string; value: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border bg-card text-card-foreground" data-fold={id}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-6 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">{title}</span>
        <span className="ml-auto text-sm text-muted-foreground" data-fold-value>{value}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">{children}</div>
    </details>
  );
}

export function DisplaySection() {
  const { theme, setTheme, resolvedTheme, palette: activePalette, palettes, setPalette, installedThemes } = useTheme();
  const { seasonalTheme, setSeasonalTheme, palette } = useSeasonalTheme();
  const [sharing, setSharing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  // The palette in use as one row; the full set only when changing it (#1017).
  const [choosing, setChoosing] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const mode: 'auto' | 'manual' | 'off' =
    seasonalTheme === 'none' ? 'off' :
    seasonalTheme === 'auto' ? 'auto' : 'manual';

  const setMode = (m: 'auto' | 'manual' | 'off') => {
    if (m === 'off') setSeasonalTheme('none');
    else if (m === 'auto') setSeasonalTheme('auto');
    else setSeasonalTheme(getCurrentMonthNum());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Appearance</h2>
        <p className="text-muted-foreground">
          Customize how the dashboard looks and behaves
        </p>
      </div>

      <SectionDivider label="Look" />
      <div data-appearance-group="look" className="flex flex-col gap-4">

      {/* Seasonal Theme sits beside Color Scheme rather than below it. */}
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">

      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>
            Choose your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
              className="flex-1"
            >
              <Monitor className="h-4 w-4 mr-2" />
              System
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-48 flex-1">
                <h4 className="text-sm font-medium">Palette</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Applies to every screen in the house. Light and dark above stay
                  per-screen.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setBrowsing(true)}>
                  <Store className="h-4 w-4 mr-1" />
                  Browse
                </Button>
                <ThemeImportButton onErrors={setImportErrors} />
                {/* Shares the palette in use, so what you submit is what you are
                    looking at. */}
                <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
            {importErrors.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
                {importErrors.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}
            {(() => {
              const preview = resolvedTheme === 'dark' ? activePalette.dark : activePalette.light;
              return (
                <div className="flex min-h-[56px] items-center gap-3 rounded-lg border border-border px-3" data-palette-current>
                  <div className="flex gap-1.5">
                    {(['background', 'card', 'primary', 'accent', 'destructive'] as const).map((tok) => (
                      <span key={tok} className="h-6 w-6 rounded border border-black/10" style={{ backgroundColor: `hsl(${preview[tok]})` }} />
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{activePalette.name}</span>
                  <Button variant="outline" size="sm" onClick={() => setChoosing(!choosing)} aria-expanded={choosing} data-palette-change>
                    {choosing ? 'Done' : 'Change'}
                  </Button>
                </div>
              );
            })()}
            {choosing && <div className="grid grid-cols-2 gap-3" data-palette-grid>
              {palettes.map((p) => {
                const preview = resolvedTheme === 'dark' ? p.dark : p.light;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPalette(p.id)}
                    aria-pressed={activePalette.id === p.id}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      activePalette.id === p.id
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {/* Swatches read from the palette being offered, not from
                        the active one, so each card previews itself. */}
                    <div className="flex gap-1.5 mb-2">
                      {(['background', 'card', 'primary', 'accent', 'destructive'] as const).map((tok) => (
                        <span
                          key={tok}
                          className="h-6 w-6 rounded border border-black/10"
                          style={{ backgroundColor: `hsl(${preview[tok]})` }}
                        />
                      ))}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-medium">{p.name}</span>
                      {/* Tells the two kinds apart. A gallery theme can be
                          removed and a built-in one cannot, so the picker has
                          to say which is which before anyone goes looking for
                          a Remove button that is not there. */}
                      {installedThemes.some((t) => t.id === p.id) && (
                        <span className="text-3xs text-muted-foreground">Community</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </button>
                );
              })}
            </div>}
          </div>
        </CardContent>
      </Card>

      {sharing && (
        <ThemeShareDialog palette={activePalette} onClose={() => setSharing(false)} />
      )}

      {browsing && <CommunityThemeGallery onClose={() => setBrowsing(false)} />}

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Theme</CardTitle>
          <CardDescription>
            Add seasonal color accents to the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['auto', 'manual', 'off'] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => setMode(m)}
                className="flex-1 capitalize"
              >
                {m === 'auto' ? 'Auto' : m === 'manual' ? 'Manual' : 'Off'}
              </Button>
            ))}
          </div>

          {palette && (
            <div className="flex items-center gap-3 p-3 rounded-md border border-border">
              <div className="flex gap-1.5">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.accent})` }}
                  title="Accent"
                />
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.highlight})` }}
                  title="Highlight"
                />
                <div
                  className="w-6 h-6 rounded-full border border-border"
                  style={{ backgroundColor: `hsl(${palette.light.subtle})` }}
                  title="Subtle"
                />
              </div>
              <span className="text-sm font-medium">
                {palette.label} — {palette.name}
              </span>
            </div>
          )}

          {mode === 'manual' && (
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES.map((name, i) => {
                const month = i + 1;
                const p = seasonalPalettes[month]!;
                const selected = seasonalTheme === month;
                return (
                  <button
                    key={month}
                    onClick={() => setSeasonalTheme(month)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors',
                      selected
                        ? 'border-foreground bg-accent text-accent-foreground'
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: `hsl(${p.light.accent})` }}
                    />
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      </div>
      </div>

      {/* Grouped by what a person is doing (#1017). */}
      <SectionDivider label="Background and away" />
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start" data-appearance-group="background">
        <WallpaperSettingsCard />
        <AwayModeCard />
        <NightSkyCard />
      </div>

      <SectionDivider label="All screens" />
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start" data-appearance-group="household">
        {/* Rarely changed: folded to one line with the current value. */}
        <div className="flex flex-col gap-3">
          <WeatherUnitsCard />
          <LanguageCard />
        </div>
      </div>

      {/* One screen's own settings live on that screen's editing bar (#1159). */}
      <p className="text-sm text-muted-foreground" data-screen-settings-moved>
        One screen&apos;s own settings, like when it rests, the screensaver, orientation, performance
        and the on-screen keyboard, are on that screen&apos;s editing bar: press Edit at the bottom of
        the screen, or choose it in{' '}
        <a href="/settings?section=displays" className="underline">Settings &gt; Screens</a> from a phone.
      </p>
    </div>
  );
}

function LanguageCard() {
  const { locale, setLocale } = useAppLocale();
  const [saving, setSaving] = useState(false);

  const pick = useCallback(
    async (next: (typeof APP_LOCALES)[number]['value']) => {
      setSaving(true);
      try {
        await setLocale(next);
      } catch {
        /* provider reverts on failure */
      }
      setSaving(false);
    },
    [setLocale],
  );

  return (
    <FoldCard id="language" title="Language" value={APP_LOCALES.find((l) => l.value === locale)?.label ?? locale}>
    <Card>
      <CardHeader>
        <CardDescription>
          The dashboard&apos;s display language. English is the default; other languages fall back to English
          for anything not yet translated. Only part of the UI is translated so far — this is an early preview.
          All screens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-md border border-input p-0.5" role="radiogroup" aria-label="Language">
          {APP_LOCALES.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={locale === l.value}
              disabled={saving}
              onClick={() => pick(l.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-sm transition-colors',
                locale === l.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
    </FoldCard>
  );
}

function WeatherUnitsCard() {
  const [units, setUnits] = useState<'imperial' | 'metric' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const value = data?.settings?.weather as { units?: 'imperial' | 'metric' } | undefined;
        setUnits(value?.units === 'metric' ? 'metric' : 'imperial');
      })
      .catch(() => setUnits('imperial'));
  }, []);

  const save = useCallback(async (next: 'imperial' | 'metric') => {
    setUnits(next);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'weather', value: { units: next } }),
      });
    } catch { /* ignore — UI already updated optimistically */ }
    setSaving(false);
  }, []);

  if (units === null) return null;

  return (
    <FoldCard id="units" title="Units" value={units === 'metric' ? 'Metric' : 'Imperial'}>
    <Card>
      <CardHeader>
        <CardDescription>
          Imperial shows °F, mph, and inches. Metric shows °C, km/h, and mm. Applies to weather everywhere it is shown (widget, mobile cards, away mode, babysitter mode) and to the live bus speed. All screens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-md border border-input p-0.5" role="radiogroup" aria-label="Units">
          <button
            type="button"
            role="radio"
            aria-checked={units === 'imperial'}
            disabled={saving}
            onClick={() => save('imperial')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-sm transition-colors',
              units === 'imperial' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            Imperial (°F, mph)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={units === 'metric'}
            disabled={saving}
            onClick={() => save('metric')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-sm transition-colors',
              units === 'metric' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            Metric (°C, km/h)
          </button>
        </div>
      </CardContent>
    </Card>
    </FoldCard>
  );
}

/**
 * Aurora on the night sky, for the whole household: one switch, because it is
 * one forecast, fetched by the server for the household location.
 */
function AuroraToggle() {
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => setOn(data?.settings?.[AURORA_SETTING] === true))
      .catch(() => setOn(false));
  }, []);

  const save = useCallback(async (next: boolean) => {
    setOn(next);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: AURORA_SETTING, value: next }),
      });
    } catch { /* ignore — UI already updated optimistically */ }
  }, []);

  if (on === null) return null;

  return (
    <div className="pl-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => save(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-muted-foreground">Say when aurora may be visible</span>
      </label>
      <p className="text-xs text-muted-foreground mt-1">
        On every display, the night sky checks NOAA&apos;s aurora forecast for the household location every 30 minutes
        after dark and says so when aurora may be seen. Mostly seen far north or south, and farther from the poles only
        in strong storms.
      </p>
    </div>
  );
}

/** The night sky's household switches, in a card of their own since the screensaver card left (#1159). */
function NightSkyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Night sky</CardTitle>
        <CardDescription>All screens. Which screens show it, and when, is set on each screen.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuroraToggle />
      </CardContent>
    </Card>
  );
}

/**
 * How long until Away turns itself on: one value for the household (#1159),
 * since Away is one switch for the whole house.
 */
function AwayModeCard() {
  const { timeout, setTimeout, ready, error } = useAwayModeTimeout();
  return (
    <Card data-away-card>
      <CardHeader>
        <CardTitle>Away mode</CardTitle>
        <CardDescription>All screens</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Turn on after</span>
          <select
            aria-label="Turn Away mode on after"
            value={timeout}
            disabled={!ready}
            onChange={(e) => void setTimeout(Number(e.target.value))}
            className="border border-border rounded px-2 py-1 text-sm bg-background"
          >
            {AWAY_AUTO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">with nobody touching a screen</span>
        </label>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          While Away is on, every screen shows only the clock, the weather and photos, until someone
          turns it off with a PIN.
        </p>
      </CardContent>
    </Card>
  );
}

function WallpaperSettingsCard() {
  const { enabled, setEnabled, interval, setInterval } = useWallpaperSettings();
  const { enabled: autoOrientation, setEnabled: setAutoOrientation } = useAutoOrientationSetting();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background Wallpaper</CardTitle>
        <CardDescription>
          Show a rotating photo behind the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable wallpaper</span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        {enabled && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Rotate every</span>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 text-sm bg-background"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={0}>Never (static)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Auto-match photos to screen orientation</span>
                <p className="text-xs text-muted-foreground">
                  Only show landscape photos on landscape screens and portrait on portrait screens
                </p>
              </div>
              <Switch
                checked={autoOrientation}
                onCheckedChange={setAutoOrientation}
              />
            </div>
            <PhotoCaptionSettings />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * When and where photos were taken, on the wall and the screensaver (#958).
 * Household settings: the date shows unless turned off; the place only when
 * turned on, because finding it sends a photo's rough location to
 * OpenStreetMap's geocoder.
 */
function PhotoCaptionSettings() {
  const [values, setValues] = useState<{ date: boolean; place: boolean; onThisDay: boolean } | null>(null);
  useEffect(() => {
    fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).then((d) => setValues({
      date: d?.settings?.[PHOTO_DATE_SETTING] !== false,
      place: d?.settings?.[PHOTO_PLACE_SETTING] === true,
      onThisDay: d?.settings?.[PHOTO_ON_THIS_DAY_SETTING] === true,
    })).catch(() => setValues({ date: true, place: false, onThisDay: false }));
  }, []);
  const save = async (key: string, field: 'date' | 'place' | 'onThisDay', value: boolean) => {
    const before = values;
    setValues((v) => (v ? { ...v, [field]: value } : v));
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) }).catch(() => null);
    if (!res?.ok) setValues(before);
  };
  if (!values) return null;
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Show when photos were taken</span>
          <p className="text-xs text-muted-foreground">A short line in a free corner, like &ldquo;March 2019&rdquo;</p>
        </div>
        <Switch checked={values.date} onCheckedChange={(v) => void save(PHOTO_DATE_SETTING, 'date', v)} aria-label="Show when photos were taken" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium">Show where photos were taken</span>
          <p className="text-xs text-muted-foreground">
            Names the town for photos that have a location. To find it, Prism sends the photo&rsquo;s rough location (to about a kilometre) to OpenStreetMap, once per photo.
          </p>
        </div>
        <Switch checked={values.place} onCheckedChange={(v) => void save(PHOTO_PLACE_SETTING, 'place', v)} aria-label="Show where photos were taken" />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">On this day</span>
          <p className="text-xs text-muted-foreground">On a date with photos from earlier years, show those more often</p>
        </div>
        <Switch checked={values.onThisDay} onCheckedChange={(v) => void save(PHOTO_ON_THIS_DAY_SETTING, 'onThisDay', v)} aria-label="On this day" />
      </div>
    </>
  );
}
