/**
 *
 * Provides a standardized container for dashboard widgets.
 * All widgets (Clock, Weather, Calendar, Tasks, etc.) use this as their shell.
 *
 * FEATURES:
 * - Consistent styling across all widgets
 * - Header with title and optional actions
 * - Loading and error states
 * - Expandable to full screen
 * - Touch-friendly interactions
 *
 * DESIGN PHILOSOPHY:
 * - Widgets should feel like "cards" on a dashboard
 * - Each widget can show its own loading/error states
 * - Optional header for widgets that need titles
 * - Content area fills available space
 *
 * USAGE:
 *   <WidgetContainer title="Weather" icon={<CloudIcon />}>
 *     <WeatherContent />
 *   </WidgetContainer>
 *
 *   <WidgetContainer
 *     title="Tasks"
 *     actions={<Button size="icon"><PlusIcon /></Button>}
 *     loading={isLoading}
 *   >
 *     <TaskList tasks={tasks} />
 *   </WidgetContainer>
 *
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { isLightColor, hexToHslValues, hexToRgba } from '@/lib/utils/color';

/**
 * WIDGET ALIGNMENT
 */
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface WidgetAlignment {
  horizontal: HAlign;
  vertical: VAlign;
}

const ALIGNMENT_STORAGE_KEY = 'prism-widget-alignments';

export function useWidgetAlignments() {
  const [alignments, setAlignmentsState] = React.useState<Record<string, WidgetAlignment>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(ALIGNMENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const setAlignment = React.useCallback((widgetId: string, alignment: WidgetAlignment) => {
    setAlignmentsState((prev) => {
      const next = { ...prev, [widgetId]: alignment };
      localStorage.setItem(ALIGNMENT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { alignments, setAlignment };
}

// Context for passing alignment to WidgetContainer without threading through every widget
const WidgetAlignmentContext = React.createContext<Record<string, WidgetAlignment>>({});
export const WidgetAlignmentProvider = WidgetAlignmentContext.Provider;

// Context for grid-level background override — when the grid wrapper applies a custom
// background, the Card strips its own bg/border/shadow so there's no double background.
// Also carries explicit textColor so WidgetContainer can apply it on the Card.
const WidgetBgOverrideContext = React.createContext<{ hasCustomBg: boolean; textColor?: string; textOpacity?: number; gridLineOpacity?: number; cellBackgroundColor?: string; cellBackgroundOpacity?: number } | null>(null);
export const WidgetBgOverrideProvider = WidgetBgOverrideContext.Provider;

/** Hook for sub-components (e.g. calendar views) to check if widget has custom bg */
export function useWidgetBgOverride() {
  return React.useContext(WidgetBgOverrideContext);
}

// Context for current widget ID so WidgetContainer can self-lookup
const WidgetIdContext = React.createContext<string | null>(null);
export const WidgetIdProvider = WidgetIdContext.Provider;

const hAlignClass: Record<HAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const vAlignClass: Record<VAlign, string> = {
  top: 'justify-start',
  middle: 'justify-center',
  bottom: 'justify-end',
};


/**
 * WIDGET SIZE
 * Widgets can be different sizes on the dashboard grid.
 * These map to grid column/row spans.
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall';


/**
 * WIDGET CONTAINER PROPS
 */
export interface WidgetContainerProps {
  /** Widget title (shown in header) */
  title?: string;
  /** Stable widget identifier for tests/analytics. Falls back to title. */
  widgetType?: string;
  /** URL to navigate to when title is clicked */
  titleHref?: string;
  /** Icon to show before title */
  icon?: React.ReactNode;
  /** Action buttons for the header (e.g., add, refresh) */
  actions?: React.ReactNode;
  /** Widget content */
  children: React.ReactNode;
  /** Whether the widget is loading data */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Size variant for grid layout */
  size?: WidgetSize;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Custom background color (hex). Auto-detects text color from luminance. */
  backgroundColor?: string;
  /** Widget ID for per-widget alignment lookup */
  widgetId?: string;
  /** Text alignment override */
  alignment?: WidgetAlignment;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for the entire widget */
  onClick?: () => void;
}


/**
 * WIDGET CONTAINER COMPONENT
 * The main container component for all dashboard widgets.
 *
 * @example Basic widget
 * <WidgetContainer title="Clock">
 *   <ClockDisplay />
 * </WidgetContainer>
 *
 * @example Widget with actions
 * <WidgetContainer
 *   title="Tasks"
 *   icon={<CheckSquareIcon />}
 *   actions={
 *     <Button size="icon" variant="ghost">
 *       <PlusIcon />
 *     </Button>
 *   }
 * >
 *   <TaskList />
 * </WidgetContainer>
 *
 * @example Loading state
 * <WidgetContainer title="Weather" loading={true}>
 *   <WeatherContent />
 * </WidgetContainer>
 */
export function WidgetContainer({
  title,
  titleHref,
  icon,
  actions,
  children,
  loading = false,
  error = null,
  backgroundColor,
  size = 'medium',
  showHeader = true,
  widgetId,
  widgetType,
  alignment: alignmentProp,
  className,
  onClick,
}: WidgetContainerProps) {
  // Resolve alignment from prop, context, or default
  const contextAlignments = React.useContext(WidgetAlignmentContext);
  const contextWidgetId = React.useContext(WidgetIdContext);
  const resolvedId = widgetId || contextWidgetId;
  const alignment = alignmentProp || (resolvedId ? contextAlignments[resolvedId] : undefined);

  // When grid-level background is applied, strip Card's own bg so it doesn't double up
  const bgOverride = React.useContext(WidgetBgOverrideContext);
  const stripCardBg = bgOverride?.hasCustomBg === true;
  const overrideTextColor = bgOverride?.textColor;
  const overrideGridLineOpacity = bgOverride?.gridLineOpacity ?? 1;

  // Size classes for the grid
  const sizeClasses: Record<WidgetSize, string> = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 row-span-2',
    large: 'col-span-2 row-span-2',
    wide: 'col-span-2 row-span-1',
    tall: 'col-span-1 row-span-3',
  };

  return (
    <Card
      className={cn(
        // Grid sizing
        sizeClasses[size],
        // Full height within grid cell
        'h-full',
        // Grid layout: header gets auto height, content gets remaining space
        // (CSS Grid gives the content row a definite height, enabling ScrollArea h-full)
        'grid overflow-hidden',
        // Interactive cursor if clickable
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        // Strip Card styling when grid-level background is applied
        stripCardBg && 'backdrop-blur-none border-transparent shadow-none',
        // Auto text color based on background luminance (skipped when explicit textColor override)
        !overrideTextColor && backgroundColor && (isLightColor(backgroundColor) ? 'text-black' : 'text-white'),
        className
      )}
      onClick={onClick}
      data-widget={widgetType ?? title}
      style={{
        // Grid rows: auto for header (if present), 1fr for content
        gridTemplateRows: showHeader && title ? 'auto 1fr' : '1fr',
        ...(stripCardBg
          ? { backgroundColor: 'transparent' }
          : backgroundColor ? { backgroundColor } : {}),
        ...((() => {
          // Two override surfaces, applied INDEPENDENTLY:
          //
          //   (1) Widget has its own backgroundColor — inner BG tokens
          //       (--card, --muted, --secondary, --background, --popover)
          //       inherit it so grid cells, hour column, date row,
          //       toolbar buttons all read as the same surface as the
          //       widget chrome. Fires WHETHER OR NOT textColor is also
          //       overridden (the user's case in this PR: they set a BG
          //       but kept default text and were still seeing white
          //       inner surfaces because the override block used to be
          //       gated on textColor).
          //
          //   (2) Widget has a custom textColor — text tokens track that
          //       color; if no widget backgroundColor (transparent /
          //       frosted), inner BG tokens auto-flip to opposite
          //       luminance so the widget stays readable over wallpaper.
          //
          // The two paths compose: BG override sets inner surface, text
          // override sets foreground colors. Hover (--accent) gets a
          // faint text-color tint when one is set, falls back to a
          // theme-anchored low-alpha when neither is.
          const hasSolidWidgetBg =
            !!backgroundColor &&
            backgroundColor !== 'transparent' &&
            backgroundColor !== 'frosted';

          if (!overrideTextColor && !hasSolidWidgetBg) return {};

          const styles: Record<string, string> = {};

          // ---- Text-color side ----
          let textHsl: string | null = null;
          let textIsLight = false;
          if (overrideTextColor) {
            textHsl = hexToHslValues(overrideTextColor);
            textIsLight = isLightColor(overrideTextColor);
            const mutedHslVal = `${textHsl} / 0.6`;
            const borderOpacity = overrideGridLineOpacity < 1 ? overrideGridLineOpacity : 1;
            const borderHslVal = borderOpacity < 1 ? `${textHsl} / ${borderOpacity}` : textHsl;
            styles.color = overrideTextColor;
            styles['--foreground'] = textHsl;
            styles['--card-foreground'] = textHsl;
            styles['--popover-foreground'] = textHsl;
            styles['--muted-foreground'] = mutedHslVal;
            styles['--secondary-foreground'] = textHsl;
            styles['--seasonal-accent'] = textHsl;
            styles['--input'] = borderHslVal;
            styles['--border'] = borderHslVal;
          }

          // ---- Inner-BG side ----
          if (hasSolidWidgetBg) {
            const widgetHsl = hexToHslValues(backgroundColor!);
            styles['--card'] = widgetHsl;
            styles['--popover'] = widgetHsl;
            styles['--muted'] = widgetHsl;
            styles['--secondary'] = widgetHsl;
            styles['--background'] = widgetHsl;
            styles['--accent'] = textHsl ? `${textHsl} / 0.12` : `${widgetHsl} / 0.6`;
          } else if (overrideTextColor) {
            // Auto-flip fallback (transparent / frosted widget with text-color override)
            styles['--card'] = textIsLight ? '0 0% 0% / 0.55' : '0 0% 100% / 0.85';
            styles['--popover'] = textIsLight ? '0 0% 8% / 0.95' : '0 0% 100% / 0.95';
            styles['--accent'] = textIsLight ? '0 0% 100% / 0.12' : '0 0% 0% / 0.08';
            styles['--background'] = textIsLight ? '0 0% 0% / 0.4' : '0 0% 100% / 0.7';
            styles['--muted'] = textIsLight ? '0 0% 100% / 0.08' : '0 0% 0% / 0.06';
            styles['--secondary'] = textIsLight ? '0 0% 100% / 0.15' : '0 0% 0% / 0.1';
          }

          return styles as unknown as React.CSSProperties;
        })()),
      }}
    >
      {/* WIDGET HEADER */}
      {showHeader && title && (
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {/* Icon */}
            {icon && (
              <span className="text-seasonal-accent">
                {icon}
              </span>
            )}
            {/* Title - clickable link if titleHref provided */}
            {titleHref ? (
              <Link href={titleHref} className="hover:underline">
                <CardTitle className="text-base font-medium">
                  {title}
                </CardTitle>
              </Link>
            ) : (
              <CardTitle className="text-base font-medium">
                {title}
              </CardTitle>
            )}
          </div>
          {/* Action buttons */}
          {actions && (
            <div className="flex items-center gap-1">
              {actions}
            </div>
          )}
        </CardHeader>
      )}

      {/* WIDGET CONTENT */}
      <CardContent
        className={cn(
          // Fill remaining space; min-h-0 prevents grid row overflow
          'flex flex-col min-h-0',
          // Clip content overflow (individual widgets use ScrollArea for scrolling)
          'overflow-hidden',
          // Remove padding if no header
          !showHeader && 'pt-4',
          // Per-widget alignment
          alignment && hAlignClass[alignment.horizontal],
          alignment && vAlignClass[alignment.vertical],
        )}
      >
        {/* Loading State */}
        {loading && (
          <WidgetLoading />
        )}

        {/* Error State */}
        {error && !loading && (
          <WidgetError message={error} />
        )}

        {/* Normal Content */}
        {!loading && !error && children}
      </CardContent>
    </Card>
  );
}


/**
 * WIDGET LOADING
 * Loading indicator shown while widget data is being fetched.
 * Uses a skeleton/shimmer effect for a polished feel.
 */
function WidgetLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="space-y-3 w-full">
        {/* Skeleton lines */}
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
      </div>
    </div>
  );
}


/**
 * WIDGET ERROR
 * Error state shown when widget fails to load.
 * Shows a friendly message and suggests retry.
 */
function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center p-4">
      <div className="text-destructive text-4xl mb-2">⚠️</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}


/**
 * WIDGET EMPTY
 * Empty state shown when widget has no data.
 * Can be used inside widgets for their empty states.
 *
 * @example
 * {tasks.length === 0 ? (
 *   <WidgetEmpty
 *     icon={<CheckCircleIcon />}
 *     message="No tasks for today"
 *     action={<Button>Add Task</Button>}
 *   />
 * ) : (
 *   <TaskList tasks={tasks} />
 * )}
 */
export function WidgetEmpty({
  icon,
  message,
  action,
}: {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center p-4 gap-3">
      {icon && (
        <div className="text-muted-foreground text-4xl">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
