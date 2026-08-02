'use client';

interface MeasureBarProps {
  measureHideNav: boolean;
  onToggleNav: () => void;
  onExit: () => void;
}

/**
 * Floating control bar shown in full-screen preview mode. The old
 * screen-safe-zone editor + per-zone selector were retired (the dashboard now
 * stretches one design to fill any screen, so there are no zones to pick), so
 * this is just: toggle the nav chrome, and exit.
 */
export function LayoutEditorMeasureBar({ measureHideNav, onToggleNav, onExit }: MeasureBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
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
