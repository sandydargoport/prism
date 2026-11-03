'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * A new install has only the built-in local calendars. Until a real one is
 * connected, and while nothing is on the local ones either, the calendar
 * widget invites a connection instead of showing an empty list (#808).
 */
export function needsCalendarInvite({ loading, eventCount, providers }: {
  loading: boolean;
  eventCount: number;
  providers: string[];
}): boolean {
  return !loading && eventCount === 0 && providers.every((p) => p === 'local');
}

/** Shown in place of an empty calendar until one is connected. */
export function ConnectCalendarInvite() {
  const t = useTranslations('calendar.connectInvite');
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6" data-testid="connect-calendar-invite">
      <Calendar className="h-12 w-12 text-primary" aria-hidden />
      <p className="text-title font-semibold text-foreground">{t('title')}</p>
      <p className="text-body text-muted-foreground max-w-md">{t('body')}</p>
      <Link
        href="/settings?section=integrations"
        className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-6 text-primary-foreground text-body font-medium min-h-[var(--ds-target-min)] hover:bg-primary/90"
      >
        {t('action')}
      </Link>
    </div>
  );
}
