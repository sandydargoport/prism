/**
 * ============================================================================
 * PRISM - Add Event Modal
 * ============================================================================
 *
 * A modal dialog for creating and editing calendar events.
 * Includes form fields for title, date/time, location, and settings.
 *
 * USAGE:
 *   <AddEventModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onEventCreated={(event) => console.log('Created:', event)}
 *   />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
 * Color options for events
 */
const COLOR_OPTIONS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EF4444', label: 'Red' },
  { value: '#14B8A6', label: 'Teal' },
];

/**
 * Reminder options (minutes before event)
 */
const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

/**
 * Format date for datetime-local input
 */
function formatDateTimeLocal(date: Date | string | undefined): string {
  if (!date) {
    // Return current time as fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    // Check if date is valid
    if (isNaN(d.getTime())) {
      throw new Error('Invalid date');
    }

    // Format: YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error, date);
    // Return current time as fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
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

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]?.value || '#3B82F6');
  const [reminderMinutes, setReminderMinutes] = useState<number | ''>('');

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (open && event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setStartTime(formatDateTimeLocal(event.startTime));
      setEndTime(formatDateTimeLocal(event.endTime));
      setAllDay(event.allDay || false);
      setRecurring(event.recurring || false);
      setRecurrenceRule(event.recurrenceRule || '');
      setColor(event.color || COLOR_OPTIONS[0]?.value || '#3B82F6');
      setReminderMinutes(event.reminderMinutes ?? '');
    } else if (open && defaultDate) {
      // Pre-fill with default date
      const start = new Date(defaultDate);
      start.setHours(9, 0, 0, 0); // Default to 9:00 AM
      const end = new Date(start);
      end.setHours(10, 0, 0, 0); // Default to 10:00 AM (1 hour)
      setStartTime(formatDateTimeLocal(start));
      setEndTime(formatDateTimeLocal(end));
    }
  }, [open, event, defaultDate]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setLocation('');
      setStartTime('');
      setEndTime('');
      setAllDay(false);
      setRecurring(false);
      setRecurrenceRule('');
      setColor(COLOR_OPTIONS[0]?.value || '#3B82F6');
      setReminderMinutes('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;

    // Validate end time is after start time
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end < start) {
      setError('End time must be after start time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        allDay,
        recurring,
        recurrenceRule: recurring && recurrenceRule.trim() ? recurrenceRule.trim() : undefined,
        color,
        reminderMinutes: reminderMinutes !== '' ? Number(reminderMinutes) : undefined,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Event' : 'Add Event'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update event details and timing.' : 'Create a new calendar event.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title..."
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details..."
              rows={3}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Event location..."
            />
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="event-start">Start Time</Label>
            <Input
              id="event-start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label htmlFor="event-end">End Time</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          {/* All Day */}
          <div className="flex items-center gap-2">
            <Switch
              id="event-all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
            <Label htmlFor="event-all-day" className="cursor-pointer">
              All-day event
            </Label>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="event-color">Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger id="event-color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: option.value }}
                      />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reminder */}
          <div className="space-y-2">
            <Label htmlFor="event-reminder">Reminder (optional)</Label>
            <Select
              value={reminderMinutes !== '' ? String(reminderMinutes) : ''}
              onValueChange={(value) => setReminderMinutes(value ? Number(value) : '')}
            >
              <SelectTrigger id="event-reminder">
                <SelectValue placeholder="No reminder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No reminder</SelectItem>
                {REMINDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-2">
            <Switch
              id="event-recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
            />
            <Label htmlFor="event-recurring" className="cursor-pointer">
              Recurring event
            </Label>
          </div>

          {/* Recurrence Rule (only show if recurring) */}
          {recurring && (
            <div className="space-y-2">
              <Label htmlFor="event-recurrence">Recurrence Rule</Label>
              <Input
                id="event-recurrence"
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                placeholder="e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR"
              />
              <p className="text-xs text-muted-foreground">
                Use iCalendar RRULE format
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !startTime || !endTime || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Add Event'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
