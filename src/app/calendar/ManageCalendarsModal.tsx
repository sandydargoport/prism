'use client';

/**
 * "Manage calendars" overlay — opens from the Calendar page so calendar
 * configuration lives *with* the calendar (the same "config where the entity
 * lives" pattern as recipe sync on the Recipes page), instead of buried in
 * Settings. Reuses the existing CalendarsSection verbatim (connected calendars,
 * groups, hours, iCal subscriptions).
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarsSection } from '@/app/settings/sections/CalendarsSection';

export function ManageCalendarsModal({
  onClose,
  onSynced,
}: {
  onClose: () => void;
  /** Called after a manual sync so the calendar page can refetch its events. */
  onSynced?: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage calendars</DialogTitle>
        </DialogHeader>
        <CalendarsSection onSynced={onSynced} />
      </DialogContent>
    </Dialog>
  );
}
