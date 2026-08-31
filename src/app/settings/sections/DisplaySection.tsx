'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useAppLocale, APP_LOCALES } from '@/components/providers/LocaleProvider';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useWallpaperSettings, useAutoOrientationSetting, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useOrientationOverride } from '../SettingsView';
import { useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useIdleLogoutSetting, IDLE_LOGOUT_OPTIONS } from '@/lib/hooks/useIdleLogout';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useAwayModeTimeout } from '@/lib/hooks/useAwayModeTimeout';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

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

export function DisplaySection() {
  const { theme, setTheme, resolvedTheme, palette: activePalette, palettes, setPalette } = useTheme();
  const { seasonalTheme, setSeasonalTheme, palette } = useSeasonalTheme();

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

      <SectionDivider label="Theme" />

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
            <div>
              <h4 className="text-sm font-medium">Palette</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Applies to every screen in the house. Light and dark above stay
                per-screen.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

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
                      className="w-3 h-3 rounded-full flex-shrink-0"
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

      <SectionDivider label="Wallpaper & Display" />

      <PerformanceModeCard />

      <WallpaperSettingsCard />

      <OrientationCard />

      <SectionDivider label="Behavior" />

      <TimersCard />

      <WeatherUnitsCard />

      <LanguageCard />
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
    <Card>
      <CardHeader>
        <CardTitle>Language <span className="text-xs font-normal text-muted-foreground">(early preview)</span></CardTitle>
        <CardDescription>
          The dashboard&apos;s display language. English is the default; other languages fall back to English
          for anything not yet translated. Only part of the UI is translated so far — this is an early preview.
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
    <Card>
      <CardHeader>
        <CardTitle>Weather units</CardTitle>
        <CardDescription>
          Imperial shows °F, mph, and inches. Metric shows °C, km/h, and mm. Applies to every place weather is rendered (widget, mobile cards, away mode, babysitter mode).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-md border border-input p-0.5" role="radiogroup" aria-label="Weather units">
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
  );
}

function TimersCard() {
  const { timeout: ssTimeout, setTimeout: setSsTimeout } = useScreensaverTimeout();
  const { interval: photoInterval, setInterval: setPhotoInterval } = useScreensaverInterval();
  const { autoHideEnabled, setAutoHideEnabled } = useAutoHideUI();
  const { timeout: awayTimeout, setTimeout: setAwayTimeout } = useAwayModeTimeout();
  const [idleLogout, setIdleLogout] = useIdleLogoutSetting();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timers &amp; Auto-Activation</CardTitle>
        <CardDescription>
          Configure screensaver, auto-hide, and away mode inactivity timers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Screensaver */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Screensaver</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={ssTimeout}
              onChange={(e) => setSsTimeout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Sign out after</span>
            <select
              value={idleLogout}
              onChange={(e) => setIdleLogout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              {IDLE_LOGOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground pl-2">
            After this long untouched, the display stops being signed in as
            whoever last used it. The dashboard stays readable; adding or
            changing anything asks for a PIN. This screen only.
          </p>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Rotate photos every</span>
            <select
              value={photoInterval}
              onChange={(e) => setPhotoInterval(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never (static)</option>
            </select>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Auto-Hide Navigation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Auto-Hide Navigation</h4>
              <p className="text-xs text-muted-foreground">Hide nav and toolbar after 10s of inactivity</p>
            </div>
            <Switch
              checked={autoHideEnabled}
              onCheckedChange={(checked) => {
                setAutoHideEnabled(checked);
                window.dispatchEvent(new Event('prism:auto-hide-change'));
              }}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Away Mode */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Away Mode Auto-Activation</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={awayTimeout}
              onChange={(e) => setAwayTimeout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={0}>Never (manual only)</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>1 day</option>
              <option value={48}>2 days</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
            <span className="text-sm text-muted-foreground">of no interaction</span>
          </div>
          <p className="text-xs text-muted-foreground pl-2">
            After the specified idle time, Away Mode activates automatically for privacy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceModeCard() {
  const { enabled, setEnabled } = usePerformanceMode();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Mode</CardTitle>
        <CardDescription>
          A lighter preset for low-end hardware (thin clients, older mini PCs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium">Enable performance mode</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Disables backdrop blur, stretches polling intervals, and shows a single static photo instead of a slideshow. Auto-enabled on devices reporting ≤2 GB RAM or ≤4 CPU cores; you can override it here at any time.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrientationCard() {
  const detectedOrientation = useScreenOrientation();
  const { override: orientationOverride, setOverride: setOrientationOverride } = useOrientationOverride();
  const effectiveOrientation = orientationOverride === 'auto' ? detectedOrientation : orientationOverride;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen Orientation</CardTitle>
        <CardDescription>
          Detected orientation is used for photo filtering and wallpaper matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Current:</span>
          <span className="text-sm font-medium capitalize">{effectiveOrientation}</span>
          {orientationOverride === 'auto' && (
            <span className="text-xs text-muted-foreground">(detected)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Override:</span>
          {(['auto', 'landscape', 'portrait'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setOrientationOverride(opt)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border transition-colors capitalize',
                orientationOverride === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
