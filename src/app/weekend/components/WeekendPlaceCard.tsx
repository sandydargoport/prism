'use client';

import { Star, ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisitPips } from './VisitPips';
import { StarRating } from './StarRating';
import { TagChip } from './TagChip';
import { STATUS_CONFIG } from '../constants';
import type { WeekendPlace } from '../types';

interface WeekendPlaceCardProps {
  place: WeekendPlace;
  selected?: boolean;
  onClick: () => void;
}

export function WeekendPlaceCard({ place, selected, onClick }: WeekendPlaceCardProps) {
  const cfg = STATUS_CONFIG[place.status];
  const pipColor = place.isFavorite ? '#F59E0B' : place.status === 'visited' ? '#10B981' : '#6B7280';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border-2 bg-card transition-all hover:shadow-md active:scale-[0.99]',
        selected ? 'border-primary shadow-md' : 'border-border hover:border-muted-foreground/30'
      )}
    >
      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {place.isFavorite && (
                <Star className="h-3.5 w-3.5 fill-amber-400 text-warning shrink-0" />
              )}
              <h3 className="font-semibold text-sm leading-tight truncate">{place.name}</h3>
            </div>
            {place.placeName && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {place.placeName}
              </p>
            )}
          </div>
          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              title="Open website"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Status + pips row */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.bgClass, cfg.textClass)}>
            {cfg.label}
          </span>
          <VisitPips count={place.visitCount} color={pipColor} />
        </div>

        {/* Rating (only when visited) */}
        {place.status === 'visited' && place.rating && (
          <StarRating value={place.rating} size="sm" />
        )}

        {/* Tags */}
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {place.tags.slice(0, 4).map((tag) => (
              <TagChip key={tag} tag={tag} size="sm" />
            ))}
            {place.tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{place.tags.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
