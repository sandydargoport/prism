'use client';

import React, { useMemo, createContext, useContext } from 'react';
import { DAYS_OF_WEEK } from '@/lib/constants/days';
import type { MobileLayoutMode } from '@/lib/hooks/useMobileLayout';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import Link from 'next/link';
import {
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudSun,
  MessageSquare,
  CheckSquare,
  ClipboardList,
  ShoppingCart,
  UtensilsCrossed,
  Cake,
  ChevronRight,
  Trophy,
  Heart,
  Bus,
  Clock,
  Image as ImageIcon,
  ChefHat,
} from 'lucide-react';
import type { useDashboardData } from './useDashboardData';
import type { CalendarEvent } from '@/types/calendar';
import type { BusRouteStatus, BusPrediction } from '@/lib/hooks/useBusTracking';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';

type DashData = ReturnType<typeof useDashboardData>;

const LayoutCtx = createContext<MobileLayoutMode>('rows');
export const MobileLayoutProvider = LayoutCtx.Provider;

function CardShell({ href, icon, title, count, children }: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const compact = useContext(LayoutCtx) === 'tiles';
  const inner = (
    <div className={`bg-card/85 backdrop-blur-sm rounded-xl border border-border hover:border-primary/30 transition-colors ${compact ? 'p-3' : 'p-3'}`}>
      <div className={`flex items-center justify-between ${compact ? '' : 'mb-2'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
          )}
        </div>
        {href && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
      {!compact && children}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}

export function WeatherCard({ data }: { data: DashData['weather'] }) {
  if (data.loading || !data.data) return null;
  const wd = data.data;
  const cur = wd.current;
  if (cur?.temperature == null) return null;

  const iconCls = 'h-5 w-5';
  const icon = cur.condition === 'sunny' ? <Sun className={iconCls} /> :
    cur.condition === 'partly-cloudy' ? <CloudSun className={iconCls} /> :
    cur.condition === 'rainy' || cur.condition === 'stormy' ? <CloudRain className={iconCls} /> :
    cur.condition === 'snowy' ? <CloudSnow className={iconCls} /> :
    <Cloud className={iconCls} />;

  return (
    <div className="bg-card/85 backdrop-blur-sm rounded-xl border border-border p-3 flex items-center gap-3">
      {icon}
      <span className="text-2xl font-light tabular-nums">{Math.round(cur.temperature)}°{wd.units.temperature}</span>
      <span className="text-sm text-muted-foreground capitalize">{cur.description}</span>
    </div>
  );
}

export function ClockCard() {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const now = new Date();
  const displayNow = toDisplayDate(now, displayTimezone);
  return (
    <div className="bg-card/85 backdrop-blur-sm rounded-xl border border-border p-3 flex items-center gap-3">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <span className="text-2xl font-light tabular-nums">{formatDisplayTime(now, timeFormat, {}, displayTimezone)}</span>
      <span className="text-sm text-muted-foreground">{format(displayNow, 'EEEE, MMM d')}</span>
    </div>
  );
}

export function CalendarCard({ data }: { data: DashData['calendar'] }) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const upcoming = useMemo(() => {
    if (!data.events) return [];
    const now = new Date();
    return data.events
      .filter((e: CalendarEvent) => e.endTime > now)
      .sort((a: CalendarEvent, b: CalendarEvent) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 3);
  }, [data.events]);

  return (
    <CardShell href="/calendar" icon={<Calendar className="h-4 w-4 text-blue-500" />} title="Calendar" count={upcoming.length}>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming events</p>
      ) : (
        <div className="space-y-1">
          {upcoming.map((e: CalendarEvent) => {
            const displayStart = toDisplayDate(e.startTime, displayTimezone);
            const displayNow = toDisplayDate(new Date(), displayTimezone);
            return (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
              <span className="truncate flex-1">{e.title}</span>
              <span className="text-muted-foreground shrink-0">
                {isSameDay(displayStart, displayNow) ? formatDisplayTime(e.startTime, timeFormat, {}, displayTimezone) :
                 isSameDay(displayStart, addDays(displayNow, 1)) ? `Tomorrow ${formatDisplayTime(e.startTime, timeFormat, {}, displayTimezone)}` :
                 `${format(displayStart, 'EEE')} ${formatDisplayTime(e.startTime, timeFormat, {}, displayTimezone)}`}
              </span>
            </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

export function ChoresCard({ data }: { data: DashData['chores'] }) {
  const dueCount = useMemo(() => {
    if (!data.chores) return 0;
    return data.chores.filter((c: { enabled: boolean; nextDue?: string }) =>
      c.enabled && (!c.nextDue || new Date(c.nextDue) <= new Date())
    ).length;
  }, [data.chores]);

  return (
    <CardShell href="/chores" icon={<ClipboardList className="h-4 w-4 text-orange-500" />} title="Chores" count={dueCount}>
      <p className="text-xs text-muted-foreground">
        {dueCount === 0 ? 'All caught up!' : `${dueCount} chore${dueCount > 1 ? 's' : ''} due`}
      </p>
    </CardShell>
  );
}

export function TasksCard({ data }: { data: DashData['tasks'] }) {
  const incomplete = useMemo(() => {
    if (!data.tasks) return [];
    return data.tasks.filter((t: { completed?: boolean }) => !t.completed).slice(0, 3);
  }, [data.tasks]);

  return (
    <CardShell href="/tasks" icon={<CheckSquare className="h-4 w-4 text-green-500" />} title="Tasks" count={incomplete.length}>
      {incomplete.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks</p>
      ) : (
        <div className="space-y-1">
          {incomplete.map((t: { id: string; title: string }) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function ShoppingCard({ data }: { data: DashData['shopping'] }) {
  const totalUnchecked = useMemo(() => {
    if (!data.lists) return 0;
    return data.lists.reduce((sum, list) =>
      sum + (list.items?.filter((i) => !i.checked).length || 0), 0);
  }, [data.lists]);

  return (
    <CardShell href="/shopping" icon={<ShoppingCart className="h-4 w-4 text-purple-500" />} title="Shopping" count={totalUnchecked}>
      <p className="text-xs text-muted-foreground">
        {totalUnchecked === 0 ? 'Lists are clear' : `${totalUnchecked} item${totalUnchecked > 1 ? 's' : ''} to get`}
      </p>
    </CardShell>
  );
}

export function MealsCard({ data }: { data: DashData['meals'] }) {
  const todayMeal = useMemo(() => {
    if (!data.meals) return null;
    const todayDay = DAYS_OF_WEEK[new Date().getDay()];
    const currentWeekOf = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisWeek = data.meals.filter((m) => m.weekOf === currentWeekOf);
    return thisWeek.find((m) => m.dayOfWeek === todayDay && m.mealType === 'dinner')
      || thisWeek.find((m) => m.dayOfWeek === todayDay)
      || null;
  }, [data.meals]);

  return (
    <CardShell href="/meals" icon={<UtensilsCrossed className="h-4 w-4 text-amber-500" />} title="Meals">
      <p className="text-xs text-muted-foreground">
        {todayMeal ? `Today: ${todayMeal.name || todayMeal.recipe || 'Planned'}` : 'No meal planned today'}
      </p>
    </CardShell>
  );
}

export function MessagesCard({ data }: { data: DashData['messages'] }) {
  const latest = data.messages?.[0];

  return (
    <CardShell href="/messages" icon={<MessageSquare className="h-4 w-4 text-sky-500" />} title="Messages" count={data.messages?.length}>
      <p className="text-xs text-muted-foreground truncate">
        {latest ? `${latest.author.name}: ${latest.message}` : 'No messages'}
      </p>
    </CardShell>
  );
}

export function BirthdaysCard({ data }: { data: DashData['birthdays'] }) {
  const upcoming = useMemo(() => {
    if (!data.birthdays) return [];
    return data.birthdays.slice(0, 2);
  }, [data.birthdays]);

  if (upcoming.length === 0) return null;

  return (
    <CardShell icon={<Cake className="h-4 w-4 text-pink-500" />} title="Birthdays" count={upcoming.length}>
      <div className="space-y-1">
        {upcoming.map((b) => (
          <p key={b.id} className="text-xs text-muted-foreground">
            {b.name} — {b.nextBirthday ? format(new Date(b.nextBirthday), 'MMM d') : ''}
          </p>
        ))}
      </div>
    </CardShell>
  );
}

export function PointsCard({ data }: { data: DashData['points'] }) {
  if (data.loading || !data.goals?.length) return null;

  const activeGoals = data.goals.filter((g) => g.active && !g.fullyAchieved).slice(0, 2);

  return (
    <CardShell href="/goals" icon={<Trophy className="h-4 w-4 text-yellow-500" />} title="Goals" count={activeGoals.length}>
      {activeGoals.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active goals</p>
      ) : (
        <div className="space-y-1">
          {activeGoals.map((g) => (
            <p key={g.id} className="text-xs text-muted-foreground truncate">
              {g.name} ({g.pointCost} pts)
            </p>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function RecipesCard() {
  return (
    <CardShell href="/recipes" icon={<ChefHat className="h-4 w-4 text-orange-500" />} title="Recipes">
      <p className="text-xs text-muted-foreground">Browse recipes or import from a URL</p>
    </CardShell>
  );
}

export function WishesCard() {
  return (
    <CardShell href="/wishes" icon={<Heart className="h-4 w-4 text-rose-500" />} title="Wishes">
      <p className="text-xs text-muted-foreground">View wish lists</p>
    </CardShell>
  );
}

export function PhotosCard() {
  return (
    <CardShell href="/photos" icon={<ImageIcon className="h-4 w-4 text-teal-500" />} title="Photos">
      <p className="text-xs text-muted-foreground">Browse photo gallery</p>
    </CardShell>
  );
}

function busStatusColor(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop':
    case 'at_school': return 'bg-green-500';
    case 'in_transit':
    case 'cold_start': return 'bg-amber-500';
    case 'overdue': return 'bg-red-500';
    default: return 'bg-muted-foreground/40';
  }
}

function busStatusText(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop': return 'Arrived at stop';
    case 'at_school': return 'Arrived at school';
    case 'in_transit':
      if (p.etaRangeLow != null && p.etaRangeHigh != null && p.etaRangeLow !== p.etaRangeHigh)
        return `${p.etaRangeLow}–${p.etaRangeHigh} min away`;
      if (p.etaMinutes != null) return `~${p.etaMinutes} min away`;
      return 'In transit';
    case 'cold_start':
      if (p.lastCheckpointIndex === -1) return 'En route from school';
      if (p.lastCheckpointName && p.minutesSinceLastCheckpoint != null)
        return `${p.minutesSinceLastCheckpoint}m ago at ${p.lastCheckpointName}`;
      return 'In transit';
    case 'overdue': return 'Overdue — no updates';
    default: return 'No updates yet';
  }
}

export function BusTrackingCard({ routes }: { routes: BusRouteStatus[] }) {
  if (!routes || routes.length === 0) return null;

  const active = routes.filter((r) => r.prediction.status !== 'no_data');

  return (
    <CardShell icon={<Bus className="h-4 w-4 text-amber-600" />} title="Bus Tracker" count={active.length}>
      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active routes</p>
      ) : (
        <div className="space-y-2">
          {active.slice(0, 3).map((r) => (
            <div key={r.id} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate">{r.label}</span>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{r.scheduledTime}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${busStatusColor(r.prediction)}`} />
                <span className="text-[11px] text-muted-foreground">{busStatusText(r.prediction)}</span>
              </div>
              {r.prediction.lastCheckpointName && r.prediction.minutesSinceLastCheckpoint != null &&
                r.prediction.status === 'in_transit' && (
                <p className="text-[10px] text-muted-foreground/70 pl-3.5">
                  Last: {r.prediction.lastCheckpointName} ({r.prediction.minutesSinceLastCheckpoint}m ago)
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}
