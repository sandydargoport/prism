'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useWallpaperSettings, useAutoOrientationSetting, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useOrientationOverride } from '../SettingsView';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useAwayModeTimeout } from '@/lib/hooks/useAwayModeTimeout';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';

function getCurrentMonthNum(): number {
  return new Date().getMonth() + 1;
}

export function DisplaySection() {
  const { theme, setTheme } = useTheme();
  const { seasonalTheme, activeMonth, setSeasonalTheme, palette } = useSeasonalTheme();

  const mode: 'auto' | 'manual' | 'off' =
    seasonalTheme === 'none' ? 'off' :
    seasonalTheme === 'auto' ? 'auto' : 'manual';

  const setMode = (m: 'auto' | 'manual' | 'off') => {
    if (m === 'off') setSeasonalTheme('none');
    else if (m === 'auto') setSeasonalTheme('auto');
    else setSeasonalTheme(getCurrentMonthNum());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Display Settings</h2>
        <p className="text-muted-foreground">
          Customize how the dashboard looks
        </p>
      </div>

      <DisplayUserCard />

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
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

      <WallpaperSettingsCard />

      <ScreensaverTimeoutCard />

      <AwayModeTimeoutCard />

      <CalendarHoursCard />

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Set your location for weather and time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            defaultValue="Springfield, IL"
            placeholder="City, State"
          />
        </CardContent>
      </Card>

      <OrientationCard />
    </div>
  );
}

function DisplayUserCard() {
  const { members } = useFamily();
  const [displayUserId, setDisplayUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const parentMembers = members.filter(m => m.role === 'parent');

  const fetchSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setDisplayUserId((data.settings?.displayUserId as string) || '');
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  const handleChange = async (value: string) => {
    setDisplayUserId(value);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'displayUserId',
          value: value || null,
        }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Display User</CardTitle>
        <CardDescription>
          When no one is logged in, the dashboard shows data as this user would see it (read-only).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          value={displayUserId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
        >
          <option value="">None (empty dashboard when logged out)</option>
          {parentMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {saving && (
          <p className="text-xs text-muted-foreground">Saving...</p>
        )}
      </CardContent>
    </Card>
  );
}

function ScreensaverTimeoutCard() {
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { interval: photoInterval, setInterval: setPhotoInterval } = useScreensaverInterval();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screensaver</CardTitle>
        <CardDescription>
          Activate screensaver mode after a period of inactivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Activate after</span>
          <select
            value={timeout}
            onChange={(e) => setTimeout(Number(e.target.value))}
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
        <div className="flex items-center gap-3">
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
      </CardContent>
    </Card>
  );
}

function AwayModeTimeoutCard() {
  const { timeout, setTimeout } = useAwayModeTimeout();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Away Mode Auto-Activation</CardTitle>
        <CardDescription>
          Automatically enable Away Mode after extended inactivity to hide sensitive information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Activate after</span>
          <select
            value={timeout}
            onChange={(e) => setTimeout(Number(e.target.value))}
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
        <p className="text-xs text-muted-foreground">
          When enabled, the screensaver will run normally, but after the specified time with no
          touch/keyboard input, Away Mode will automatically activate for privacy.
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
          <button
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors',
              enabled ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
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
              <button
                onClick={() => setAutoOrientation(!autoOrientation)}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                  autoOrientation ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    autoOrientation ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
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

function CalendarHoursCard() {
  const { settings, loaded, setSettings } = useHiddenHours();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Hours</CardTitle>
        <CardDescription>
          Hide a time range from day and week calendar views. When hidden, the remaining hours
          auto-resize to fill the available space. Toggle visibility with the clock button in calendar views.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Hide hours from</span>
          <select
            value={settings.startHour}
            onChange={(e) => setSettings({ startHour: Number(e.target.value) })}
            className="border border-border rounded px-2 py-1 text-sm bg-background"
          >
            {hours.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">to</span>
          <select
            value={settings.endHour}
            onChange={(e) => setSettings({ endHour: Number(e.target.value) })}
            className="border border-border rounded px-2 py-1 text-sm bg-background"
          >
            {hours.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          Hiding {formatHour(settings.startHour)} to {formatHour(settings.endHour)} ({
            settings.startHour <= settings.endHour
              ? settings.endHour - settings.startHour
              : 24 - settings.startHour + settings.endHour
          } hours)
        </div>
      </CardContent>
    </Card>
  );
}
