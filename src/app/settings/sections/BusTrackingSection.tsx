'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Bus,
  Plus,
  Pencil,
  Trash2,
  Mail,
  RefreshCw,
  GripVertical,
  X,
  Check,
  Unplug,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useFamily } from '@/components/providers';

interface BusRoute {
  id: string;
  studentName: string;
  userId: string | null;
  tripId: string;
  direction: 'AM' | 'PM';
  label: string;
  scheduledTime: string;
  activeDays: number[];
  checkpoints: { name: string; sortOrder: number }[];
  stopName: string | null;
  schoolName: string | null;
  enabled: boolean;
  sortOrder: number;
}

interface ConnectionStatus {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

export function BusTrackingSection() {
  const { members } = useFamily();
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>({ connected: false, expiresAt: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<BusRoute | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [gmailLabel, setGmailLabel] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [routesRes, connRes, settingsRes] = await Promise.all([
        fetch('/api/bus-tracking/routes'),
        fetch('/api/bus-tracking/connection'),
        fetch('/api/settings'),
      ]);
      if (routesRes.ok) setRoutes(await routesRes.json());
      if (connRes.ok) setConnection(await connRes.json());
      if (settingsRes.ok) {
        const allSettings = await settingsRes.json();
        if (allSettings.busGmailLabel) setGmailLabel(allSettings.busGmailLabel);
      }
    } catch {
      // Silent fail — loading state will clear
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/bus-tracking/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Sync complete', description: `Processed ${data.processed} emails, ${data.newEvents} new events` });
      } else {
        toast({ title: 'Sync failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discoverRes = await fetch('/api/bus-tracking/discover', { method: 'POST' });
      const discoverData = await discoverRes.json();

      if (!discoverRes.ok) {
        toast({ title: 'Discovery failed', description: discoverData.error, variant: 'destructive' });
        return;
      }

      if (!discoverData.discovered || discoverData.discovered.length === 0) {
        toast({ title: 'No routes found', description: 'No FirstView emails were found in Gmail.' });
        return;
      }

      const createRes = await fetch('/api/bus-tracking/discover', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes: discoverData.discovered }),
      });
      const createData = await createRes.json();

      if (createRes.ok) {
        const parts = [];
        if (createData.created?.length > 0) parts.push(`Created: ${createData.created.join(', ')}`);
        if (createData.skipped?.length > 0) parts.push(`Skipped: ${createData.skipped.join(', ')}`);
        toast({
          title: `Discovered ${discoverData.discovered.length} route(s)`,
          description: parts.join('. ') || createData.message,
        });
        fetchData();
      } else {
        toast({ title: 'Failed to create routes', description: createData.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Discovery failed', variant: 'destructive' });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveLabel = async (label: string) => {
    try {
      // PATCH, not POST: /api/settings implements GET and PATCH only. Because
      // fetch() does not throw on an HTTP error status, the 405 fell straight
      // past the catch and this reported "saved" while writing nothing.
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'busGmailLabel', value: label.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGmailLabel(label.trim());
      toast({ title: 'Gmail label saved' });
    } catch {
      toast({ title: 'Failed to save label', variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/bus-tracking/connection', { method: 'DELETE' });
      if (res.ok) {
        setConnection({ connected: false, expiresAt: null, updatedAt: null });
        toast({ title: 'Gmail disconnected' });
      }
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    try {
      const res = await fetch(`/api/bus-tracking/routes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRoutes(prev => prev.filter(r => r.id !== id));
        toast({ title: 'Route deleted' });
      }
    } catch {
      toast({ title: 'Failed to delete route', variant: 'destructive' });
    }
  };

  const handleToggleRoute = async (route: BusRoute) => {
    try {
      const res = await fetch(`/api/bus-tracking/routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !route.enabled }),
      });
      if (res.ok) {
        setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, enabled: !r.enabled } : r));
      }
    } catch {
      toast({ title: 'Failed to update route', variant: 'destructive' });
    }
  };

  const handleRouteDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = routes.findIndex(r => r.id === active.id);
    const newIndex = routes.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(routes, oldIndex, newIndex).map((r, i) => ({ ...r, sortOrder: i }));
    setRoutes(reordered); // optimistic

    try {
      const res = await fetch('/api/bus-tracking/routes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map(r => ({ id: r.id, sortOrder: r.sortOrder }))),
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch {
      toast({ title: 'Failed to save route order', variant: 'destructive' });
      fetchData(); // revert
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bus Tracking</h2>
        <p className="text-muted-foreground">
          Track school bus arrivals by connecting to your Gmail for FirstView notifications.
        </p>
      </div>

      <GmailConnectionCard
        connection={connection}
        syncing={syncing}
        disconnecting={disconnecting}
        onSync={handleSync}
        onDisconnect={handleDisconnect}
        gmailLabel={gmailLabel}
        onSaveLabel={handleSaveLabel}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Bus Routes</CardTitle>
              <CardDescription>Configure tracked bus routes and their checkpoints.</CardDescription>
            </div>
            <div className="flex gap-2">
              {connection.connected && (
                <Button size="sm" variant="outline" onClick={handleDiscover} disabled={discovering}>
                  <Search className={`h-4 w-4 mr-1 ${discovering ? 'animate-pulse' : ''}`} />
                  {discovering ? 'Scanning...' : 'Discover from Emails'}
                </Button>
              )}
              <Button size="sm" onClick={() => { setEditingRoute(null); setShowRouteDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Route
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
            </div>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No bus routes configured yet. Add a route to start tracking.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleRouteDragEnd}
            >
              <SortableContext items={routes.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {routes.map(route => (
                    <SortableRouteRow
                      key={route.id}
                      route={route}
                      onEdit={() => { setEditingRoute(route); setShowRouteDialog(true); }}
                      onDelete={() => handleDeleteRoute(route.id)}
                      onToggle={() => handleToggleRoute(route)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {showRouteDialog && (
        <RouteDialog
          route={editingRoute}
          members={members}
          onClose={() => setShowRouteDialog(false)}
          onSaved={(saved) => {
            if (editingRoute) {
              setRoutes(prev => prev.map(r => r.id === saved.id ? saved : r));
            } else {
              setRoutes(prev => [...prev, saved]);
            }
            setShowRouteDialog(false);
          }}
        />
      )}
    </div>
  );
}


function GmailConnectionCard({
  connection,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
  gmailLabel,
  onSaveLabel,
}: {
  connection: ConnectionStatus;
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  gmailLabel: string;
  onSaveLabel: (label: string) => void;
}) {
  const [labelInput, setLabelInput] = useState(gmailLabel);
  const labelDirty = labelInput.trim() !== gmailLabel;

  useEffect(() => { setLabelInput(gmailLabel); }, [gmailLabel]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Gmail Connection</CardTitle>
              <CardDescription>
                Connect Gmail to receive FirstView bus notifications.
              </CardDescription>
            </div>
          </div>
          {connection.connected ? (
            <Badge variant="default" className="bg-green-600">Connected</Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {connection.connected ? (
            <>
              <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button size="sm" variant="outline" onClick={onDisconnect} disabled={disconnecting}>
                <Unplug className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/auth/google-bus">
                <Mail className="h-4 w-4 mr-1" />
                Connect Gmail
              </a>
            </Button>
          )}
        </div>
        {connection.connected && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Gmail Label</Label>
              <Input
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="e.g. bus"
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If you filter bus emails to a Gmail label, enter it here. Leave blank to search all mail.
              </p>
            </div>
            {labelDirty && (
              <Button size="sm" onClick={() => onSaveLabel(labelInput)}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function SortableRouteRow({
  route,
  onEdit,
  onDelete,
  onToggle,
}: {
  route: BusRoute;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: route.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const geofenceCount = route.checkpoints?.length || 0;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <Bus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{route.label}</span>
            <Badge variant="outline" className="text-[10px]">{route.direction}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Trip {route.tripId} &middot; {route.scheduledTime}
            {geofenceCount > 0 && <> &middot; {geofenceCount} geofence{geofenceCount !== 1 ? 's' : ''}</>}
            {route.stopName && <> &middot; Stop: {route.stopName}</>}
            {route.schoolName && <> &middot; School</>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Switch checked={route.enabled} onCheckedChange={onToggle} />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


function SortableCheckpointItem({
  cp,
  index,
  onNameChange,
  onRemove,
  isStop,
}: {
  cp: { name: string; sortOrder: number };
  index: number;
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  isStop: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cp.name || `cp-${index}` });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-1.5 rounded border text-sm">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 text-muted-foreground hover:text-foreground"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{index + 1}.</span>
      <Input
        value={cp.name}
        onChange={e => onNameChange(index, e.target.value)}
        className="flex-1 h-7 text-sm"
      />
      {isStop && (
        <Badge variant="outline" className="text-[10px] flex-shrink-0">stop</Badge>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-destructive flex-shrink-0"
        onClick={() => onRemove(index)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}


function RouteDialog({
  route,
  members,
  onClose,
  onSaved,
}: {
  route: BusRoute | null;
  members: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (route: BusRoute) => void;
}) {
  const isEditing = !!route;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentName: route?.studentName || '',
    userId: route?.userId || '',
    tripId: route?.tripId || '',
    direction: route?.direction || 'AM' as 'AM' | 'PM',
    label: route?.label || '',
    scheduledTime: route?.scheduledTime || '07:00',
    stopName: route?.stopName || '',
    schoolName: route?.schoolName || '',
    checkpoints: route?.checkpoints || [] as { name: string; sortOrder: number }[],
  });
  const [newCheckpointName, setNewCheckpointName] = useState('');

  const checkpointSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  const checkpointIds = form.checkpoints.map((cp, i) => cp.name || `cp-${i}`);

  const addCheckpoint = () => {
    if (!newCheckpointName.trim()) return;
    setForm(prev => ({
      ...prev,
      checkpoints: [
        ...prev.checkpoints,
        { name: newCheckpointName.trim(), sortOrder: prev.checkpoints.length },
      ],
    }));
    setNewCheckpointName('');
  };

  const removeCheckpoint = (index: number) => {
    setForm(prev => {
      const updated = prev.checkpoints
        .filter((_, i) => i !== index)
        .map((cp, i) => ({ ...cp, sortOrder: i }));
      // If stopName referenced the removed checkpoint, clear it
      const removedName = prev.checkpoints[index]?.name;
      return {
        ...prev,
        checkpoints: updated,
        stopName: prev.stopName === removedName ? '' : prev.stopName,
      };
    });
  };

  const handleCheckpointNameChange = (index: number, name: string) => {
    setForm(prev => {
      const oldName = prev.checkpoints[index]?.name;
      const updated = prev.checkpoints.map((cp, i) =>
        i === index ? { ...cp, name } : cp
      );
      return {
        ...prev,
        checkpoints: updated,
        // Keep stopName in sync if it referenced the renamed checkpoint
        stopName: prev.stopName === oldName ? name : prev.stopName,
      };
    });
  };

  const handleCheckpointDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = checkpointIds.indexOf(String(active.id));
    const newIndex = checkpointIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    setForm(prev => ({
      ...prev,
      checkpoints: arrayMove(prev.checkpoints, oldIndex, newIndex).map((cp, i) => ({ ...cp, sortOrder: i })),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isEditing
        ? `/api/bus-tracking/routes/${route.id}`
        : '/api/bus-tracking/routes';
      const method = isEditing ? 'PATCH' : 'POST';

      const body = {
        ...form,
        userId: form.userId || undefined,
        stopName: form.stopName || undefined,
        schoolName: form.schoolName || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        onSaved(saved);
        toast({ title: isEditing ? 'Route updated' : 'Route created' });
      } else {
        const err = await res.json();
        toast({ title: 'Failed to save', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const checkpointNames = form.checkpoints.map(cp => cp.name).filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Route' : 'Add Bus Route'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Student Name</Label>
              <Input
                value={form.studentName}
                onChange={e => setForm(p => ({ ...p, studentName: e.target.value }))}
                placeholder="e.g. Emma"
              />
            </div>
            <div>
              <Label>Family Member</Label>
              <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Label</Label>
            <Input
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="e.g. Emma Morning Pickup"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Trip ID</Label>
              <Input
                value={form.tripId}
                onChange={e => setForm(p => ({ ...p, tripId: e.target.value }))}
                placeholder="e.g. 28-C"
              />
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(p => ({ ...p, direction: v as 'AM' | 'PM' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM (Pickup)</SelectItem>
                  <SelectItem value="PM">PM (Dropoff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Home ETA</Label>
              <Input
                type="time"
                value={form.scheduledTime}
                onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Expected arrival at your stop.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Your Stop</Label>
              {checkpointNames.length > 0 ? (
                <Select
                  value={form.stopName}
                  onValueChange={v => setForm(p => ({ ...p, stopName: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select checkpoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {checkpointNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.stopName}
                  onChange={e => setForm(p => ({ ...p, stopName: e.target.value }))}
                  placeholder="Add checkpoints first"
                  disabled={checkpointNames.length === 0}
                />
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ETA target — select the checkpoint where your child gets off.
              </p>
            </div>
            <div>
              <Label>School Name</Label>
              <Input
                value={form.schoolName}
                onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))}
                placeholder="School name"
              />
            </div>
          </div>

          {/* Checkpoints editor */}
          <div>
            <Label>Geofence Checkpoints (in order)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add the ordered geofence labels from FirstView. Drag to reorder.
            </p>

            {form.checkpoints.length > 0 && (
              <DndContext
                sensors={checkpointSensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleCheckpointDragEnd}
              >
                <SortableContext items={checkpointIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1 mb-2">
                    {form.checkpoints.map((cp, i) => (
                      <SortableCheckpointItem
                        key={cp.name || `cp-${i}`}
                        cp={cp}
                        index={i}
                        onNameChange={handleCheckpointNameChange}
                        onRemove={removeCheckpoint}
                        isStop={cp.name === form.stopName}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="flex gap-2">
              <Input
                value={newCheckpointName}
                onChange={e => setNewCheckpointName(e.target.value)}
                placeholder="Checkpoint name"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCheckpoint())}
              />
              <Button size="sm" variant="outline" onClick={addCheckpoint} disabled={!newCheckpointName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.studentName || !form.tripId || !form.label}>
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
