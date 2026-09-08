'use client';

import { X, Star, ExternalLink, MapPin, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VisitPips } from './VisitPips';
import { StarRating } from './StarRating';
import { TagChip } from './TagChip';
import { STATUS_CONFIG } from '../constants';
import type { WeekendPlace } from '../types';

interface WeekendPlaceDetailProps {
  place: WeekendPlace;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onMarkVisited: () => void;
}

export function WeekendPlaceDetail({
  place, onClose, onEdit, onDelete, onToggleFavorite, onMarkVisited,
}: WeekendPlaceDetailProps) {
  const cfg = STATUS_CONFIG[place.status];
  const pipColor = place.isFavorite ? '#F59E0B' : place.status === 'visited' ? '#10B981' : '#6B7280';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {place.isFavorite && <Star className="h-4 w-4 fill-amber-400 text-warning shrink-0" />}
            <h2 className="font-bold text-base leading-tight">{place.name}</h2>
          </div>
          {place.placeName && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />{place.placeName}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Status + visits */}
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', cfg.bgClass, cfg.textClass)}>
            {cfg.label}
          </span>
          <VisitPips count={place.visitCount} color={pipColor} />
        </div>

        {/* Rating */}
        {place.status === 'visited' && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Rating</p>
            <StarRating value={place.rating} size="md" />
            {place.lastVisitedDate && (
              <p className="text-xs text-muted-foreground">Last visited: {place.lastVisitedDate}</p>
            )}
          </div>
        )}

        {/* Description */}
        {place.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">About</p>
            <p className="text-sm">{place.description}</p>
          </div>
        )}

        {/* Notes */}
        {place.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{place.notes}</p>
          </div>
        )}

        {/* Tags */}
        {place.tags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {place.tags.map((tag) => <TagChip key={tag} tag={tag} />)}
            </div>
          </div>
        )}

        {/* Website */}
        {place.url && (
          <a
            href={place.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visit website
          </a>
        )}

        {/* Address */}
        {place.address && (
          <p className="text-xs text-muted-foreground">{place.address}</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
        {place.status === 'backlog' && (
          <Button onClick={onMarkVisited} className="w-full" size="sm" variant="default">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Mark as Visited
          </Button>
        )}
        {place.status === 'visited' && (
          <Button onClick={onMarkVisited} className="w-full" size="sm" variant="outline">
            <Circle className="h-4 w-4 mr-1.5" />
            Log Another Visit
          </Button>
        )}
        <div className="flex gap-2">
          <Button
            onClick={onToggleFavorite}
            variant="outline"
            size="sm"
            className={cn('flex-1', place.isFavorite && 'border-warning text-warning')}
          >
            <Star className={cn('h-4 w-4 mr-1.5', place.isFavorite && 'fill-amber-400')} />
            {place.isFavorite ? 'Unfavorite' : 'Favorite'}
          </Button>
          <Button onClick={onEdit} variant="outline" size="sm" className="flex-1">
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button onClick={onDelete} variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
