'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Plus,
  Home,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AddEventModal } from '@/components/modals';
import { PageWrapper } from '@/components/layout';
import { MonthView, WeekView, TwoWeekView, ThreeMonthView, DayViewSideBySide } from '@/components/calendar';
import { useCalendarViewData } from './useCalendarViewData';

export function CalendarView() {
  const {
    currentDate, setCurrentDate,
    viewType, setViewType,
    selectedEvent, setSelectedEvent,
    showAddEvent, setShowAddEvent,
    editingEvent, setEditingEvent,
    selectedCalendarIds,
    calendarGroups,
    toggleCalendar,
    events, loading, error, refreshEvents,
    goToToday, goToPrevious, goToNext, getDateRangeTitle,
  } = useCalendarViewData();

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">{getDateRangeTitle()}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={goToPrevious} aria-label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNext} aria-label="Next">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center border rounded-md">
                <Button variant={viewType === 'day' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewType('day')} className="rounded-r-none">
                  <CalendarDays className="h-4 w-4 mr-1" />Day
                </Button>
                <Button variant={viewType === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewType('week')} className="rounded-none border-x">
                  <CalendarRange className="h-4 w-4 mr-1" />Week
                </Button>
                <Button variant={viewType === 'twoWeek' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewType('twoWeek')} className="rounded-none border-r">
                  <CalendarRange className="h-4 w-4 mr-1" />2 Weeks
                </Button>
                <Button variant={viewType === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewType('month')} className="rounded-none border-r">
                  <LayoutGrid className="h-4 w-4 mr-1" />Month
                </Button>
                <Button variant={viewType === 'threeMonth' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewType('threeMonth')} className="rounded-l-none">
                  <LayoutGrid className="h-4 w-4 mr-1" />3 Mo
                </Button>
              </div>
              <Button size="sm" onClick={() => setShowAddEvent(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Event
              </Button>
            </div>
          </div>

          {calendarGroups.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Show:</span>
              <button
                onClick={() => toggleCalendar('all')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors leading-none',
                  selectedCalendarIds.has('all')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                All
              </button>
              {calendarGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => toggleCalendar(group.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 leading-none',
                    selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                  style={
                    selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
                      ? { backgroundColor: group.color }
                      : undefined
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full border border-white/60 dark:border-white/80"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-hidden p-4">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="h-full flex items-center justify-center">
              <p className="text-destructive">Failed to load calendar: {error}</p>
            </div>
          )}
          {!loading && !error && viewType === 'month' && (
            <MonthView currentDate={currentDate} events={events} onEventClick={setSelectedEvent}
              onDateClick={(date) => { setCurrentDate(date); setViewType('day'); }} />
          )}
          {!loading && !error && viewType === 'week' && (
            <WeekView currentDate={currentDate} events={events} onEventClick={setSelectedEvent} />
          )}
          {!loading && !error && viewType === 'twoWeek' && (
            <TwoWeekView currentDate={currentDate} events={events} onEventClick={setSelectedEvent} />
          )}
          {!loading && !error && viewType === 'threeMonth' && (
            <ThreeMonthView currentDate={currentDate} events={events} onEventClick={setSelectedEvent}
              onDateClick={(date) => { setCurrentDate(date); setViewType('month'); }} />
          )}
          {!loading && !error && viewType === 'day' && (
            <DayViewSideBySide currentDate={currentDate} events={events} calendarGroups={calendarGroups} onEventClick={setSelectedEvent} />
          )}
        </div>

        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onEdit={() => { setEditingEvent(selectedEvent); setSelectedEvent(null); }}
            onDeleted={() => { setSelectedEvent(null); refreshEvents(); }}
          />
        )}

        <AddEventModal
          open={showAddEvent || editingEvent !== null}
          onOpenChange={(open) => { if (!open) { setShowAddEvent(false); setEditingEvent(null); } }}
          event={editingEvent ? {
            id: editingEvent.id,
            title: editingEvent.title,
            description: editingEvent.description,
            location: editingEvent.location,
            startTime: editingEvent.startTime,
            endTime: editingEvent.endTime,
            allDay: editingEvent.allDay,
            color: editingEvent.color,
            recurring: false,
            recurrenceRule: undefined,
            reminderMinutes: undefined,
            calendarSourceId: editingEvent.calendarId !== 'local' ? editingEvent.calendarId : undefined,
          } : undefined}
          onEventCreated={() => { refreshEvents(); setShowAddEvent(false); setEditingEvent(null); }}
        />
      </div>
    </PageWrapper>
  );
}


function EventDetailModal({ event, onClose, onEdit, onDeleted }: {
  event: { id: string; title: string; startTime: Date; endTime: Date; allDay: boolean; color: string; location?: string; calendarName: string };
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="w-full h-2 rounded-t-lg -mt-6 -mx-6 mb-4" style={{ backgroundColor: event.color }} />
        <h2 className="text-xl font-bold mb-2">{event.title}</h2>
        <p className="text-sm text-muted-foreground mb-1">
          {event.allDay
            ? format(event.startTime, 'EEEE, MMMM d')
            : `${format(event.startTime, 'EEEE, MMMM d')} at ${format(event.startTime, 'h:mm a')}`}
        </p>
        {event.location && <p className="text-sm text-muted-foreground mb-4">{event.location}</p>}
        <p className="text-xs text-muted-foreground">{event.calendarName}</p>
        <div className="flex justify-between mt-6">
          <Button
            variant="destructive"
            onClick={async () => {
              if (!confirm('Are you sure you want to delete this event?')) return;
              try {
                const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
                if (!response.ok) {
                  const err = await response.json();
                  alert(err.error || 'Failed to delete event');
                  return;
                }
                onDeleted();
              } catch { alert('Failed to delete event'); }
            }}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={onEdit}>Edit</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
