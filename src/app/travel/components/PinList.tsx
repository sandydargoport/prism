'use client';

import { format, parseISO } from 'date-fns';
import { Emoji } from '@/components/ui/Emoji';
import { Plus, MapPin, Star, Search, Globe as GlobeIcon, Calendar, TreePine, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TravelPin, TravelTrip } from '../types';
import { STATUS_CONFIG, TRIP_STYLE_CONFIG, NPS_COLOR } from '../types';
import { usePinListFilter, type FilterTab, type GroupBy } from '../utils/usePinListFilter';

const FILTER_TABS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: 'All' },
  { key: 'been_there', label: 'Been There' },
  { key: 'want_to_go', label: 'Want to Go' },
  { key: 'bucket_list', label: 'Bucket List', icon: <Star className="h-3 w-3" /> },
  { key: 'has_national_park', label: 'Has NP', icon: <TreePine className="h-3 w-3" style={{ color: NPS_COLOR }} /> },
];

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'year', label: 'Year' },
  { key: 'country', label: 'Country' },
  { key: 'none', label: 'None' },
];

interface PinListProps {
  pins: TravelPin[];
  trips: TravelTrip[];
  tripStops: TravelPin[];
  pinsWithNpIds: Set<string>;
  selectedPinId: string | null;
  selectedTripId: string | null;
  photoCounts: Record<string, number>;
  onSelectPin: (pin: TravelPin) => void;
  onSelectTrip: (trip: TravelTrip) => void;
  onAddPin: () => void;
  onAddTrip: () => void;
}

export function PinList({
  pins, trips, tripStops, pinsWithNpIds, selectedPinId, selectedTripId,
  photoCounts, onSelectPin, onSelectTrip, onAddPin, onAddTrip,
}: PinListProps) {
  const { filter, setFilter, search, setSearch, groupBy, setGroupBy, stats, groups } =
    usePinListFilter(pins, pinsWithNpIds);

  const filteredTrips = search
    ? trips.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : trips;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span><strong className="text-foreground">{stats.been_there}</strong> visited</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          <span><strong className="text-foreground">{stats.want_to_go}</strong> want to go</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          <span><strong className="text-foreground">{stats.bucket_list}</strong> bucket list</span>
        </span>
        {trips.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Route className="h-3 w-3" />
            <span><strong className="text-foreground">{trips.length}</strong> {trips.length === 1 ? 'trip' : 'trips'}</span>
          </span>
        )}
        {stats.countries > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GlobeIcon className="h-3 w-3" />
            <span><strong className="text-foreground">{stats.countries}</strong> {stats.countries === 1 ? 'country' : 'countries'}</span>
          </span>
        )}
      </div>

      {/* Search + Add buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search places & trips…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={onAddTrip} variant="outline" className="shrink-0 gap-1 h-8 text-xs px-2.5">
          <Route className="h-3.5 w-3.5" />Trip
        </Button>
        <Button size="sm" onClick={onAddPin} className="shrink-0 gap-1 h-8 text-xs px-2.5">
          <Plus className="h-3.5 w-3.5" />Place
        </Button>
      </div>

      {/* Filter pills (pins only) */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
        <div className="flex gap-1 flex-1">
          {FILTER_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                filter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn('rounded-full px-1.5 leading-none text-[10px]',
                filter === tab.key ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
              )}>
                {stats[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 border-l border-border pl-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-0.5">
            {groupBy === 'year' ? <Calendar className="h-3 w-3" /> : <GlobeIcon className="h-3 w-3" />}
          </span>
          {GROUP_OPTIONS.map((opt) => (
            <button key={opt.key} onClick={() => setGroupBy(opt.key)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                groupBy === opt.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* Trips section */}
        {filteredTrips.length > 0 && (
          <div>
            <div className="sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/80 backdrop-blur-sm border-b border-border">
              Trips
              <span className="ml-1.5 font-normal opacity-60">({filteredTrips.length})</span>
            </div>
            <ul className="divide-y divide-border">
              {filteredTrips.map((trip) => {
                const cfg = TRIP_STYLE_CONFIG[trip.tripStyle];
                const tripColor = trip.color || STATUS_CONFIG[trip.status].color;
                const stopCount = tripStops.filter((p) => p.tripId === trip.id).length;
                const isSelected = trip.id === selectedTripId;
                return (
                  <li key={trip.id}>
                    <button onClick={() => onSelectTrip(trip)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 border-l-2 border-transparent'
                      )}
                    >
                      <span className="mt-0.5 text-base leading-none shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{trip.name}</span>
                          {trip.isBucketList && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: tripColor + '22', color: tripColor }}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{stopCount} {stopCount === 1 ? 'stop' : 'stops'}</span>
                          {trip.visitedDate && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {trip.visitedEndDate
                                ? `${format(parseISO(trip.visitedDate), 'MMM d')}–${format(parseISO(trip.visitedEndDate), 'MMM d, yyyy')}`
                                : format(parseISO(trip.visitedDate), 'MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Standalone pins */}
        {groups.every((g) => g.pins.length === 0) && filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <MapPin className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? `No places matching "${search}"` : 'No places yet. Click the globe to add one.'}
            </p>
          </div>
        ) : groups.every((g) => g.pins.length === 0) ? null : (
          <>
            {trips.length > 0 && (
              <div className="sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/80 backdrop-blur-sm border-b border-border">
                Places
              </div>
            )}
            {groups.map((group) => (
              <div key={group.key}>
                {group.label && (
                  <div className="sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/80 backdrop-blur-sm border-b border-border">
                    {group.label}
                    <span className="ml-1.5 font-normal opacity-60">({group.pins.length})</span>
                  </div>
                )}
                <ul className="divide-y divide-border">
                  {group.pins.map((pin) => {
                    const config = STATUS_CONFIG[pin.status];
                    const isSelected = pin.id === selectedPinId;
                    return (
                      <li key={pin.id}>
                        <button onClick={() => onSelectPin(pin)}
                          className={cn(
                            'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                            isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 border-l-2 border-transparent'
                          )}
                        >
                          <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pin.color || config.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm truncate">{pin.name}</span>
                              {pin.isBucketList && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                              {(photoCounts[pin.id] ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground shrink-0"><Emoji e="📷" /> {photoCounts[pin.id]}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {pin.tripLabel && <span className="text-xs text-muted-foreground truncate">{pin.tripLabel}</span>}
                              {!pin.tripLabel && pin.placeName && pin.placeName !== pin.name && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {pin.placeName.split(',').slice(0, 2).join(',')}
                                </span>
                              )}
                              {pin.visitedDate && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {pin.visitedEndDate
                                    ? `${format(parseISO(pin.visitedDate), 'MMM d')}–${format(parseISO(pin.visitedEndDate), 'MMM d, yyyy')}`
                                    : format(parseISO(pin.visitedDate), 'MMM yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
