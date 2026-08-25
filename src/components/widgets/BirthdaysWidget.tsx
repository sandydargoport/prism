/**
 *
 * Train platform / arrivals board style widget showing upcoming birthdays,
 * anniversaries, and milestones sourced from Google Calendar.
 *
 * Columns: Event | Days Until | Type | Yrs | Date
 * (Days Until sits right after the name for fast scanning, and is marked
 * data-keep-color so its urgency coloring survives the screensaver's
 * force-white text override — see SCREENSAVER_WIDGET_CLASS.)
 *
 */

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Emoji } from '@/components/ui/Emoji';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import type { Birthday } from '@/lib/hooks/useBirthdays';

export type BirthdaysWidgetProps = {
  birthdays: Birthday[];
  loading?: boolean;
  error?: string | null;
  maxItems?: number;
  titleHref?: string;
};

const TYPE_ICONS: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💍',
  milestone: '⭐',
};

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function daysUntilColor(days: number): string {
  // Today is green: it reads as "happening now" against the red/amber urgency
  // ramp used for the days still counting down.
  if (days === 0) return 'text-green-600 dark:text-green-400 font-bold';
  if (days < 7) return 'text-red-500 font-semibold';
  if (days < 30) return 'text-amber-500';
  return 'text-muted-foreground';
}

export const BirthdaysWidget = React.memo(function BirthdaysWidget({
  birthdays,
  loading = false,
  error = null,
  maxItems = 8,
  titleHref,
}: BirthdaysWidgetProps) {
  const t = useTranslations('birthdays');
  const locale = useLocale();
  const items = birthdays.slice(0, maxItems);

  // Show only the whole rows that fit (no scrollbar, no half-cut last row).
  // Measure the REAL header + row heights from the rendered table rather than
  // hardcoding them: a fixed estimate under-counts and clips the last row
  // mid-line once the widget grows tall (e.g. when the navbars auto-hide).
  // getBoundingClientRect on all three keeps the math in one coordinate space,
  // so any dashboard transform-scale cancels out.
  const listRef = React.useRef<HTMLDivElement>(null);
  const [maxRows, setMaxRows] = React.useState(maxItems);
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h <= 0) return;
      const headerEl = el.querySelector('thead');
      const rowEl = el.querySelector('tbody tr');
      const headerH = headerEl?.getBoundingClientRect().height ?? 26;
      const rowH = rowEl?.getBoundingClientRect().height ?? 34;
      if (rowH <= 0) return;
      setMaxRows(Math.max(1, Math.floor((h - headerH) / rowH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);
  const visible = items.slice(0, maxRows);

  return (
    <WidgetContainer
      title={t('title')}
      icon={<Emoji e="🎂" />}
      loading={loading}
      error={error}
      titleHref={titleHref}
    >
      {items.length === 0 ? (
        <WidgetEmpty
          icon={<Emoji e="🎂" />}
          message={t('empty')}
        />
      ) : (
        <div ref={listRef} className="overflow-hidden h-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-1 pr-2 font-medium">{t('colEvent')}</th>
                <th className="text-right py-1 px-1 font-medium w-20">{t('colDays')}</th>
                <th className="py-1 px-1 font-medium w-8"></th>
                <th className="text-right py-1 px-1 font-medium w-10">{t('colYears')}</th>
                <th className="text-right py-1 pl-2 font-medium w-16">{t('colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    item.daysUntil === 0 && 'bg-green-500/10'
                  )}
                >
                  <td className="py-1.5 pr-2 truncate max-w-[140px]" title={item.name}>
                    {item.name}
                    {item.daysUntil === 0 && (
                      <span className="ml-1.5 text-[10px] bg-green-600 text-white px-1 py-0.5 rounded">
                        {t('todayBadge')}
                      </span>
                    )}
                  </td>
                  <td
                    data-keep-color
                    className={cn('py-1.5 px-1 text-right tabular-nums', daysUntilColor(item.daysUntil))}
                  >
                    {t('daysUntil', { days: item.daysUntil })}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <Emoji e={TYPE_ICONS[item.eventType] || '⭐'} />
                  </td>
                  <td className="py-1.5 px-1 text-right text-muted-foreground tabular-nums">
                    {item.age != null ? item.age : ''}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-muted-foreground whitespace-nowrap">
                    {formatDate(item.nextBirthday, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetContainer>
  );
});
