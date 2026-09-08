'use client';

import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, X, MapPin, Star, TreePine, GripVertical, Check, Pencil, Loader2 } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TravelPin, PinType, PinStatus } from '../types';
import { STATUS_CONFIG, NPS_COLOR } from '../types';
import type { PinPendingChildren } from './PinForm';
import { InlineChildAdd } from './InlineChildAdd';
import { PinPhotoGrid } from './PinPhotoGrid';

interface PinDetailProps {
  pin: TravelPin;
  childPins: TravelPin[];
  onUpdate: (data: Partial<TravelPin>, pendingChildren?: PinPendingChildren) => Promise<void>;
  onDelete: () => void;
  onDeleteChild: (id: string) => void;
  onClose: () => void;
  onAddChildDirect: (name: string, lat: number, lng: number, placeName: string | null, pinType: PinType) => Promise<void>;
  onSelectChild: (child: TravelPin) => void;
  onReorderChildren: (childIds: string[]) => Promise<void>;
}

function SortableChildItem({ child, idx, onSelect, onDelete }: {
  child: TravelPin; idx: number; onSelect: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab shrink-0 text-muted-foreground/40 hover:text-muted-foreground touch-none">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] font-bold text-muted-foreground/50 w-4 shrink-0 text-right">{idx + 1}</span>
      {child.pinType === 'national_park'
        ? <TreePine className="h-3.5 w-3.5 shrink-0" style={{ color: NPS_COLOR }} />
        : <MapPin className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
      <button onClick={onSelect} className="flex-1 text-left text-xs font-medium hover:underline truncate">
        {child.name}
        {!child.latitude && !child.longitude && <span className="text-[10px] text-warning ml-1.5">no location</span>}
      </button>
      <button onClick={onDelete} className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors" title="Remove">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PinDetail({ pin, childPins, onUpdate, onDelete, onDeleteChild, onClose, onAddChildDirect, onSelectChild, onReorderChildren }: PinDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable field state — reset when pin changes
  const [name, setName] = useState(pin.name);
  const [tripLabel, setTripLabel] = useState(pin.tripLabel ?? '');
  const [status, setStatus] = useState<PinStatus>(pin.status);
  const [isBucketList, setIsBucketList] = useState(pin.isBucketList);
  const [visitedDate, setVisitedDate] = useState(pin.visitedDate ?? '');
  const [visitedEndDate, setVisitedEndDate] = useState(pin.visitedEndDate ?? '');
  const [description, setDescription] = useState(pin.description ?? '');
  const [tagInput, setTagInput] = useState((pin.tags ?? []).join(', '));

  useEffect(() => {
    setName(pin.name);
    setTripLabel(pin.tripLabel ?? '');
    setStatus(pin.status);
    setIsBucketList(pin.isBucketList);
    setVisitedDate(pin.visitedDate ?? '');
    setVisitedEndDate(pin.visitedEndDate ?? '');
    setDescription(pin.description ?? '');
    setTagInput((pin.tags ?? []).join(', '));
  }, [pin.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty =
    name !== pin.name ||
    tripLabel !== (pin.tripLabel ?? '') ||
    visitedDate !== (pin.visitedDate ?? '') ||
    visitedEndDate !== (pin.visitedEndDate ?? '') ||
    description !== (pin.description ?? '') ||
    tagInput !== (pin.tags ?? []).join(', ');

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      await onUpdate({
        name: name.trim(),
        tripLabel: tripLabel.trim() || null,
        status,
        isBucketList,
        visitedDate: visitedDate || null,
        visitedEndDate: visitedEndDate || null,
        year: visitedDate ? new Date(visitedDate).getFullYear() : null,
        description: description.trim() || null,
        tags,
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle-style fields auto-save immediately
  const handleToggleBucketList = async () => {
    const next = !isBucketList;
    setIsBucketList(next);
    await onUpdate({ isBucketList: next });
  };

  const handleToggleStatus = async (next: PinStatus) => {
    setStatus(next);
    await onUpdate({ status: next });
  };

  // Re-locate
  const [relocating, setRelocating] = useState(false);
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<{ latitude: number; longitude: number; displayName: string; fullName?: string }[]>([]);
  const [geoSearching, setGeoSearching] = useState(false);
  const geoInputRef = useRef<HTMLInputElement>(null);

  const handleGeoSearch = async () => {
    if (!geoQuery.trim()) return;
    setGeoSearching(true);
    try {
      const res = await fetch(`/api/travel/geocode?q=${encodeURIComponent(geoQuery.trim())}`);
      const data = await res.json();
      setGeoResults(data.results ?? []);
    } finally {
      setGeoSearching(false);
    }
  };

  const handleRelocatePick = async (r: { latitude: number; longitude: number; displayName: string; fullName?: string }) => {
    await onUpdate({ latitude: r.latitude, longitude: r.longitude, placeName: r.fullName ?? r.displayName });
    setRelocating(false);
    setGeoQuery('');
    setGeoResults([]);
  };

  // Children reorder
  const [localChildren, setLocalChildren] = useState<TravelPin[]>([]);
  useEffect(() => {
    setLocalChildren([...childPins].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [childPins]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localChildren.findIndex(c => c.id === active.id);
    const newIdx = localChildren.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(localChildren, oldIdx, newIdx);
    setLocalChildren(newOrder);
    try {
      await onReorderChildren(newOrder.map(c => c.id));
    } catch {
      setLocalChildren([...childPins].sort((a, b) => a.sortOrder - b.sortOrder));
    }
  };

  const config = STATUS_CONFIG[pin.status];
  const isChildPin = !!pin.parentId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {pin.pinType === 'national_park' && <TreePine className="h-4 w-4 shrink-0 mt-0.5" style={{ color: NPS_COLOR }} />}
            {pin.pinType === 'stop' && <MapPin className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />}
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-7 text-base font-semibold border-transparent bg-transparent px-1 hover:border-border focus:border-border focus:bg-background transition-colors"
              placeholder="Name"
            />
            {!isChildPin && (
              <button onClick={handleToggleBucketList} title={isBucketList ? 'Remove from bucket list' : 'Add to bucket list'} className="shrink-0">
                <Star className={cn('h-4 w-4', isBucketList ? 'fill-amber-500 text-warning' : 'text-muted-foreground/40 hover:text-warning')} />
              </button>
            )}
          </div>
          {!isChildPin && (
            <Input
              value={tripLabel}
              onChange={e => setTripLabel(e.target.value)}
              placeholder="Trip label (optional)"
              className="h-6 text-xs border-transparent bg-transparent px-1 text-muted-foreground hover:border-border focus:border-border focus:bg-background transition-colors"
            />
          )}
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 mt-0.5" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Status + dates */}
        {!isChildPin && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {(Object.entries(STATUS_CONFIG) as [PinStatus, typeof STATUS_CONFIG[PinStatus]][]).map(([key, cfg]) => (
                <button key={key} onClick={() => handleToggleStatus(key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-colors',
                    status === key
                      ? 'border-transparent text-white'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  style={status === key ? { backgroundColor: pin.color || cfg.color, borderColor: pin.color || cfg.color } : {}}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: status === key ? 'rgba(255,255,255,0.7)' : cfg.color }} />
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{status === 'been_there' ? 'From' : 'Planned'}</p>
                <Input type="date" value={visitedDate} onChange={e => setVisitedDate(e.target.value)} className="h-7 text-xs" />
              </div>
              {status === 'been_there' && (
                <div className="flex-1 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">To</p>
                  <Input type="date" value={visitedEndDate} onChange={e => setVisitedEndDate(e.target.value)} min={visitedDate} className="h-7 text-xs" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stops & Parks combined */}
        {!isChildPin && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Stops & Parks{localChildren.length > 0 ? ` (${localChildren.length})` : ''}
              </p>
              {localChildren.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={localChildren.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {localChildren.map((child, idx) => (
                        <SortableChildItem key={child.id} child={child} idx={idx}
                          onSelect={() => onSelectChild(child)} onDelete={() => onDeleteChild(child.id)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-xs text-muted-foreground italic">No stops or parks yet</p>
              )}
              {/* Add buttons below list — avoids overlapping content above */}
              <div className="flex gap-3 pt-0.5">
                <InlineChildAdd childType="stop" onAdd={(n, lat, lng, p) => onAddChildDirect(n, lat, lng, p, 'stop')} />
                <InlineChildAdd childType="national_park" onAdd={(n, lat, lng, p) => onAddChildDirect(n, lat, lng, p, 'national_park')} />
              </div>
            </div>
            <div className="border-t border-border" />
          </>
        )}

        {/* Description */}
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Notes, memories, tips…"
          rows={3}
          className="text-sm resize-none"
        />

        {/* Tags */}
        <Input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          placeholder="Tags: beach, hiking, food — comma-separated"
          className="text-sm"
        />

        {/* Nearby photos (GPS-linked from OneDrive) */}
        {!isChildPin && (
          <PinPhotoGrid
            pinId={pin.id}
            radiusKm={pin.photoRadiusKm ?? 50}
          />
        )}

        {/* Coordinates + re-locate */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {(pin.latitude !== 0 || pin.longitude !== 0)
              ? <span className="flex-1">{pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}</span>
              : <span className="flex-1 italic">No location set</span>
            }
            <button
              onClick={() => { setRelocating(v => !v); setGeoQuery(''); setGeoResults([]); setTimeout(() => geoInputRef.current?.focus(), 50); }}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Re-locate this pin"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {relocating && (
            <div className="space-y-1">
              <div className="flex gap-1">
                <input
                  ref={geoInputRef}
                  value={geoQuery}
                  onChange={e => setGeoQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGeoSearch()}
                  placeholder="Search for a new location…"
                  className="flex-1 h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleGeoSearch}
                  disabled={geoSearching || !geoQuery.trim()}
                  className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50"
                >
                  {geoSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Go'}
                </button>
              </div>
              {geoResults.length > 0 && (
                <div className="rounded-md border border-border bg-background shadow-sm max-h-40 overflow-y-auto">
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleRelocatePick(r)}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors border-b border-border last:border-0"
                    >
                      <div className="font-medium truncate">{r.fullName ?? r.displayName}</div>
                      <div className="text-muted-foreground">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</div>
                    </button>
                  ))}
                </div>
              )}
              {geoResults.length === 0 && geoQuery && !geoSearching && (
                <p className="text-xs text-muted-foreground italic px-1">No results — try a broader search</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border flex gap-2 shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs text-muted-foreground flex-1 flex items-center">
              {isChildPin ? 'Delete this stop?' : `Delete${childPins.length > 0 ? ` + ${childPins.length} sub-location${childPins.length !== 1 ? 's' : ''}` : ''}?`}
            </span>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSave} disabled={!isDirty || saving || !name.trim()}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {saving ? 'Saving…' : isDirty ? 'Save changes' : 'No changes'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
