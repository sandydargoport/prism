'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { MapPin, Star, Globe, TreePine } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { WidgetContainer } from './WidgetContainer';
import { STATUS_CONFIG, NPS_COLOR } from '@/app/travel/types';
import type { TravelPin } from '@/app/travel/types';

export interface TravelWidgetProps {
  className?: string;
}

function useWidgetTravelData() {
  const [pins, setPins] = useState<TravelPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/travel/pins')
      .then((r) => r.ok ? r.json() : { pins: [] })
      .then((data) => setPins(data.pins ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { pins, loading };
}

export const TravelWidget = React.memo(function TravelWidget({ className }: TravelWidgetProps) {
  const { pins, loading } = useWidgetTravelData();

  const rootPins = pins.filter((p) => !p.parentId);
  const visited = rootPins.filter((p) => p.status === 'been_there');
  const wantToGo = rootPins.filter((p) => p.status === 'want_to_go');
  const bucketList = rootPins.filter((p) => p.isBucketList);

  // Count unique countries from placeName (last comma-separated part)
  const countries = new Set(
    rootPins
      .map((p) => p.placeName?.split(',').at(-1)?.trim())
      .filter(Boolean)
  ).size;

  // Count total national park children
  const npCount = pins.filter((p) => p.pinType === 'national_park').length;

  // Recent trips: last 4 visited, sorted by visitedDate desc
  const recentTrips = [...visited]
    .sort((a, b) => (b.visitedDate ?? '').localeCompare(a.visitedDate ?? ''))
    .slice(0, 4);

  return (
    <WidgetContainer
      title="Travel"
      icon="Globe"
      titleHref="/travel"
      loading={loading}
      className={className}
    >
      {rootPins.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
          <Globe className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No places yet</p>
          <a href="/travel" className="text-xs text-primary hover:underline">Open the map →</a>
        </div>
      ) : (
        <div className="flex flex-col h-full p-2 gap-2 overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-1.5 shrink-0">
            <StatChip
              icon={<span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG.been_there.color }} />}
              value={visited.length}
              label="visited"
            />
            <StatChip
              icon={<span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG.want_to_go.color }} />}
              value={wantToGo.length}
              label="want to go"
            />
            {countries > 0 && (
              <StatChip
                icon={<Globe className="h-3 w-3 text-muted-foreground shrink-0" />}
                value={countries}
                label={countries === 1 ? 'country' : 'countries'}
              />
            )}
            {bucketList.length > 0 && (
              <StatChip
                icon={<Star className="h-3 w-3 fill-amber-500 text-warning shrink-0" />}
                value={bucketList.length}
                label="bucket list"
              />
            )}
            {npCount > 0 && (
              <StatChip
                icon={<TreePine className="h-3 w-3 shrink-0" style={{ color: NPS_COLOR }} />}
                value={npCount}
                label={npCount === 1 ? 'nat. park' : 'nat. parks'}
              />
            )}
          </div>

          {/* Recent trips */}
          {recentTrips.length > 0 && (
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 px-0.5">
                Recent trips
              </p>
              <ul className="space-y-1">
                {recentTrips.map((pin) => (
                  <li key={pin.id}>
                    <a
                      href="/travel"
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/60 transition-colors group"
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: pin.color || STATUS_CONFIG.been_there.color }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{pin.name}</span>
                        {pin.visitedDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {pin.visitedEndDate
                              ? `${format(parseISO(pin.visitedDate), 'MMM d')}–${format(parseISO(pin.visitedEndDate), 'MMM d, yyyy')}`
                              : format(parseISO(pin.visitedDate), 'MMM yyyy')}
                          </span>
                        )}
                      </span>
                      {pin.isBucketList && (
                        <Star className="h-3 w-3 fill-amber-500 text-warning shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
});

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
      {icon}
      <span className="text-xs">
        <strong className="font-semibold">{value}</strong>
        <span className="text-muted-foreground ml-1">{label}</span>
      </span>
    </div>
  );
}
