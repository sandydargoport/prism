'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { Search, X, Loader2, Star, MapPin, Plus, TreePine, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TravelPin, PinStatus, PinType, GeocodeResult } from '../types';
import { STATUS_CONFIG } from '../types';
import { NPS_UNITS } from '../constants/nationalParks';

export interface PendingStop {
  name: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface PinPendingChildren {
  stops: PendingStop[];
  parks: PendingStop[];
}

interface PinFormProps {
  pin?: TravelPin | null;
  initialLatLng?: { lat: number; lng: number } | null;
  parentId?: string;
  pinType?: PinType;
  childPins?: TravelPin[]; // existing children when editing
  hideHeader?: boolean;
  onSave: (data: Partial<TravelPin>, pendingChildren?: PinPendingChildren) => Promise<void>;
  onCancel: () => void;
}

export function PinForm({ pin, initialLatLng, parentId, pinType = 'location', childPins = [], hideHeader, onSave, onCancel }: PinFormProps) {
  const isChildPin = !!(parentId || pin?.parentId);
  const effectivePinType = pin?.pinType ?? pinType;
  const isNP = effectivePinType === 'national_park';
  const isNewRootPin = !pin && !isChildPin;
  const showChildSections = !isChildPin && !isNP; // show stops/parks for root location pins (new or edit)

  // Combined name + location search
  const [inputValue, setInputValue] = useState(pin?.name ?? '');
  const [lat, setLat] = useState(pin?.latitude ?? initialLatLng?.lat ?? 0);
  const [lng, setLng] = useState(pin?.longitude ?? initialLatLng?.lng ?? 0);
  const [placeName, setPlaceName] = useState(pin?.placeName ?? '');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // NP-specific
  const [selectedPark, setSelectedPark] = useState(isNP && pin?.name ? pin.name : '');
  const [npSearch, setNpSearch] = useState('');

  // Standard fields
  const [description, setDescription] = useState(pin?.description ?? '');
  const [status, setStatus] = useState<PinStatus>(pin?.status ?? 'want_to_go');
  const [isBucketList, setIsBucketList] = useState(pin?.isBucketList ?? false);
  const [tripLabel, setTripLabel] = useState(pin?.tripLabel ?? '');
  const [visitedDate, setVisitedDate] = useState(pin?.visitedDate ?? '');
  const [visitedEndDate, setVisitedEndDate] = useState(pin?.visitedEndDate ?? '');
  const [tagInput, setTagInput] = useState((pin?.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pending stops — geocode-backed
  const [pendingStops, setPendingStops] = useState<PendingStop[]>([]);
  const [stopQuery, setStopQuery] = useState('');
  const [stopResults, setStopResults] = useState<GeocodeResult[]>([]);
  const [stopSearching, setStopSearching] = useState(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pendingParks, setPendingParks] = useState<PendingStop[]>([]);
  const [parkSearch, setParkSearch] = useState('');
  const [showParkPicker, setShowParkPicker] = useState(false);
  const [showStops, setShowStops] = useState(false);

  // Sync when user clicks a new spot on the map while the form is already open
  useEffect(() => {
    if (initialLatLng) {
      setLat(initialLatLng.lat);
      setLng(initialLatLng.lng);
      setPlaceName('');
      setSearchResults([]);
    }
  }, [initialLatLng?.lat, initialLatLng?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLocation = lat !== 0 || lng !== 0;

  const searchLocation = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/travel/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (hasLocation) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => searchLocation(inputValue), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [inputValue, hasLocation, searchLocation]);

  useEffect(() => {
    if (isNP && selectedPark && !hasLocation) {
      searchLocation(selectedPark + ' National Park');
    }
  }, [selectedPark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop geocode search
  useEffect(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (stopQuery.trim().length < 2) { setStopResults([]); return; }
    stopTimer.current = setTimeout(async () => {
      setStopSearching(true);
      try {
        const res = await fetch(`/api/travel/geocode?q=${encodeURIComponent(stopQuery)}`);
        const data = await res.json();
        setStopResults(data.results ?? []);
      } finally {
        setStopSearching(false);
      }
    }, 350);
    return () => { if (stopTimer.current) clearTimeout(stopTimer.current); };
  }, [stopQuery]);

  const selectResult = (result: GeocodeResult) => {
    const shortName = result.displayName.split(',')[0]?.trim() ?? result.displayName;
    // Always update name when editing unless user has typed a custom name that differs from any previous geocode result
    if (!inputValue || !pin || inputValue === placeName.split(',')[0]?.trim()) setInputValue(shortName);
    setLat(result.latitude);
    setLng(result.longitude);
    setPlaceName(result.displayName);
    setSearchResults([]);
  };

  const clearLocation = () => {
    setLat(0);
    setLng(0);
    setPlaceName('');
    setSearchResults([]);
  };

  const selectNP = (parkName: string) => {
    setSelectedPark(parkName);
    setInputValue(parkName);
    setNpSearch('');
    clearLocation();
  };

  const selectStopResult = (result: GeocodeResult) => {
    const name = result.displayName.split(',')[0]?.trim() ?? result.displayName;
    const stop: PendingStop = { name, latitude: result.latitude, longitude: result.longitude, placeName: result.displayName };
    if (!pendingStops.some((s) => s.name === name)) {
      setPendingStops((prev) => [...prev, stop]);
    }
    setStopQuery('');
    setStopResults([]);
  };

  const addStopByName = () => {
    const name = stopQuery.trim();
    if (!name || pendingStops.some((s) => s.name === name)) return;
    setPendingStops((prev) => [...prev, { name, latitude: 0, longitude: 0 }]);
    setStopQuery('');
    setStopResults([]);
  };

  const togglePendingPark = async (name: string) => {
    if (pendingParks.some((p) => p.name === name)) {
      setPendingParks((prev) => prev.filter((p) => p.name !== name));
      return;
    }
    // Optimistically add, then fill in coordinates from geocode
    setPendingParks((prev) => [...prev, { name, latitude: 0, longitude: 0 }]);
    try {
      const res = await fetch(`/api/travel/geocode?q=${encodeURIComponent(name + ' National Park')}`);
      const data = await res.json();
      const first = data.results?.[0];
      if (first) {
        setPendingParks((prev) => prev.map((p) =>
          p.name === name ? { name, latitude: first.latitude, longitude: first.longitude, placeName: first.fullName } : p
        ));
      }
    } catch {
      // keep with no location — user can set it from the detail view
    }
  };

  const filteredParks = NPS_UNITS.filter((u) =>
    u.name.toLowerCase().includes(parkSearch.toLowerCase())
  );

  const filteredNP = NPS_UNITS.filter((u) =>
    u.name.toLowerCase().includes(npSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameToSave = inputValue.trim();
    if (!nameToSave) return;
    if (isNP && !selectedPark && !pin) return;
    setSaving(true);
    setSaveError(null);
    try {
      const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      await onSave(
        {
          name: nameToSave,
          description: description.trim() || null,
          status,
          isBucketList: isChildPin ? false : isBucketList,
          tripLabel: isChildPin ? null : (tripLabel.trim() || null),
          latitude: lat,
          longitude: lng,
          placeName: placeName.trim() || null,
          visitedDate: visitedDate || null,
          visitedEndDate: visitedEndDate || null,
          year: visitedDate ? new Date(visitedDate).getFullYear() : null,
          tags,
          stops: [],
          nationalParks: [],
          parentId: pin?.parentId ?? parentId ?? null,
          pinType: effectivePinType,
        },
        (pendingStops.length > 0 || pendingParks.length > 0) ? { stops: pendingStops, parks: pendingParks } : undefined
      );
    } catch (err) {
      setSaveError(err instanceof Error && err.name === 'TravelAuthError'
        ? 'Log in to make changes'
        : 'Something went wrong — please try again');
    } finally {
      setSaving(false);
    }
  };

  const title = pin
    ? `Edit ${isNP ? 'Park' : effectivePinType === 'stop' ? 'Stop' : 'Place'}`
    : `Add ${isNP ? 'National Park' : effectivePinType === 'stop' ? 'Stop' : 'Place'}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* ── Non-scrolling header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 flex flex-col gap-3">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* NPS picker (NP type only) */}
        {isNP && (
          <div className="space-y-1">
            <Label>National Park / Monument *</Label>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="p-2 border-b border-border">
                <Input
                  placeholder="Search parks…"
                  value={npSearch}
                  onChange={(e) => setNpSearch(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus={!pin}
                />
              </div>
              <ul className="max-h-36 overflow-y-auto">
                {filteredNP.map((u) => {
                  const sel = selectedPark === u.name;
                  return (
                    <li key={u.name}>
                      <button type="button" onClick={() => selectNP(u.name)}
                        className={cn('w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors',
                          sel ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted')}
                      >
                        <span className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0',
                          sel ? 'bg-emerald-600 border-emerald-600' : 'border-border')}>
                          {sel && <span className="text-white text-[10px] leading-none">✓</span>}
                        </span>
                        <span className="flex-1 truncate">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase shrink-0">
                          {u.type === 'monument' ? 'NM' : 'NP'}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filteredNP.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted-foreground text-center">No matches</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Combined name + location search */}
        <div className="space-y-1">
          <Label htmlFor="place-input">
            {isNP ? 'Park location' : effectivePinType === 'stop' ? 'Stop name & location *' : 'Place name & location *'}
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="place-input"
              placeholder={
                isNP ? 'Search for park location…' :
                effectivePinType === 'stop' ? 'e.g. Kauai, Rome, Banff' :
                'Search for a city, park, or place…'
              }
              className="pl-8"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (hasLocation) clearLocation();
              }}
              autoFocus={!pin && !isNP}
              required
            />
            {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            {searchResults.length > 0 && (
              <ul className="absolute z-50 top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg mt-1 overflow-hidden max-h-52 overflow-y-auto">
                {searchResults.map((r) => (
                  <li key={r.placeId}>
                    <button type="button" onClick={() => selectResult(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <div className="font-medium">{r.displayName.split(',')[0]?.trim()}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.fullName}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hasLocation ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">{placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
              <button type="button" onClick={clearLocation} className="ml-auto shrink-0 hover:text-destructive" title="Clear location">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Select a result to pin on the globe (optional)
            </p>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 min-h-0">

        {/* Status + Bucket list */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PinStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_CONFIG) as [PinStatus, typeof STATUS_CONFIG[PinStatus]][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isChildPin && (
            <button type="button" onClick={() => setIsBucketList((v) => !v)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors h-10 shrink-0',
                isBucketList
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Star className={cn('h-4 w-4', isBucketList && 'fill-amber-500 text-amber-500')} />
              Bucket List
            </button>
          )}
        </div>

        {/* Trip label */}
        {!isChildPin && (
          <div className="space-y-1">
            <Label htmlFor="trip-label">Trip label</Label>
            <Input id="trip-label" placeholder="e.g. Spring Break 2026, Summer Family Trip"
              value={tripLabel} onChange={(e) => setTripLabel(e.target.value)} />
          </div>
        )}

        {/* Stops section (all root pins) */}
        {showChildSections && (
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowStops((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-left w-full"
            >
              <MapPin className="h-4 w-4 text-violet-500" />
              <span>Stops</span>
              {(childPins.filter(c => c.pinType === 'stop').length + pendingStops.length) > 0 && (
                <Badge variant="outline" className="text-xs text-violet-600 border-violet-400 ml-1">
                  {childPins.filter(c => c.pinType === 'stop').length + pendingStops.length}
                </Badge>
              )}
              {showStops
                ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
            </button>
            {showStops && (
              <div className="space-y-2">
                {/* Existing stops (edit mode) */}
                {childPins.filter(c => c.pinType === 'stop').length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {childPins.filter(c => c.pinType === 'stop').map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-violet-700 bg-violet-50 dark:bg-violet-900/20 text-xs">
                        <Emoji e="📍" /> {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Geocode search for new stops */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for a stop, city, or island…"
                    value={stopQuery}
                    onChange={(e) => setStopQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStopByName(); } }}
                    className="pl-8 pr-8 text-sm"
                  />
                  {stopSearching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  {stopResults.length > 0 && (
                    <ul className="absolute z-50 top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg mt-1 overflow-hidden max-h-44 overflow-y-auto">
                      {stopResults.map((r) => (
                        <li key={r.placeId}>
                          <button type="button" onClick={() => selectStopResult(r)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          >
                            <div className="font-medium">{r.displayName.split(',')[0]?.trim()}</div>
                            <div className="text-xs text-muted-foreground truncate">{r.fullName}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Pending stops chips */}
                {pendingStops.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pendingStops.map((s) => (
                      <Badge key={s.name} variant="secondary"
                        className="gap-1 pr-1 text-violet-700 bg-violet-50 dark:bg-violet-900/20"
                      >
                        <Emoji e="📍" /> {s.name}
                        {s.latitude === 0 && s.longitude === 0 && (
                          <span className="text-[10px] text-amber-500 ml-0.5">no location</span>
                        )}
                        <button type="button"
                          onClick={() => setPendingStops((p) => p.filter((x) => x.name !== s.name))}
                          className="hover:text-destructive ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* National parks section (all root pins) */}
        {showChildSections && (
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowParkPicker((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-left w-full"
            >
              <TreePine className="h-4 w-4 text-emerald-700" />
              <span>National Parks</span>
              {(childPins.filter(c => c.pinType === 'national_park').length + pendingParks.length) > 0 && (
                <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-600 ml-1">
                  {childPins.filter(c => c.pinType === 'national_park').length + pendingParks.length}
                </Badge>
              )}
              {showParkPicker
                ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
            </button>
            {showParkPicker && (
              <div className="border border-border rounded-md overflow-hidden">
                {/* Existing parks (edit mode) */}
                {childPins.filter(c => c.pinType === 'national_park').length > 0 && (
                  <div className="p-2 border-b border-border flex flex-wrap gap-1">
                    {childPins.filter(c => c.pinType === 'national_park').map((p) => (
                      <Badge key={p.id} className="bg-emerald-700 text-white text-xs"><Emoji e="🌲" /> {p.name}</Badge>
                    ))}
                  </div>
                )}
                <div className="p-2 border-b border-border">
                  <Input placeholder="Filter parks…" value={parkSearch}
                    onChange={(e) => setParkSearch(e.target.value)} className="h-8 text-sm" />
                </div>
                <ul className="max-h-40 overflow-y-auto">
                  {filteredParks.map((u) => {
                    const selected = pendingParks.some((p) => p.name === u.name);
                    return (
                      <li key={u.name}>
                        <button type="button" onClick={() => { void togglePendingPark(u.name); }}
                          className={cn('w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors',
                            selected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted')}
                        >
                          <span className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0',
                            selected ? 'bg-emerald-600 border-emerald-600' : 'border-border')}>
                            {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                          </span>
                          <span className="flex-1 truncate">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase shrink-0">
                            {u.type === 'monument' ? 'NM' : 'NP'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {filteredParks.length === 0 && (
                    <li className="px-3 py-3 text-sm text-muted-foreground text-center">No matches</li>
                  )}
                </ul>
              </div>
            )}
            {pendingParks.length > 0 && !showParkPicker && (
              <div className="flex flex-wrap gap-1">
                {pendingParks.map((p) => (
                  <Badge key={p.name} className="bg-emerald-700 text-white gap-1 pr-1 text-xs">
                    <Emoji e="🌲" /> {p.name}
                    {p.latitude === 0 && p.longitude === 0 && (
                      <span className="text-[10px] text-emerald-200 ml-0.5">locating…</span>
                    )}
                    <button type="button" onClick={() => { void togglePendingPark(p.name); }} className="hover:opacity-75">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {showParkPicker && (
              <p className="text-xs text-muted-foreground">
                Parks are saved as pins — set their map location from the detail view.
              </p>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="visit-start">{status === 'been_there' ? 'From' : 'Planned date'}</Label>
            <Input id="visit-start" type="date" value={visitedDate} onChange={(e) => setVisitedDate(e.target.value)} />
          </div>
          {status === 'been_there' && (
            <div className="space-y-1">
              <Label htmlFor="visit-end">To</Label>
              <Input id="visit-end" type="date" value={visitedEndDate}
                onChange={(e) => setVisitedEndDate(e.target.value)} min={visitedDate} />
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <Label htmlFor="pin-tags">Tags</Label>
          <Input id="pin-tags" placeholder="beach, hiking, food — comma-separated"
            value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label htmlFor="pin-desc">Notes</Label>
          <Textarea id="pin-desc" placeholder="Memories, tips, highlights…"
            value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-border flex flex-col gap-2 shrink-0">
        {saveError && (
          <p className="text-xs text-destructive text-center">{saveError}</p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={saving || !inputValue.trim() || (isNP && !selectedPark && !pin)} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (pin ? 'Save' : 'Add')}
          </Button>
        </div>
      </div>
    </form>
  );
}
