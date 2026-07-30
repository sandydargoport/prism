'use client';

import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WeekendPlaceCard } from './WeekendPlaceCard';
import { TAG_PRESETS } from '../constants';
import type { WeekendPlace } from '../types';

interface WeekendPlaceGridProps {
  places: WeekendPlace[];
  selectedId: string | null;
  onSelect: (place: WeekendPlace) => void;
  /** True when `places` (the filtered list) is empty only because of an
   *  active search/filter, not because there are no places at all — in
   *  that case we don't show the "add your first place" CTA. */
  hasUnfilteredPlaces?: boolean;
  onAdd?: () => void;
}

const TAG_ORDER = TAG_PRESETS.map(t => t.value as string);

function groupByTag(places: WeekendPlace[]) {
  const tagMap = new Map<string, WeekendPlace[]>(TAG_ORDER.map(t => [t, []]));
  const untagged: WeekendPlace[] = [];

  for (const place of places) {
    const firstKnownTag = place.tags.find(t => TAG_ORDER.includes(t));
    if (firstKnownTag) {
      tagMap.get(firstKnownTag)!.push(place);
    } else {
      untagged.push(place);
    }
  }

  const groups: { key: string; label: string; emoji: string; places: WeekendPlace[] }[] = [];
  for (const preset of TAG_PRESETS) {
    const items = tagMap.get(preset.value)!;
    if (items.length > 0) groups.push({ key: preset.value, label: preset.label, emoji: preset.emoji, places: items });
  }
  if (untagged.length > 0) groups.push({ key: '__untagged', label: 'Other', emoji: '📍', places: untagged });
  return groups;
}

export function WeekendPlaceGrid({ places, selectedId, onSelect, hasUnfilteredPlaces, onAdd }: WeekendPlaceGridProps) {
  if (places.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={<Compass />}
          title={hasUnfilteredPlaces ? 'No places match your filters' : 'No places yet'}
          action={!hasUnfilteredPlaces && onAdd ? (
            <Button variant="outline" size="sm" onClick={onAdd}>Add your first place</Button>
          ) : undefined}
        />
      </div>
    );
  }

  const groups = groupByTag(places);

  if (groups.length === 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start p-1">
        {places.map((place) => (
          <WeekendPlaceCard key={place.id} place={place} selected={place.id === selectedId} onClick={() => onSelect(place)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {groups.map(group => (
        <div key={group.key}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{group.emoji}</span>
            <span>{group.label}</span>
            <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">({group.places.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.places.map((place) => (
              <WeekendPlaceCard key={place.id} place={place} selected={place.id === selectedId} onClick={() => onSelect(place)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
