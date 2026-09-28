import { useMemo, useState } from 'react';
import type { TravelPin } from '../types';
import { yearOfDate } from '@/lib/utils/zonedDate';
import { getCountryFromPlaceName, countryWithFlag } from './countryFlag';

export type FilterTab = 'all' | 'been_there' | 'want_to_go' | 'bucket_list' | 'has_national_park';
export type GroupBy = 'year' | 'country' | 'none';

export interface PinGroup {
  key: string;
  label: string;
  pins: TravelPin[];
}

export function usePinListFilter(pins: TravelPin[], pinsWithNpIds: Set<string>) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('year');

  const stats = useMemo(() => ({
    all: pins.length,
    been_there: pins.filter((p) => p.status === 'been_there').length,
    want_to_go: pins.filter((p) => p.status === 'want_to_go').length,
    bucket_list: pins.filter((p) => p.isBucketList).length,
    has_national_park: pins.filter((p) => pinsWithNpIds.has(p.id)).length,
    countries: new Set(
      pins.map((p) => getCountryFromPlaceName(p.placeName)).filter(Boolean)
    ).size,
  }), [pins, pinsWithNpIds]);

  const filtered = useMemo(() => {
    return pins
      .filter((p) => {
        if (filter === 'bucket_list') return p.isBucketList;
        if (filter === 'has_national_park') return pinsWithNpIds.has(p.id);
        if (filter !== 'all') return p.status === filter;
        return true;
      })
      .filter((p) =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        // Visited: newest first; want-to-go: alphabetical
        if (a.status === 'been_there' && b.status === 'been_there') {
          return (b.visitedDate ?? '').localeCompare(a.visitedDate ?? '');
        }
        return a.name.localeCompare(b.name);
      });
  }, [pins, filter, search]);

  const groups = useMemo((): PinGroup[] => {
    if (groupBy === 'year') {
      const map = new Map<string, TravelPin[]>();
      for (const p of filtered) {
        const year = yearOfDate(p.visitedDate);
        const y = year !== null ? String(year) : 'No date';
        if (!map.has(y)) map.set(y, []);
        map.get(y)!.push(p);
      }
      return [...map.entries()]
        .sort(([a], [b]) => {
          if (a === 'No date') return 1;
          if (b === 'No date') return -1;
          return Number(b) - Number(a);
        })
        .map(([key, pins]) => ({ key, label: key, pins }));
    }

    if (groupBy === 'country') {
      const map = new Map<string, TravelPin[]>();
      for (const p of filtered) {
        const c = getCountryFromPlaceName(p.placeName) ?? 'Unknown';
        if (!map.has(c)) map.set(c, []);
        map.get(c)!.push(p);
      }
      return [...map.entries()]
        .sort(([a], [b]) => {
          if (a === 'Unknown') return 1;
          if (b === 'Unknown') return -1;
          return a.localeCompare(b);
        })
        .map(([key, pins]) => ({ key, label: countryWithFlag(key), pins }));
    }

    return [{ key: 'all', label: '', pins: filtered }];
  }, [filtered, groupBy]);

  return { filter, setFilter, search, setSearch, groupBy, setGroupBy, stats, groups };
}
