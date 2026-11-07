'use client';

/**
 * One event sheet (#836): the details of an event, opened by tapping it on
 * Today's arc, on the dashboard's calendar widget, or on the Calendar page.
 * It says the event as a sentence, then its notes, Hide in Prism (parents),
 * Delete, Close and Edit. Editing follows the household's PIN rule wherever
 * the sheet was opened.
 *
 * "Remind me" and "Leave by" are not here yet: nothing stores reminders or
 * travel times for the wall (#806).
 */
import { eventDotBackground } from '@/lib/calendar/sharedEvents';
import { useState } from 'react';
import { useAuth } from '@/components/providers';
import { useTranslations } from 'next-intl';
import { useDateLabels } from '@/lib/hooks/useDateLabels';
import { sanitizeEventDescription } from '@/lib/utils/eventDescriptionHtml';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useTimeFormat } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { eventStartDisplayDate, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { readResponseError } from '@/lib/utils/responseError';
import { parseEventId } from '@/lib/utils/occurrenceId';

/** "Thursday, 4 to 5:30, at Community Park"; "Saturday, all day". */
export function eventSentence(p: {
  day: string; start?: string; end?: string; location?: string;
  allDayLabel: string; to: string; at: string;
}): string {
  const when = p.start ? (p.end && p.end !== p.start ? `${p.start} ${p.to} ${p.end}` : p.start) : p.allDayLabel;
  return [p.day, when, p.location ? `${p.at} ${p.location}` : ''].filter(Boolean).join(', ');
}

export function EventSheet({ event, onClose, onEdit, onDeleted, canHide, onHiddenChange }: {
  event: { id: string; title: string; startTime: Date; endTime: Date; allDay: boolean; color: string; location?: string; description?: string; calendarName: string; inSeries?: boolean; alsoIds?: string[]; alsoCalendarNames?: string[]; alsoColors?: string[] };
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  /**
   * Show Hide in Prism: to a parent, and to anyone not signed in, who is asked
   * for a parent's PIN on the tap (#1048). The hide route refuses anyone else.
   */
  canHide: boolean;
  /** Called after a hide, and again after its Undo. */
  onHiddenChange: () => void;
}) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const t = useTranslations('calendar');
  const tActions = useTranslations('common.actions');
  const d = useDateLabels();
  const { confirm, dialogProps } = useConfirmDialog();
  const { activeUser, requireAuth } = useAuth();
  const [hiding, setHiding] = useState(false);
  // On an occurrence of a series, ticking the box first asks which to hide.
  const [choosingScope, setChoosingScope] = useState(false);

  // Hide in Prism (#592): applies at once, like the rest of the app, with an
  // Undo in the toast. The event stays in its source calendar.
  const handleHide = async (scope: 'event' | 'series') => {
    // Not signed in: the usual sign-in box, then the hide (#1048).
    const who = activeUser ?? await requireAuth(t('event.hideSignInTitle'), t('event.hideSignInBody'));
    if (!who) return;
    if (who.role !== 'parent') {
      toast({ title: t('event.hideParentsOnly'), variant: 'destructive' });
      return;
    }
    setHiding(true);
    try {
      // On a shared event, every copy (#1066), or the other shows in its place.
      const ids = [event.id, ...(event.alsoIds ?? [])];
      const responses = await Promise.all(ids.map((id) => fetch(
        `/api/events/${id}/hidden${scope === 'series' ? '?scope=series' : ''}`,
        { method: 'PUT' },
      )));
      const response = responses.find((r) => !r.ok) ?? responses[0]!;
      if (!response.ok) {
        const { message } = await readResponseError(response, t('errors.hideFailed'));
        toast({ title: message, variant: 'destructive' });
        setHiding(false);
        return;
      }
      const bodies = await Promise.all(responses.map((r) => r.json().catch(() => ({})) as Promise<{ seriesId?: string | null }>));
      const undoUrls = ids.map((id, i) => scope === 'series' && bodies[i]?.seriesId
        ? `/api/events/hidden-series/${bodies[i]!.seriesId}`
        : `/api/events/${id}/hidden`);
      onHiddenChange();
      toast({
        title: t(scope === 'series' ? 'event.hiddenSeriesToast' : 'event.hiddenToast', { title: event.title }),
        description: t('event.hiddenToastBody'),
        action: (
          <ToastAction
            altText={tActions('undo')}
            onClick={async () => {
              try {
                const undone = await Promise.all(undoUrls.map((u) => fetch(u, { method: 'DELETE' })));
                const bad = undone.find((r) => !r.ok);
                if (bad) throw new Error(String(bad.status));
                onHiddenChange();
              } catch { toast({ title: t('errors.unhideFailed'), variant: 'destructive' }); }
            }}
          >
            {tActions('undo')}
          </ToastAction>
        ),
      });
    } catch {
      toast({ title: t('errors.hideFailed'), variant: 'destructive' });
      setHiding(false);
    }
  };

  const handleDelete = async () => {
    // An occurrence of a series Prism keeps is deleted with its series.
    const wholeSeries = parseEventId(event.id).occurrenceStart !== null;
    const ok = await confirm(
      t('event.deleteConfirmTitle'),
      t(wholeSeries ? 'event.deleteSeriesConfirmBody' : 'event.deleteConfirmBody'),
    );
    if (!ok) return;
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!response.ok) {
        // Same reason as the save path: .json() on an HTML error page threw a
        // parser complaint that replaced the real status.
        const { message } = await readResponseError(response, t('errors.deleteFailed'));
        toast({ title: message, variant: 'destructive' });
        return;
      }
      onDeleted();
    } catch { toast({ title: t('errors.deleteFailed'), variant: 'destructive' }); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" data-event-sheet>
        {/* The person's colour dot in front of the title, as everywhere an event is named. */}
        <DialogTitle className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: eventDotBackground(event) }} aria-hidden data-event-mark />
          <span>{event.title}</span>
        </DialogTitle>
        {/* When, and where, as a sentence (#836): "Thursday, 4 to 5:30, at Community Park". */}
        <DialogDescription className="text-body text-foreground" data-event-sentence>
          {eventSentence({
            day: event.allDay
              ? d.weekdayLongMonthDay(eventStartDisplayDate(event.startTime, true))
              : d.weekdayLongMonthDay(toDisplayDate(event.startTime, displayTimezone)),
            start: event.allDay ? undefined : formatBareTime(event.startTime, timeFormat, displayTimezone),
            end: event.allDay ? undefined : formatBareTime(event.endTime, timeFormat, displayTimezone),
            location: event.location,
            allDayLabel: t('event.allDay'),
            to: t('event.to'),
            at: t('event.at'),
          })}
        </DialogDescription>
        {/*
          Descriptions arrive as HTML from Google ("<b>BOLD</b>" and the like),
          so they are rendered rather than printed as tags. The source is an
          external calendar, which makes it untrusted markup: see
          sanitizeEventDescription for what survives the allowlist.

          Capped in height with its own scroll: some events carry a whole
          meeting agenda, and the modal should not grow to fit one.
        */}
        {event.description && (
          <div
            className="mb-4 max-h-40 overflow-y-auto rounded border border-border/50 bg-muted/30 px-2 py-1.5 text-sm text-foreground [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-1"
            dangerouslySetInnerHTML={{ __html: sanitizeEventDescription(event.description) }}
          />
        )}
        <p className="text-xs text-muted-foreground" data-event-calendars>{[event.calendarName, ...(event.alsoCalendarNames ?? [])].join(', ')}</p>
        {canHide && (
          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <Checkbox
              checked={hiding || choosingScope}
              disabled={hiding}
              onCheckedChange={(checked) => {
                if (checked !== true) setChoosingScope(false);
                else if (event.inSeries) setChoosingScope(true);
                else handleHide('event');
              }}
            />
            <span className="text-sm">
              <span className="block font-medium">{t('event.hideInPrism')}</span>
              <span className="block text-muted-foreground">{t('event.hideInPrismHint')}</span>
            </span>
          </label>
        )}
        {canHide && choosingScope && (
          <div className="flex flex-wrap gap-2 mt-3 ml-9">
            <Button size="sm" variant="outline" disabled={hiding} onClick={() => handleHide('event')}>
              {t('event.hideThisEvent')}
            </Button>
            <Button size="sm" variant="outline" disabled={hiding} onClick={() => handleHide('series')}>
              {t('event.hideWholeSeries')}
            </Button>
          </div>
        )}
        <div className="flex justify-between mt-6">
          <Button variant="destructive" onClick={handleDelete}>
            {tActions('delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{tActions('close')}</Button>
            <Button onClick={onEdit}>{tActions('edit')}</Button>
          </div>
        </div>
      </DialogContent>
      <ConfirmDialog {...dialogProps} />
    </Dialog>
  );
}

