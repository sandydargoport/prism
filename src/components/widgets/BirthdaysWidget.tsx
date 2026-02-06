/**
 * ============================================================================
 * PRISM - Birthdays & Milestones Widget
 * ============================================================================
 *
 * Train platform / arrivals board style widget showing upcoming birthdays,
 * anniversaries, and milestones sourced from Google Calendar.
 *
 * Columns: Event | Type | Yrs | Days Until | Date
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import type { Birthday } from '@/lib/hooks/useBirthdays';

export interface BirthdaysWidgetProps {
  birthdays: Birthday[];
  loading?: boolean;
  error?: string | null;
  maxItems?: number;
  titleHref?: string;
}

const TYPE_ICONS: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💍',
  milestone: '⭐',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntilColor(days: number): string {
  if (days === 0) return 'text-primary font-bold';
  if (days < 7) return 'text-red-500 font-semibold';
  if (days < 30) return 'text-amber-500';
  return 'text-muted-foreground';
}

function daysUntilLabel(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function BirthdaysWidget({
  birthdays,
  loading = false,
  error = null,
  maxItems = 8,
  titleHref,
}: BirthdaysWidgetProps) {
  const items = birthdays.slice(0, maxItems);

  return (
    <WidgetContainer
      title="Upcoming Birthdays & Milestones"
      icon={<span>🎂</span>}
      loading={loading}
      error={error}
      titleHref={titleHref}
    >
      {items.length === 0 ? (
        <WidgetEmpty
          icon={<span>🎂</span>}
          message="No upcoming birthdays or events"
        />
      ) : (
        <div className="overflow-auto h-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-1 pr-2 font-medium">Event</th>
                <th className="py-1 px-1 font-medium w-8"></th>
                <th className="text-right py-1 px-1 font-medium w-10">Yrs</th>
                <th className="text-right py-1 px-1 font-medium w-20">Days</th>
                <th className="text-right py-1 pl-2 font-medium w-16">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    item.daysUntil === 0 && 'bg-primary/5'
                  )}
                >
                  <td className="py-1.5 pr-2 truncate max-w-[140px]" title={item.name}>
                    {item.name}
                    {item.daysUntil === 0 && (
                      <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground px-1 py-0.5 rounded">
                        TODAY
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    {TYPE_ICONS[item.eventType] || '⭐'}
                  </td>
                  <td className="py-1.5 px-1 text-right text-muted-foreground tabular-nums">
                    {item.age != null ? item.age : ''}
                  </td>
                  <td className={cn('py-1.5 px-1 text-right tabular-nums', daysUntilColor(item.daysUntil))}>
                    {daysUntilLabel(item.daysUntil)}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-muted-foreground whitespace-nowrap">
                    {formatDate(item.nextBirthday)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetContainer>
  );
}
