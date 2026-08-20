'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WeekItemVariant = 'event' | 'chore' | 'task' | 'meal';
export type WeekItemSize = 'xs' | 'sm' | 'md' | 'lg';
export type WeekItemLayout = 'column' | 'row';

interface WeekItemCardProps {
  variant: WeekItemVariant;
  /** Hex or CSS color used for the left stripe and (optionally) icon tint */
  stripeColor: string;
  /** Title — main text */
  title: string;
  /** Optional time range, e.g. '7:00 PM' or '7:00 - 8:30 PM' */
  timeLabel?: string;
  /** Optional secondary line, e.g. assignee name or calendar */
  subtitle?: string;
  /** Strike-through and dim, for completed/cooked items */
  muted?: boolean;
  /** Dim without marking complete, for items whose time has passed. */
  subdued?: boolean;
  /** Diagonal-stripe overlay for items awaiting parent approval. */
  pendingApproval?: boolean;
  /** Click handler — opens detail modal in caller */
  onClick?: () => void;
  /** Accessible label override */
  ariaLabel?: string;
  /**
   * Drag identifier in the form `chore:<id>` | `task:<id>` | `meal:<id>`.
   * Omit for read-only items (calendar events).
   */
  dragId?: string;
  /** Visual density. Defaults to 'md'. */
  size?: WeekItemSize;
  /** Stacked vertical card ('column') or horizontal row ('row'). Defaults to 'column'. */
  layout?: WeekItemLayout;
}

// Diagonal-stripes overlay used to mark "pending approval" items. The
// 4px-on / 4px-off pattern reads as a non-solid surface without overpowering
// the underlying card content.
const PENDING_APPROVAL_OVERLAY = 'repeating-linear-gradient(45deg, rgba(168,85,247,0.18) 0 6px, rgba(168,85,247,0) 6px 12px)';

/**
 * Tailwind class fragments per size — kept as static strings (not template-built)
 * so Tailwind's JIT can detect them.
 */
/**
 * Size profiles tuned to the FamousWolf/week-planner-card visual recon
 * (see docs/calendar-cards-design.md). Upstream uses 10px internal padding,
 * 5px left stripe, and 1em title — we map those onto Tailwind tokens that
 * remain theme-aware.
 */
const SIZE_STYLES: Record<WeekItemSize, {
  padding: string;
  titleText: string;
  titleWeight: string;
  metaText: string;
  stripeWidth: string;
  showSubtitle: boolean;
  showTime: boolean;
}> = {
  xs: {
    padding: 'py-0.5 pr-1',
    titleText: 'text-[10px] leading-tight',
    titleWeight: 'font-semibold',
    metaText: 'text-[9px] leading-tight',
    stripeWidth: 'w-0.5',
    showSubtitle: false,
    showTime: false,
  },
  sm: {
    padding: 'py-1 pr-1.5',
    titleText: 'text-[11px] leading-tight',
    titleWeight: 'font-semibold',
    metaText: 'text-[9px] leading-tight',
    stripeWidth: 'w-[3px]',
    showSubtitle: false,
    showTime: true,
  },
  md: {
    padding: 'py-1.5 pr-2',
    titleText: 'text-xs leading-tight',
    titleWeight: 'font-semibold',
    metaText: 'text-[10px] leading-tight',
    stripeWidth: 'w-[5px]',
    showSubtitle: true,
    showTime: true,
  },
  lg: {
    padding: 'py-2 pr-2.5',
    titleText: 'text-sm leading-snug',
    titleWeight: 'font-bold',
    metaText: 'text-xs leading-tight',
    stripeWidth: 'w-[5px]',
    showSubtitle: true,
    showTime: true,
  },
};

export function WeekItemCard({
  variant,
  stripeColor,
  title,
  timeLabel,
  subtitle,
  muted,
  subdued,
  pendingApproval,
  onClick,
  ariaLabel,
  dragId,
  size = 'md',
  layout = 'column',
}: WeekItemCardProps) {
  const draggable = useDraggable({
    id: dragId ?? `__static__:${variant}:${title}`,
    disabled: !dragId,
    data: { dragId },
  });

  // A card is "interactive" (rendered as a button + clickable) whenever it
  // has an onClick handler, regardless of whether it's also draggable.
  // dnd-kit's PointerSensor activationConstraint (distance: 5px) keeps a
  // simple click from being misread as a drag, so the same element can do
  // both — open the edit modal on click, reschedule on drag.
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';
  const styles = SIZE_STYLES[size];

  // Meals get a small utensils glyph before the title so a meal reads as a meal
  // at a glance rather than looking like any other colored event. Sized with
  // the title and tinted to the item's stripe color; hidden on the tiniest
  // (xs) cells where there isn't room.
  const showMealIcon = variant === 'meal' && size !== 'xs';

  const transformStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    touchAction: dragId ? 'none' : undefined,
    zIndex: draggable.isDragging ? 50 : undefined,
  };

  // For row layout, render: [stripe][time][title][subtitle aside]
  if (layout === 'row') {
    return (
      <Tag
        ref={dragId ? draggable.setNodeRef : undefined}
        type={interactive ? 'button' : undefined}
        onClick={onClick}
        aria-label={ariaLabel ?? title}
        data-variant={variant}
        data-dragging={draggable.isDragging || undefined}
        style={transformStyle}
        {...(dragId ? draggable.listeners : {})}
        {...(dragId ? draggable.attributes : {})}
        className={cn(
          'group relative flex w-full items-center gap-2',
          'overflow-hidden rounded-md',
          'bg-card/85 backdrop-blur-sm',
          'border border-border/40 shadow-sm',
          'text-left text-foreground',
          'transition-colors duration-150',
          interactive && 'cursor-pointer hover:bg-card',
          dragId && 'cursor-grab active:cursor-grabbing',
          draggable.isDragging && 'opacity-60 ring-2 ring-seasonal-accent shadow-xl',
          muted && 'opacity-60',
          subdued && 'opacity-55 saturate-[0.65]',
          styles.padding,
        )}
      >
        {pendingApproval && (
          <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: PENDING_APPROVAL_OVERLAY }} />
        )}
        <span aria-hidden className={cn('shrink-0 self-stretch rounded-full', styles.stripeWidth)} style={{ backgroundColor: stripeColor }} />
        {styles.showTime && timeLabel && (
          <span className={cn('shrink-0 font-medium tabular-nums text-muted-foreground', styles.metaText)}>
            {timeLabel}
          </span>
        )}
        <span className={cn('flex min-w-0 flex-1 items-center gap-1 text-foreground', styles.titleText, styles.titleWeight, muted && 'line-through')}>
          {showMealIcon && <UtensilsCrossed aria-hidden className="h-3 w-3 shrink-0" style={{ color: stripeColor }} />}
          <span className="truncate">{title}</span>
        </span>
        {styles.showSubtitle && subtitle && (
          <span className={cn('shrink-0 truncate text-muted-foreground', styles.metaText)}>
            {subtitle}
          </span>
        )}
      </Tag>
    );
  }

  // Default: column layout (stacked card)
  return (
    <Tag
      ref={dragId ? draggable.setNodeRef : undefined}
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      data-variant={variant}
      data-dragging={draggable.isDragging || undefined}
      style={transformStyle}
      {...(dragId ? draggable.listeners : {})}
      {...(dragId ? draggable.attributes : {})}
      className={cn(
        'group relative flex w-full items-stretch gap-2',
        'overflow-hidden rounded-md',
        'bg-card/85 backdrop-blur-sm',
        'border border-border/40 shadow-sm',
        'text-left text-foreground',
        'transition-colors duration-150',
        interactive && 'cursor-pointer hover:bg-card',
        dragId && 'cursor-grab active:cursor-grabbing',
        draggable.isDragging && 'opacity-60 ring-2 ring-seasonal-accent shadow-xl',
        muted && 'opacity-60',
        subdued && 'opacity-55 saturate-[0.65]',
      )}
    >
      {pendingApproval && (
        <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: PENDING_APPROVAL_OVERLAY }} />
      )}
      <span aria-hidden className={cn('shrink-0 rounded-l-md', styles.stripeWidth)} style={{ backgroundColor: stripeColor }} />

      <div className={cn('flex min-w-0 flex-1 flex-col', styles.padding)}>
        {styles.showTime && timeLabel && (
          <span className={cn('truncate font-medium text-muted-foreground', styles.metaText)}>
            {timeLabel}
          </span>
        )}
        <span className={cn('flex min-w-0 items-center gap-1 text-foreground', styles.titleText, styles.titleWeight, muted && 'line-through')}>
          {showMealIcon && <UtensilsCrossed aria-hidden className="h-3 w-3 shrink-0" style={{ color: stripeColor }} />}
          <span className="truncate">{title}</span>
        </span>
        {styles.showSubtitle && subtitle && (
          <span className={cn('truncate text-muted-foreground', styles.metaText)}>
            {subtitle}
          </span>
        )}
      </div>
    </Tag>
  );
}
