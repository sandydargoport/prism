'use client';

/**
 * More > This phone > Cards (#1354): which cards this phone shows, and as rows
 * or tiles. Both are kept in this phone's browser. The dashboard behind it
 * changes as you tap, so Done only closes the sheet.
 */
import { Eye, EyeOff, LayoutDashboard, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { MobileLayoutMode } from '@/lib/hooks/useMobileLayout';

export const PHONE_CARDS: { id: string; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'clock', label: 'Clock' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'busTracking', label: 'Bus Tracker' },
  { id: 'chores', label: 'Chores' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'meals', label: 'Meals' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'messages', label: 'Messages' },
  { id: 'birthdays', label: 'Birthdays' },
  { id: 'points', label: 'Goals' },
  { id: 'wishes', label: 'Wishes' },
  { id: 'photos', label: 'Photos' },
];

export function PhoneCardsSheet({ open, onOpenChange, hidden, onToggle, layout, onLayout }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden: string[];
  onToggle: (id: string) => void;
  layout: MobileLayoutMode;
  onLayout: (mode: MobileLayoutMode) => void;
}) {
  const choice = (on: boolean) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
    on ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-accent',
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-4 pt-6" data-phone-cards>
        <div className="flex items-center justify-between pr-12">
          <DialogTitle className="text-base">Cards</DialogTitle>
          <button type="button" onClick={() => onOpenChange(false)} className="text-sm font-medium text-primary" data-phone-cards-done>
            Done
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">Layout</span>
          <div className="flex items-center overflow-hidden rounded-md border text-xs">
            <button type="button" onClick={() => onLayout('rows')} className={choice(layout === 'rows')} aria-pressed={layout === 'rows'}>
              <Rows3 className="h-3.5 w-3.5" />
              Rows
            </button>
            <button type="button" onClick={() => onLayout('tiles')} className={cn(choice(layout === 'tiles'), 'border-l')} aria-pressed={layout === 'tiles'}>
              <LayoutDashboard className="h-3.5 w-3.5" />
              Tiles
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Choose which cards this phone shows.</p>
        <div className="space-y-1">
          {PHONE_CARDS.map((card) => {
            const off = hidden.includes(card.id);
            return (
              <button
                type="button"
                key={card.id}
                onClick={() => onToggle(card.id)}
                aria-pressed={!off}
                data-phone-card={card.id}
                className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-accent"
              >
                <span className={cn('text-sm font-medium', off && 'text-muted-foreground')}>{card.label}</span>
                {off ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
