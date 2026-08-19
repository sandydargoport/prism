'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { format, differenceInDays, parseISO, startOfWeek } from 'date-fns';
import Link from 'next/link';
import {
  Calendar, Cloud, Sun, CloudRain, CloudSnow, CloudSun,
  MessageSquare, CheckSquare, ClipboardList, ShoppingCart,
  UtensilsCrossed, Cake, Trophy, Heart, Bus, Clock,
  Image as ImageIcon, ChefHat, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAYS_OF_WEEK } from '@/lib/constants/days';
import type { useDashboardData } from './useDashboardData';
import type { BusRouteStatus, BusPrediction } from '@/lib/hooks/useBusTracking';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime } from '@/lib/utils/timeFormat';

type DashData = ReturnType<typeof useDashboardData>;

function TileShell({ href, icon, title, children, accent }: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  accent?: string; // Tailwind text color class for the summary
}) {
  const inner = (
    <div className="h-full bg-card/85 backdrop-blur-sm rounded-xl border border-border p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors overflow-hidden">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="font-semibold text-sm truncate">{title}</span>
        </div>
        {href && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </div>
      {children && (
        <div className={cn('flex-1 min-h-0 flex flex-col justify-center gap-0.5', accent)}>
          {children}
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

function TileLine({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <p className={cn('text-xs leading-snug truncate', dim ? 'text-muted-foreground' : 'text-foreground/90')}>
      {children}
    </p>
  );
}

// ── Individual tile cards ─────────────────────────────────────────────────────

export function WeatherTile({ data }: { data: DashData['weather'] }) {
  if (data.loading || !data.data) return (
    <TileShell icon={<Cloud className="h-4 w-4 text-sky-400" />} title="Weather">
      <TileLine dim>Loading…</TileLine>
    </TileShell>
  );
  const wd = data.data;
  const current = wd.current;
  const WeatherIcon = current?.condition === 'sunny' ? Sun
    : current?.condition === 'partly-cloudy' ? CloudSun
    : current?.condition === 'rainy' || current?.condition === 'stormy' ? CloudRain
    : current?.condition === 'snowy' ? CloudSnow
    : Cloud;
  return (
    <TileShell icon={<WeatherIcon className="h-4 w-4 text-sky-400" />} title="Weather">
      {current?.temperature != null && <TileLine>{current.temperature}°{wd.units.temperature}</TileLine>}
      {current?.description && <TileLine dim>{current.description}</TileLine>}
    </TileShell>
  );
}

export function ClockTile() {
  const { timeFormat } = useTimeFormat();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <TileShell icon={<Clock className="h-4 w-4 text-violet-500" />} title="Clock">
      <TileLine>{formatDisplayTime(now, timeFormat)}</TileLine>
      <TileLine dim>{format(now, 'EEE, MMM d')}</TileLine>
    </TileShell>
  );
}

export function CalendarTile({ data }: { data: DashData['calendar'] }) {
  const upcoming = useMemo(() => {
    if (!data.events) return [];
    const now = new Date();
    return data.events
      .filter((e) => new Date(e.endTime) >= now)
      .slice(0, 2);
  }, [data.events]);
  return (
    <TileShell href="/calendar" icon={<Calendar className="h-4 w-4 text-blue-500" />} title="Calendar">
      {upcoming.length === 0
        ? <TileLine dim>Nothing upcoming</TileLine>
        : upcoming.map((e, i) => (
            <TileLine key={i} dim={i > 0}>{e.title}</TileLine>
          ))
      }
    </TileShell>
  );
}

export function ChoresTile({ data }: { data: DashData['chores'] }) {
  const due = useMemo(() => {
    if (!data.chores) return 0;
    return data.chores.filter((c: { enabled: boolean; nextDue?: string }) =>
      c.enabled && c.nextDue && new Date(c.nextDue) <= new Date()
    ).length;
  }, [data.chores]);
  return (
    <TileShell href="/chores" icon={<ClipboardList className="h-4 w-4 text-orange-500" />} title="Chores"
      accent={due > 0 ? 'text-orange-600 dark:text-orange-400' : undefined}>
      <TileLine>{due === 0 ? 'All caught up!' : `${due} due`}</TileLine>
      {data.chores && <TileLine dim>{data.chores.length} total chores</TileLine>}
    </TileShell>
  );
}

export function TasksTile({ data }: { data: DashData['tasks'] }) {
  const incomplete = useMemo(
    () => (data.tasks ?? []).filter((t: { completed?: boolean }) => !t.completed),
    [data.tasks]
  );
  return (
    <TileShell href="/tasks" icon={<CheckSquare className="h-4 w-4 text-green-500" />} title="Tasks">
      <TileLine>{incomplete.length === 0 ? 'All done!' : `${incomplete.length} remaining`}</TileLine>
      {incomplete[0] && <TileLine dim>{(incomplete[0] as { title?: string; name?: string }).title ?? (incomplete[0] as { title?: string; name?: string }).name}</TileLine>}
    </TileShell>
  );
}

export function ShoppingTile({ data }: { data: DashData['shopping'] }) {
  const { totalItems, listCount } = useMemo(() => {
    if (!data.lists) return { totalItems: 0, listCount: 0 };
    const unchecked = data.lists.flatMap((l: { items?: { checked?: boolean }[] }) =>
      (l.items ?? []).filter((i) => !i.checked)
    );
    return { totalItems: unchecked.length, listCount: data.lists.length };
  }, [data.lists]);
  return (
    <TileShell href="/shopping" icon={<ShoppingCart className="h-4 w-4 text-emerald-500" />} title="Shopping">
      <TileLine>{totalItems === 0 ? 'Lists are clear' : `${totalItems} item${totalItems !== 1 ? 's' : ''}`}</TileLine>
      <TileLine dim>{listCount} list{listCount !== 1 ? 's' : ''}</TileLine>
    </TileShell>
  );
}

export function MealsTile({ data }: { data: DashData['meals'] }) {
  const todayMeal = useMemo(() => {
    if (!data.meals) return null;
    const todayDay = DAYS_OF_WEEK[new Date().getDay()];
    const currentWeekOf = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisWeek = data.meals.filter((m) => m.weekOf === currentWeekOf);
    return thisWeek.find((m) => m.dayOfWeek === todayDay && m.mealType === 'dinner')
      ?? thisWeek.find((m) => m.dayOfWeek === todayDay)
      ?? null;
  }, [data.meals]);
  return (
    <TileShell href="/meals" icon={<UtensilsCrossed className="h-4 w-4 text-pink-500" />} title="Meals">
      {todayMeal
        ? <><TileLine>Tonight:</TileLine><TileLine dim>{todayMeal.name ?? todayMeal.recipe ?? 'Planned'}</TileLine></>
        : <TileLine dim>No meal planned</TileLine>
      }
    </TileShell>
  );
}

export function RecipesTile() {
  return (
    <TileShell href="/recipes" icon={<ChefHat className="h-4 w-4 text-orange-500" />} title="Recipes">
      <TileLine>Browse & import</TileLine>
      <TileLine dim>URL · Paprika</TileLine>
    </TileShell>
  );
}

export function MessagesTile({ data }: { data: DashData['messages'] }) {
  const latest = data.messages?.[0] as { author?: { name?: string }; message?: string } | undefined;
  return (
    <TileShell href="/messages" icon={<MessageSquare className="h-4 w-4 text-sky-500" />} title="Messages"
      accent={data.messages?.length ? undefined : undefined}>
      {latest
        ? <><TileLine>{latest.author?.name}</TileLine><TileLine dim>{latest.message}</TileLine></>
        : <TileLine dim>No messages</TileLine>
      }
    </TileShell>
  );
}

export function BirthdaysTile({ data }: { data: DashData['birthdays'] }) {
  const next = useMemo(() => {
    if (!data.birthdays?.length) return null;
    const b = data.birthdays[0] as { name: string; nextBirthday?: string };
    if (!b.nextBirthday) return null;
    const days = differenceInDays(parseISO(b.nextBirthday), new Date());
    const label = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `In ${days} days`;
    return { name: b.name, label };
  }, [data.birthdays]);
  return (
    <TileShell href="/calendar" icon={<Cake className="h-4 w-4 text-pink-400" />} title="Birthdays">
      {next
        ? <><TileLine>{next.name}</TileLine><TileLine dim>{next.label}</TileLine></>
        : <TileLine dim>None upcoming</TileLine>
      }
    </TileShell>
  );
}

export function PointsTile({ data }: { data: DashData['points'] }) {
  const total = useMemo(
    () => (data.points ?? []).reduce((sum, p) => sum + (p.allTime ?? 0), 0),
    [data.points]
  );
  const activeGoals = (data.goals ?? []).filter((g) => g.active).length;
  return (
    <TileShell href="/goals" icon={<Trophy className="h-4 w-4 text-yellow-500" />} title="Goals">
      <TileLine>{total} pts</TileLine>
      <TileLine dim>{activeGoals} active goal{activeGoals !== 1 ? 's' : ''}</TileLine>
    </TileShell>
  );
}

export function WishesTile() {
  return (
    <TileShell href="/wishes" icon={<Heart className="h-4 w-4 text-rose-500" />} title="Wishes">
      <TileLine dim>View wish lists</TileLine>
    </TileShell>
  );
}

export function PhotosTile() {
  return (
    <TileShell href="/photos" icon={<ImageIcon className="h-4 w-4 text-teal-500" />} title="Photos">
      <TileLine dim>Browse gallery</TileLine>
    </TileShell>
  );
}

export function BusTrackingTile({ routes }: { routes: BusRouteStatus[] | null }) {
  const first = routes?.[0];
  const pred: BusPrediction | undefined = first?.prediction;
  const statusLabel = !first ? 'No routes'
    : !pred ? first.label
    : pred.status === 'at_stop' || pred.status === 'at_school' ? 'Arrived'
    : pred.status === 'overdue' ? 'Overdue'
    : pred.etaMinutes != null ? `${pred.etaMinutes} min away`
    : first.label;
  return (
    <TileShell icon={<Bus className="h-4 w-4 text-amber-500" />} title="Bus">
      <TileLine>{statusLabel}</TileLine>
      {first && <TileLine dim>{first.studentName}</TileLine>}
    </TileShell>
  );
}
