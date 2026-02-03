'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useWallpaperSettings, useAutoOrientationSetting } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useOrientationOverride } from '../SettingsView';

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
