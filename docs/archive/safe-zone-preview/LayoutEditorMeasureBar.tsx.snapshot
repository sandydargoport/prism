'use client';

import { useState } from 'react';
import { useScreenSafeZones, RESOLUTION_PRESETS, computeZones, DEFAULT_SCREENS } from '@/lib/hooks/useScreenSafeZones';
import type { ScreenZoneConfig } from '@/lib/hooks/useScreenSafeZones';

interface MeasureBarProps {
  measureHideNav: boolean;
  onToggleNav: () => void;
  onExit: () => void;
  previewZones: { name: string; color: string }[];
  activeZoneIndex: number;
  onZoneChange: (idx: number) => void;
}

const PRESET_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#22C55E', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function ScreensPanel() {
  const { screens, setScreens, resetToDefaults } = useScreenSafeZones();

  const updateScreen = (idx: number, patch: Partial<ScreenZoneConfig>) => {
    setScreens(screens.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const removeScreen = (idx: number) => {
    setScreens(screens.filter((_, i) => i !== idx));
  };

  const addScreen = (width = 1920, height = 1080, name = 'New') => {
    const usedColors = screens.map(s => s.color);
    const nextColor = PRESET_COLORS.find(c => !usedColors.includes(c)) || '#6B7280';
    const existing = screens.some(s => s.name === name);
    const label = existing ? `${name} (2)` : name;
    setScreens([...screens, { name: label, width, height, color: nextColor }]);
  };

  const useMyScreen = () => {
    if (typeof window === 'undefined') return;
    addScreen(window.screen.width, window.screen.height, `${window.screen.width}×${window.screen.height}`);
  };

  const landscapeZones = computeZones(screens, 'landscape');
  const portraitZones = computeZones(screens, 'portrait');

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-4 w-[560px] max-w-[calc(100vw-2rem)] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Screen Safe Zones</p>
        <p className="text-xs text-muted-foreground">Guides shown in the layout grid</p>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-[1.75rem_1fr_4.5rem_4.5rem_7rem_1.5rem] gap-2 items-center text-xs text-muted-foreground font-medium px-0.5">
          <span />
          <span>Label</span>
          <span>Width</span>
          <span>Height</span>
          <span className="text-center">Grid (L / P)</span>
          <span />
        </div>
        {screens.map((screen, idx) => {
          const lz = landscapeZones[idx];
          const pz = portraitZones[idx];
          return (
            <div key={idx} className="grid grid-cols-[1.75rem_1fr_4.5rem_4.5rem_7rem_1.5rem] gap-2 items-center">
              <input
                type="color"
                value={screen.color}
                onChange={(e) => updateScreen(idx, { color: e.target.value })}
                className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                value={screen.name}
                onChange={(e) => updateScreen(idx, { name: e.target.value })}
                className="h-7 text-xs border border-border rounded px-2 bg-background w-full"
              />
              <input
                type="number"
                min={320}
                max={7680}
                value={screen.width}
                onChange={(e) => updateScreen(idx, { width: parseInt(e.target.value) || 320 })}
                className="h-7 text-xs border border-border rounded px-2 bg-background w-full"
              />
              <input
                type="number"
                min={320}
                max={4320}
                value={screen.height}
                onChange={(e) => updateScreen(idx, { height: parseInt(e.target.value) || 320 })}
                className="h-7 text-xs border border-border rounded px-2 bg-background w-full"
              />
              <span className="text-xs text-muted-foreground tabular-nums text-center">
                {lz ? `${lz.cols}×${lz.rows}` : '–'} / {pz ? `${pz.cols}×${pz.rows}` : '–'}
              </span>
              <button
                onClick={() => removeScreen(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors text-base leading-none"
                title="Remove"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 pt-1 border-t border-border">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground">Presets:</span>
          {RESOLUTION_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => addScreen(p.width, p.height, p.label)}
              className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent/50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => addScreen()}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-accent/50 transition-colors"
          >
            + Add Zone
          </button>
          <button
            onClick={useMyScreen}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-accent/50 transition-colors"
          >
            Use my screen
          </button>
          <button
            onClick={resetToDefaults}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            Reset defaults
          </button>
        </div>
      </div>
    </div>
  );
}

export function LayoutEditorMeasureBar({ measureHideNav, onToggleNav, onExit, previewZones, activeZoneIndex, onZoneChange }: MeasureBarProps) {
  const [showScreens, setShowScreens] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2">
      {showScreens && <ScreensPanel />}

      <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
        <button
          onClick={() => setShowScreens(prev => !prev)}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
            showScreens
              ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Screens
        </button>

        {/* Zone selector — shows which screen you're previewing; click to switch */}
        {previewZones.length > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              {previewZones.map((zone, idx) => {
                const isActive = idx === (activeZoneIndex < previewZones.length ? activeZoneIndex : 0);
                return (
                  <button
                    key={zone.name}
                    onClick={() => onZoneChange(idx)}
                    title={`Preview as ${zone.name}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-card border border-border text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: zone.color, boxShadow: isActive ? `0 0 6px ${zone.color}` : undefined }}
                    />
                    {zone.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="w-px h-4 bg-border" />
        <button
          onClick={onToggleNav}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
            measureHideNav
              ? 'bg-muted text-muted-foreground hover:bg-accent'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
          }`}
        >
          {measureHideNav ? 'Show Nav' : 'Hide Nav'}
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={onExit}
          className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Exit Preview
        </button>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Ctrl+Shift+M</span>
      </div>
    </div>
  );
}
