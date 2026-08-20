/**
 *
 * A modal dialog for creating and editing calendar events.
 * Simplified design inspired by Google Calendar's quick-add modal.
 *
 * USAGE:
 *   <AddEventModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onEventCreated={(event) => console.log('Created:', event)}
 *   />
 *
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, MapPin, AlignLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCalendarSources } from '@/lib/hooks';
import { useAuth, useTimeFormat } from '@/components/providers';
import { fromDisplayDateTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { toast } from '@/components/ui/use-toast';
import { TimeDropdown } from './TimeDropdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui';

/**
 * Event data returned after creation
 */
export interface CreatedEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule: string | null;
  color: string | null;
  reminderMinutes: number | null;
}

/**
 * Event data for editing
 */
export interface EventToEdit {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date | string;
  endTime: Date | string;
  allDay?: boolean;
  recurring?: boolean;
  recurrenceRule?: string;
  color?: string;
  reminderMinutes?: number;
  calendarSourceId?: string;
}

/**
 * AddEventModal Props
 */
export interface AddEventModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when event is successfully created or updated */
  onEventCreated?: (event: CreatedEvent) => void;
  /** Event to edit (if provided, modal is in edit mode) */
  event?: EventToEdit;
  /** Pre-fill start date when creating */
  defaultDate?: Date;
}

/**
 * Recurrence presets
 */
const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
  { value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: 'Every weekday' },
  { value: 'FREQ=MONTHLY', label: 'Monthly' },
  { value: 'FREQ=YEARLY', label: 'Yearly' },
];

/**
 * Reminder options (minutes before event)
 */
const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

/** Format date for datetime-local input (YYYY-MM-DDTHH:mm) */
function formatDateTimeLocal(date: Date | string | undefined, timeZone?: string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  if (isNaN(d.getTime())) return formatDateTimeLocal(undefined, timeZone);
  const displayDate = toDisplayDate(d, timeZone);
  const year = displayDate.getFullYear();
  const month = String(displayDate.getMonth() + 1).padStart(2, '0');
  const day = String(displayDate.getDate()).padStart(2, '0');
  const hours = String(displayDate.getHours()).padStart(2, '0');
  const minutes = String(displayDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Format date for date input (YYYY-MM-DD) */
function formatDateLocal(date: Date | string | undefined, timeZone?: string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  if (isNaN(d.getTime())) return formatDateLocal(undefined, timeZone);
  const displayDate = toDisplayDate(d, timeZone);
  const year = displayDate.getFullYear();
  const month = String(displayDate.getMonth() + 1).padStart(2, '0');
  const day = String(displayDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ADD EVENT MODAL COMPONENT
 */
export function AddEventModal({
  open,
  onOpenChange,
  onEventCreated,
  event,
  defaultDate,
}: AddEventModalProps) {
  const isEditMode = !!event;

  // Fetch available calendars
  const { calendars } = useCalendarSources();
  const { activeUser } = useAuth();
  const { displayTimezone } = useTimeFormat();

  // Filter to only writable, non-read-only calendars with showInEventModal enabled
  const writableCalendars = useMemo(() => {
    return calendars.filter(
      (cal) => cal.enabled &&
               (cal.provider === 'google' || cal.provider === 'local') &&
               cal.showInEventModal !== false
    );
  }, [calendars]);

  // Default target for a new event: the logged-in member's own calendar, so an
  // event they add is assigned to them without a manual pick. Fall back to the
  // shared Family calendar, then any writable calendar, then the anonymous
  // "Local only" bucket if nothing else exists.
  const defaultCalendarId = useMemo(() => {
    if (activeUser?.id) {
      const mine = writableCalendars.find((c) => c.user?.id === activeUser.id);
      if (mine) return mine.id;
    }
    const family = writableCalendars.find((c) => c.isFamily);
    if (family) return family.id;
    return writableCalendars.length > 0 ? writableCalendars[0]!.id : '';
  }, [writableCalendars, activeUser]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');    // YYYY-MM-DD
  const [startTimeStr, setStartTimeStr] = useState(''); // HH:MM
  const [endDate, setEndDate] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | ''>('');
  const [calendarSourceId, setCalendarSourceId] = useState<string>('');
  const [showMore, setShowMore] = useState(false);

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve color from selected calendar's group
  const selectedCalendar = useMemo(() => {
    return writableCalendars.find((c) => c.id === calendarSourceId) ?? null;
  }, [calendarSourceId, writableCalendars]);

  const eventColor = useMemo(() => {
    if (!selectedCalendar) return undefined;
    // Priority: group color > calendar source color > user color
    return selectedCalendar.groupColor || selectedCalendar.color || selectedCalendar.user?.color || undefined;
  }, [selectedCalendar]);

  function addHour(hhmm: string, hrs = 1): string {
    const [h, m] = hhmm.split(':').map(Number);
    const total = (h! * 60 + m! + hrs * 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function handleStartTimeChange(time: string) {
    setStartTimeStr(time);
    // If end is same day and no longer after start, bump it
    if (startDate === endDate) {
      if (!endTimeStr || endTimeStr <= time) {
        setEndTimeStr(addHour(time));
      }
    }
  }

  function handleStartDateChange(date: string) {
    setStartDate(date);
    if (!endDate || endDate < date) setEndDate(date);
  }

  function handleAllDayChange(checked: boolean) {
    setAllDay(checked);
    if (!checked && !startTimeStr) {
      setStartTimeStr('09:00');
      setEndTimeStr('10:00');
    }
  }

  // Populate form when opening
  useEffect(() => {
    if (open && event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      const isAllDay = event.allDay || false;
      setAllDay(isAllDay);
      const sd = formatDateLocal(event.startTime, displayTimezone);
      const ed = formatDateLocal(event.endTime, displayTimezone);
      setStartDate(sd);
      setEndDate(ed);
      if (!isAllDay) {
        const s = formatDateTimeLocal(event.startTime, displayTimezone);
        const e = formatDateTimeLocal(event.endTime, displayTimezone);
        setStartTimeStr(s.split('T')[1] ?? '09:00');
        setEndTimeStr(e.split('T')[1] ?? '10:00');
      } else {
        setStartTimeStr('');
        setEndTimeStr('');
      }
      setRecurrenceRule(event.recurrenceRule || '');
      setReminderMinutes(event.reminderMinutes ?? '');
      setCalendarSourceId(event.calendarSourceId || defaultCalendarId);
      setShowMore(!!(event.description || event.location || event.reminderMinutes || event.recurrenceRule));
    } else if (open && defaultDate) {
      // Calendar cells are already presentation-only wall dates.
      const d = format(defaultDate, 'yyyy-MM-dd');
      setStartDate(d);
      setEndDate(d);
      setStartTimeStr('09:00');
      setEndTimeStr('10:00');
    } else if (open) {
      const today = formatDateLocal(new Date(), displayTimezone);
      setStartDate(today);
      setEndDate(today);
      setStartTimeStr('09:00');
      setEndTimeStr('10:00');
    }
    if (open && !event) setCalendarSourceId(defaultCalendarId);
  }, [open, event, defaultDate, defaultCalendarId, displayTimezone]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setLocation('');
      setStartDate(''); setStartTimeStr(''); setEndDate(''); setEndTimeStr('');
      setAllDay(false); setRecurrenceRule(''); setReminderMinutes('');
      setCalendarSourceId(defaultCalendarId); setShowMore(false); setError(null);
    }
  }, [open, defaultCalendarId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !startDate || !endDate) return;
    if (!allDay && (!startTimeStr || !endTimeStr)) return;

    const startISO = fromDisplayDateTime(
      startDate,
      allDay ? '00:00:00' : startTimeStr,
      displayTimezone,
    ).toISOString();
    const endISO = fromDisplayDateTime(
      endDate,
      allDay ? '23:59:59' : endTimeStr,
      displayTimezone,
    ).toISOString();

    if (new Date(endISO) < new Date(startISO)) {
      setError('End must be after start');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const recurring = !!recurrenceRule;
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: startISO,
        endTime: endISO,
        allDay,
        recurring,
        recurrenceRule: recurring ? recurrenceRule : undefined,
        reminderMinutes: reminderMinutes !== '' ? Number(reminderMinutes) : undefined,
        calendarSourceId: calendarSourceId || undefined,
        color: eventColor || undefined,
      };

      const url = isEditMode ? `/api/events/${event.id}` : '/api/events';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save event');
      }

      const savedEvent = await response.json();

      if (savedEvent.warning) {
        toast({
          title: 'Event saved locally',
          description: savedEvent.warning,
          variant: 'warning',
        });
      }

      if (onEventCreated) {
        onEventCreated(savedEvent);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save event:', err);
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode ? 'Update event details.' : 'Create a new calendar event.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className="text-base border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            autoFocus
            required
          />

          {/* Date & Time — Google Calendar style */}
          <div className="flex items-center gap-1 flex-wrap -mx-1 px-1 py-1 rounded-lg hover:bg-muted/40 transition-colors">
            {/* Start date */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.showPicker?.()}
                className="h-8 px-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
              >
                {startDate ? format(parseISO(startDate + 'T00:00:00'), 'EEE, MMM d') : 'Start date'}
              </button>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
                required
              />
            </div>

            {/* Start time (hidden when all-day) */}
            {!allDay && (
              <TimeDropdown value={startTimeStr} onChange={handleStartTimeChange} />
            )}

            <span className="text-muted-foreground text-sm px-0.5">–</span>

            {/* End date (only shown when different from start) */}
            {endDate !== startDate && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.showPicker?.()}
                  className="h-8 px-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
                >
                  {endDate ? format(parseISO(endDate + 'T00:00:00'), 'EEE, MMM d') : 'End date'}
                </button>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
              </div>
            )}

            {/* End time (hidden when all-day) */}
            {!allDay && (
              <TimeDropdown
                value={endTimeStr}
                onChange={setEndTimeStr}
                minTime={startDate === endDate ? startTimeStr : undefined}
              />
            )}

            {/* All day toggle */}
            <div className="flex items-center gap-1.5 ml-1">
              <Switch id="event-all-day" checked={allDay} onCheckedChange={handleAllDayChange} />
              <Label htmlFor="event-all-day" className="text-sm cursor-pointer select-none">All day</Label>
            </div>

            {/* End date selector when all-day and same date (show explicit end date control) */}
            {allDay && endDate === startDate && (
              <div className="relative ml-0">
                <button
                  type="button"
                  onClick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.showPicker?.()}
                  className="h-8 px-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap text-muted-foreground"
                >
                  {endDate ? format(parseISO(endDate + 'T00:00:00'), 'EEE, MMM d') : 'End date'}
                </button>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Calendar Selection */}
          <Select value={calendarSourceId} onValueChange={setCalendarSourceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a calendar" />
            </SelectTrigger>
            <SelectContent>
              {writableCalendars.map((cal) => (
                <SelectItem key={cal.id} value={cal.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cal.groupColor || cal.color || '#3B82F6' }}
                    />
                    <span className="truncate">{cal.displayName || cal.dashboardCalendarName}</span>
                    {cal.groupName && cal.groupName !== (cal.displayName || cal.dashboardCalendarName) && (
                      <span
                        className="text-xs font-medium shrink-0 px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (cal.groupColor || '#3B82F6') + '20',
                          color: cal.groupColor || '#3B82F6',
                        }}
                      >
                        {cal.groupName}
                      </span>
                    )}
                    {cal.provider === 'google' && (
                      <span className="text-xs text-muted-foreground shrink-0">Google</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sync-behavior hint. Local is the default and needs no label; the
              only thing worth clarifying is that connected accounts push
              outward — and only once such an account actually exists. */}
          {writableCalendars.some((c) => c.provider === 'google') && (
            <p className="text-xs text-muted-foreground">
              Local calendars stay on this dashboard. Connected calendars (like Google) sync both ways.
            </p>
          )}

          {/* More options toggle */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showMore ? 'Less options' : 'More options'}
          </button>

          {showMore && (
            <div className="space-y-3">
              {/* Location */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                  className="flex-1"
                />
              </div>

              {/* Description */}
              <div className="flex items-start gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground shrink-0 mt-2.5" />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  rows={2}
                  className="flex-1"
                />
              </div>

              {/* Recurrence */}
              <Select
                value={recurrenceRule || '__none__'}
                onValueChange={(v) => setRecurrenceRule(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Does not repeat" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || '__none__'} value={opt.value || '__none__'}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Reminder */}
              <Select
                value={reminderMinutes !== '' ? String(reminderMinutes) : 'none'}
                onValueChange={(value) => setReminderMinutes(value === 'none' ? '' : Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No reminder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reminder</SelectItem>
                  {REMINDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !startDate || !endDate || (!allDay && (!startTimeStr || !endTimeStr)) || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditMode ? 'Save' : 'Save'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
