import * as React from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeatherCondition } from '@/components/widgets/WeatherWidget';

/**
 * Tinted Lucide icon for a weather condition. Centralized so calendar views
 * stay consistent with /week's DayColumn.
 */
export function weatherIcon(cond: WeatherCondition | undefined, size: 'sm' | 'lg' = 'sm'): React.ReactNode {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  switch (cond) {
    case 'sunny':
      return <Sun className={cn(cls, 'text-warning')} aria-hidden />;
    case 'partly-cloudy':
      return <CloudSun className={cn(cls, 'text-warning')} aria-hidden />;
    case 'cloudy':
      return <Cloud className={cn(cls, 'text-slate-400 dark:text-white/70')} aria-hidden />;
    case 'rainy':
      return <CloudRain className={cn(cls, 'text-blue-400')} aria-hidden />;
    case 'snowy':
      return <CloudSnow className={cn(cls, 'text-blue-200')} aria-hidden />;
    default:
      return null;
  }
}
