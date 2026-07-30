'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers';
import { toast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useWeekendData, WeekendAuthError } from './useWeekendData';
import { WeekendPlaceGrid } from './components/WeekendPlaceGrid';
import { WeekendPlaceDetail } from './components/WeekendPlaceDetail';
import { WeekendPlaceForm } from './components/WeekendPlaceForm';
import { TagChip } from './components/TagChip';
import { TAG_PRESETS } from './constants';
import type { WeekendPlace } from './types';

type FilterStatus = 'all' | 'backlog' | 'visited';
type OverlayMode = 'none' | 'detail' | 'add' | 'edit';

export function WeekendView() {
  const { requireAuth } = useAuth();
  const { places, loading, error, addPlace, updatePlace, deletePlace } = useWeekendData();
  const { confirm, dialogProps } = useConfirmDialog();

  const [selectedPlace, setSelectedPlace] = useState<WeekendPlace | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const closeOverlay = () => {
    setOverlayMode('none');
    setSelectedPlace(null);
  };

  // Keep selected place fresh when data updates
  const freshSelected = selectedPlace
    ? (places.find((p) => p.id === selectedPlace.id) ?? selectedPlace)
    : null;

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterFavorites && !p.isFavorite) return false;
      if (filterTags.length > 0 && !filterTags.every((t) => p.tags.includes(t))) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [places, filterStatus, filterFavorites, filterTags, search]);

  const toggleFilterTag = (tag: string) =>
    setFilterTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleAdd = async () => {
    const user = await requireAuth('Add Place', 'Log in to add a place');
    if (!user) return;
    setOverlayMode('add');
  };

  const handleSaveNew = async (data: Parameters<typeof addPlace>[0]) => {
    try {
      const place = await addPlace(data);
      setSelectedPlace(place);
      setOverlayMode('detail');
      toast({ title: `"${place.name}" added!` });
    } catch (err) {
      if (err instanceof WeekendAuthError) toast({ title: 'Please log in', variant: 'destructive' });
      else toast({ title: 'Failed to add place', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (data: Parameters<typeof updatePlace>[1]) => {
    if (!freshSelected) return;
    try {
      const updated = await updatePlace(freshSelected.id, data);
      setSelectedPlace(updated);
      setOverlayMode('detail');
      toast({ title: 'Place updated' });
    } catch {
      toast({ title: 'Failed to update place', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!freshSelected) return;
    const ok = await confirm(`Remove "${freshSelected.name}"?`, 'This will permanently delete this place.');
    if (!ok) return;
    try {
      await deletePlace(freshSelected.id);
      closeOverlay();
      toast({ title: `"${freshSelected.name}" removed` });
    } catch {
      toast({ title: 'Failed to delete place', variant: 'destructive' });
    }
  };

  const handleToggleFavorite = async () => {
    if (!freshSelected) return;
    try {
      const updated = await updatePlace(freshSelected.id, { isFavorite: !freshSelected.isFavorite });
      setSelectedPlace(updated);
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleMarkVisited = async () => {
    if (!freshSelected) return;
    try {
      const updated = await updatePlace(freshSelected.id, {
        status: 'visited',
        visitCount: freshSelected.visitCount + 1,
        lastVisitedDate: new Date().toISOString().slice(0, 10),
      });
      setSelectedPlace(updated);
      toast({ title: `Marked "${freshSelected.name}" as visited!` });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const panelOpen = overlayMode !== 'none';

  return (
    <PageWrapper>
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur shrink-0 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['all', 'backlog', 'visited'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                filterStatus === s ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'backlog' ? 'Want to Try' : s === 'visited' ? 'Been There' : 'All'}
            </button>
          ))}
        </div>

        {/* Favorites toggle */}
        <button
          onClick={() => setFilterFavorites((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            filterFavorites
              ? 'bg-amber-50 dark:bg-amber-950 border-amber-400 text-amber-600'
              : 'border-transparent bg-muted text-muted-foreground hover:bg-accent'
          )}
        >
          <Star className={cn('h-3.5 w-3.5', filterFavorites && 'fill-amber-400 text-amber-400')} />
          Favorites
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search places…"
            className="pl-7 h-7 text-xs"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button onClick={handleAdd} size="sm" className="ml-auto shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Add Place
        </Button>
      </div>

      {/* Tag filter row */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border bg-background/50 shrink-0 overflow-x-auto">
        {TAG_PRESETS.map((t) => (
          <TagChip
            key={t.value}
            tag={t.value}
            active={filterTags.includes(t.value)}
            onClick={() => toggleFilterTag(t.value)}
          />
        ))}
        {filterTags.length > 0 && (
          <button onClick={() => setFilterTags([])} className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap ml-1">
            Clear
          </button>
        )}
      </div>

      {/* Main content + panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Grid */}
        <div className={cn('flex-1 overflow-y-auto p-3 transition-all', panelOpen && 'md:mr-96')}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>
          ) : (
            <WeekendPlaceGrid
              places={filteredPlaces}
              selectedId={freshSelected?.id ?? null}
              onSelect={(p) => { setSelectedPlace(p); setOverlayMode('detail'); }}
              hasUnfilteredPlaces={places.length > 0}
              onAdd={handleAdd}
            />
          )}
        </div>

        {/* Side panel */}
        <div className={cn(
          'absolute top-0 right-0 bottom-0 w-96 bg-card border-l border-border flex flex-col transition-transform duration-200 z-10',
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        )}>
          {overlayMode === 'add' && (
            <WeekendPlaceForm onSave={handleSaveNew} onCancel={closeOverlay} />
          )}
          {overlayMode === 'edit' && freshSelected && (
            <WeekendPlaceForm
              initial={freshSelected}
              onSave={handleSaveEdit}
              onCancel={() => setOverlayMode('detail')}
            />
          )}
          {overlayMode === 'detail' && freshSelected && (
            <WeekendPlaceDetail
              place={freshSelected}
              onClose={closeOverlay}
              onEdit={() => setOverlayMode('edit')}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onMarkVisited={handleMarkVisited}
            />
          )}
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
    </PageWrapper>
  );
}
