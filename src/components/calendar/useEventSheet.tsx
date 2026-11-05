'use client';

/**
 * The event sheet and its Edit and Add forms, for screens that show events
 * without the Calendar page around them (the dashboard and Today, #836).
 */
import { useState, type ReactNode } from 'react';
import type { CalendarEvent } from '@/types/calendar';
import { useAuth } from '@/components/providers';
import { AddEventModal } from '@/components/modals';
import { EventSheet } from './EventSheet';

/** An event as the Add Event form edits it. */
export function toEditableEvent(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: e.allDay,
    color: e.color,
    recurring: e.recurring ?? false,
    recurrenceRule: e.recurrenceRule ?? undefined,
    reminderMinutes: e.reminderMinutes ?? undefined,
    calendarSourceId: e.calendarId !== 'local' ? e.calendarId : undefined,
  };
}

export function useEventSheet(onChanged: () => void): {
  open: (event: CalendarEvent) => void;
  add: (day: Date) => void;
  element: ReactNode;
} {
  const { activeUser } = useAuth();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [addingOn, setAddingOn] = useState<Date | null>(null);

  const element = (
    <>
      {selected && (
        <EventSheet
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null); }}
          onDeleted={() => { setSelected(null); onChanged(); }}
          canHide={activeUser?.role === 'parent'}
          onHiddenChange={() => { setSelected(null); onChanged(); }}
        />
      )}
      {(editing || addingOn) && (
        <AddEventModal
          open
          onOpenChange={(open) => { if (!open) { setEditing(null); setAddingOn(null); } }}
          event={editing ? toEditableEvent(editing) : undefined}
          defaultDate={addingOn ?? undefined}
          onEventCreated={() => { setEditing(null); setAddingOn(null); onChanged(); }}
        />
      )}
    </>
  );
  return { open: setSelected, add: setAddingOn, element };
}
