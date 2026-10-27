import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface EditorTheme {
  gridBg: string;
  gridStroke: string;
  gridOpacity: number;
  gridPatternId: string;
  borderDash: string;
}

export const DASHBOARD_THEME: EditorTheme = {
  gridBg: '',
  gridStroke: 'currentColor',
  gridOpacity: 0.3,
  gridPatternId: 'grid-dash',
  borderDash: 'border-white/50 dark:border-white/40',
};

export const SCREENSAVER_THEME: EditorTheme = {
  gridBg: 'bg-black/80',
  gridStroke: 'white',
  gridOpacity: 0.2,
  gridPatternId: 'grid-ss',
  borderDash: 'border-white/40',
};

export interface CssGridDisplayProps {
  layout: WidgetConfig[];
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  margin?: number;
  containerPadding?: number;
  cols?: number;
  /** Fill viewport height (screensaver mode) */
  fillHeight?: boolean;
  /** Offset from top of viewport for visible row calculation */
  headerOffset?: number;
  /** Offset from bottom for portrait nav */
  bottomOffset?: number;
  minVisibleRows?: number;
  /**
   * Canonical row count of the design's target screen (e.g. 27 for 1080p). When
   * set, the grid renders exactly `cols × targetRows` scaled to FIT the viewport
   * (both axes), centered/letterboxed — so the same layout looks identical on
   * any screen (kiosk, laptop browser, tablet), just at a different scale,
   * instead of gaining/losing rows and clipping. When unset, falls back to the
   * legacy fill-width + adaptive-rows behavior.
   */
  targetRows?: number;
  /**
   * Orientation the layout was designed for (from the saved layout). Used to
   * decide stretch-to-fill (screen orientation matches) vs letterbox (mismatch).
   * Falls back to inferring from the canvas shape when omitted.
   */
  designOrientation?: 'landscape' | 'portrait';
  /**
   * Force contain/scale-to-fit (never stretch, never fixed-cell fill). The
   * content bounding box is scaled with square cells to fit the viewport and
   * centered — used for the screensaver, where a sparse ambient layout should
   * scale to fit any screen without clipping or distortion.
   */
  containMode?: boolean;
  /**
   * Contain mode only: the editor's Screen frame, in grid units. The canvas is
   * at least this big, so a layout designed inside the frame maps the frame,
   * not the widgets' own bounding box, onto the screen. Without it, widgets
   * that stop short of the frame's edge were scaled up to fill the screen.
   */
  screenFrame?: { cols: number; rows: number };
  /**
   * Widgets to fade out in place: drawn at opacity 0 and untappable, but still
   * part of the layout, so nothing else moves or resizes. Calm mode's idle
   * state (#691).
   */
  fadedIds?: ReadonlySet<string>;
  /**
   * Slow burn-in drift, applied to each whole cell. On the cell, not inside
   * it: the cell clips its content, so a card drifting inside it lost an edge
   * of its outline to the clip on whichever side it had moved towards.
   */
  drift?: boolean;
  className?: string;
}

export interface LayoutGridEditorProps {
  layout: WidgetConfig[];
  onLayoutChange: (layout: WidgetConfig[]) => void;
  isEditable?: boolean;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  widgetConstraints?: Record<string, { minW?: number; minH?: number }>;
  margin?: number;
  headerOffset?: number;
  bottomOffset?: number;
  minVisibleRows?: number;
  theme?: EditorTheme;
  /**
   * How Preview maps the design onto the screen. 'contain' is the screensaver's
   * own geometry, so Preview shows what the live screensaver will draw.
   */
  previewFit?: 'stretch' | 'contain';
  gridHelperText?: string;
  /** Display mode only; see CssGridDisplayProps. */
  fadedIds?: ReadonlySet<string>;
  /** Display mode only; see CssGridDisplayProps. */
  drift?: boolean;
  /** Edit mode only; see CssGridEditorProps. */
  idleToggles?: boolean;
  className?: string;
  screenGuideOrientation?: 'landscape' | 'portrait';
  enabledSizes?: string[];
  onScrollInfo?: (info: { scrollY: number; visibleRows: number; scrollX: number; visibleCols: number; totalRows: number; totalCols: number }) => void;
  scrollToRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
}
