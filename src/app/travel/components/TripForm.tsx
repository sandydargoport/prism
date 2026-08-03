'use client';

import * as React from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TravelTrip, TripStyle } from '../types';
import { TRIP_STYLE_CONFIG } from '../types';

interface TripFormProps {
  initialData?: Partial<TravelTrip>;
  hideHeader?: boolean;
  onSave: (data: Omit<TravelTrip, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'stops'>) => Promise<void>;
  onCancel: () => void;
}

export function TripForm({ initialData, hideHeader, onSave, onCancel }: TripFormProps) {
  const [name, setName] = React.useState(initialData?.name ?? '');
  const [description, setDescription] = React.useState(initialData?.description ?? '');
  const [tripStyle, setTripStyle] = React.useState<TripStyle>(initialData?.tripStyle ?? 'route');
  const [status, setStatus] = React.useState<'want_to_go' | 'been_there'>(initialData?.status ?? 'want_to_go');
  const [visitedDate, setVisitedDate] = React.useState(initialData?.visitedDate ?? '');
  const [visitedEndDate, setVisitedEndDate] = React.useState(initialData?.visitedEndDate ?? '');
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        tripStyle,
        status,
        isBucketList: false,
        color: null,
        emoji: null,
        visitedDate: visitedDate || null,
        visitedEndDate: visitedEndDate || null,
        year: visitedDate ? new Date(visitedDate).getFullYear() : null,
        memberIds: [],
        tags: [],
        sortOrder: 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">{initialData?.id ? 'Edit Trip' : 'New Trip'}</h2>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trip Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pacific Coast Road Trip"
            className="text-sm"
            autoFocus
            required
          />
        </div>

        {/* Trip style */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trip Style</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(TRIP_STYLE_CONFIG) as [TripStyle, typeof TRIP_STYLE_CONFIG[TripStyle]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTripStyle(key)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors',
                  tripStyle === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                )}
              >
                <span className="text-lg leading-none">{cfg.icon}</span>
                <span className="text-xs font-medium">{cfg.label}</span>
                <span className="text-[10px] leading-snug opacity-75">{cfg.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          <div className="flex gap-2">
            {(['want_to_go', 'been_there'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors',
                  status === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {s === 'been_there' ? '✓ Been There' : <><Emoji e="📍" /> Want to Go</>}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {status === 'been_there' ? 'Trip Dates' : 'Planned Dates'}
          </label>
          <div className="flex items-center gap-2">
            <Input type="date" value={visitedDate} onChange={(e) => setVisitedDate(e.target.value)} className="text-sm flex-1" />
            <span className="text-muted-foreground text-xs shrink-0">to</span>
            <Input type="date" value={visitedEndDate} onChange={(e) => setVisitedEndDate(e.target.value)} className="text-sm flex-1" min={visitedDate} />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Trip notes, highlights, memories…"
            className="text-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 text-sm">Cancel</Button>
        <Button type="submit" disabled={saving || !name.trim()} className="flex-1 text-sm">
          {saving ? 'Saving…' : initialData?.id ? 'Save Changes' : 'Create Trip'}
        </Button>
      </div>
    </form>
  );
}
