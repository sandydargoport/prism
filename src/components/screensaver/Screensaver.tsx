'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useAutoOrientationSetting, usePinnedPhoto } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useMessages } from '@/lib/hooks/useMessages';
import { format, isToday, isTomorrow, startOfDay } from 'date-fns';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind } from 'lucide-react';
import { ResponsiveGridLayout as RGL, useContainerWidth, getCompactor } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const SCREENSAVER_LAYOUT_KEY = 'prism-screensaver-layout';

const overlapCompactor = getCompactor(null, true);

export const DEFAULT_SCREENSAVER_LAYOUT: WidgetConfig[] = [
  { i: 'clock', x: 8, y: 9, w: 4, h: 3, visible: true },
  { i: 'weather', x: 8, y: 7, w: 4, h: 2, visible: true },
  { i: 'messages', x: 8, y: 4, w: 4, h: 3, visible: true },
  { i: 'calendar', x: 0, y: 4, w: 4, h: 4, visible: false },
  { i: 'birthdays', x: 0, y: 8, w: 4, h: 4, visible: false },
  { i: 'tasks', x: 0, y: 0, w: 3, h: 4, visible: false },
  { i: 'chores', x: 3, y: 0, w: 3, h: 4, visible: false },
  { i: 'shopping', x: 6, y: 0, w: 3, h: 4, visible: false },
  { i: 'meals', x: 0, y: 4, w: 4, h: 4, visible: false },
  { i: 'photos', x: 4, y: 4, w: 4, h: 4, visible: false },
];

export function loadScreensaverLayout(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_SCREENSAVER_LAYOUT;
  try {
    const stored = localStorage.getItem(SCREENSAVER_LAYOUT_KEY);
    if (!stored) return DEFAULT_SCREENSAVER_LAYOUT;
    const parsed = JSON.parse(stored) as WidgetConfig[];
    return DEFAULT_SCREENSAVER_LAYOUT.map(def => {
      const saved = parsed.find(p => p.i === def.i);
      return saved ? { ...def, ...saved } : def;
    });
  } catch { return DEFAULT_SCREENSAVER_LAYOUT; }
}

export function saveScreensaverLayout(layout: WidgetConfig[]) {
  localStorage.setItem(SCREENSAVER_LAYOUT_KEY, JSON.stringify(layout));
}

const SCREENSAVER_PRESETS_KEY = 'prism-screensaver-presets';

export function getScreensaverPresets(): Array<{ name: string; widgets: WidgetConfig[] }> {
  try {
    const stored = localStorage.getItem(SCREENSAVER_PRESETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function saveScreensaverPreset(name: string, widgets: WidgetConfig[]) {
  const presets = getScreensaverPresets();
  const existing = presets.findIndex(p => p.name === name);
  if (existing >= 0) presets[existing] = { name, widgets };
  else presets.push({ name, widgets });
  localStorage.setItem(SCREENSAVER_PRESETS_KEY, JSON.stringify(presets));
}

export function deleteScreensaverPreset(name: string) {
  const presets = getScreensaverPresets().filter(p => p.name !== name);
  localStorage.setItem(SCREENSAVER_PRESETS_KEY, JSON.stringify(presets));
}

export function Screensaver() {
  const { isIdle } = useIdleDetection();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('screensaver');
  const screenOrientation = useScreenOrientation();
  const orientationOverride = typeof window !== 'undefined'
    ? (localStorage.getItem('prism-orientation-override') as 'landscape' | 'portrait' | null) || null
    : null;
  const effectiveOrientation = orientationOverride || screenOrientation;
  const { photos } = usePhotos({
    sort: 'random',
    limit: 50,
    usage: 'screensaver',
    orientation: autoOrientation ? effectiveOrientation : undefined,
  });
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Only rotate if no pinned photo
  useEffect(() => {
    if (!isIdle || photos.length <= 1 || pinnedId) return;
    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, 15000);
    return () => clearInterval(timer);
  }, [isIdle, photos.length, pinnedId]);

  useEffect(() => {
    if (isIdle) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isIdle]);

  if (!isIdle) return null;

  // Use pinned photo if set, otherwise use rotating photos
  const src = pinnedId
    ? `/api/photos/${pinnedId}/file`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file`
      : '';

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fadingOut ? 0 : 1,
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/40" />
      <ScreensaverGrid />
    </div>
  );
}

function ScreensaverGrid() {
  const [layout, setLayout] = useState<WidgetConfig[]>(loadScreensaverLayout);
  const { width, containerRef, mounted } = useContainerWidth();

  const rowHeight = useMemo(() => {
    if (typeof window === 'undefined') return 60;
    return Math.max(30, Math.floor((window.innerHeight - 24) / 12));
  }, []);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout]
  );

  const rglLayout: LayoutItem[] = useMemo(
    () => visibleWidgets.map((w) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 1 })),
    [visibleWidgets]
  );

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    const updated = layoutRef.current.map((w) => {
      const found = newLayout.find((l: LayoutItem) => l.i === w.i);
      if (found) return { ...w, x: found.x, y: found.y, w: found.w, h: found.h };
      return w;
    });
    setLayout(updated);
    saveScreensaverLayout(updated);
  }, []);

  const getWidgetStyle = (w: WidgetConfig) => {
    if (!w.backgroundColor) return undefined;
    return {
      backgroundColor: w.backgroundColor,
      borderRadius: '0.5rem',
      opacity: w.backgroundOpacity ?? 1,
    };
  };

  const renderWidget = (w: WidgetConfig) => {
    switch (w.i) {
      case 'clock': return <ScreensaverClock />;
      case 'weather': return <ScreensaverWeather />;
      case 'messages': return <ScreensaverMessages />;
      case 'calendar': return <ScreensaverCalendar gridH={w.h} />;
      case 'birthdays': return <ScreensaverBirthdays />;
      case 'tasks': return <ScreensaverTasks />;
      case 'chores': return <ScreensaverChores />;
      case 'shopping': return <ScreensaverShopping />;
      case 'meals': return <ScreensaverMeals />;
      case 'photos': return <ScreensaverPhotos />;
      default: return null;
    }
  };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="relative w-full h-full">
      {mounted && width > 0 && (
        <RGL
          className="layout"
          width={width}
          layouts={{ lg: rglLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 9, sm: 6, xs: 3 }}
          rowHeight={rowHeight}
          compactor={overlapCompactor}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          onLayoutChange={handleLayoutChange}
          containerPadding={[12, 12]}
          margin={[0, 0]}
        >
          {visibleWidgets.map(w => (
            <div key={w.i} style={getWidgetStyle(w)}>
              {renderWidget(w)}
            </div>
          ))}
        </RGL>
      )}
    </div>
  );
}

export { ScreensaverGrid };

function ScreensaverClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col justify-end text-white text-right p-2">
      <div className="text-7xl font-light tabular-nums">
        {format(time, 'h:mm')}
        <span className="text-3xl ml-2 opacity-70">{format(time, 'a')}</span>
      </div>
      <div className="text-lg mt-1 text-white/60">
        {format(time, 'EEEE, MMMM d')}
      </div>
    </div>
  );
}

function ScreensaverMessages() {
  const { messages } = useMessages({ limit: 5 });
  const recentMessages = messages.slice(0, 3);

  if (recentMessages.length === 0) return null;

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        Family Messages
      </div>
      {recentMessages.map((msg) => (
        <div key={msg.id} className="flex items-start gap-2 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-sm text-white/90 line-clamp-2">{msg.message}</p>
            <p className="text-xs text-white/40 mt-0.5">{msg.author?.name}</p>
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: msg.author?.color || '#3B82F6' }}
          >
            {msg.author?.name?.charAt(0) || '?'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreensaverWeather() {
  const [weather, setWeather] = useState<{
    temperature: number;
    condition: string;
    description: string;
    humidity: number;
    windSpeed: number;
  } | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch('/api/weather');
        if (res.ok) {
          const data = await res.json();
          if (data.current) setWeather(data.current);
        }
      } catch { /* optional */ }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  const icon = getWeatherIcon(weather.condition);

  return (
    <div className="h-full flex items-end justify-end p-2">
      <div className="flex items-center gap-4 text-white/80">
        <div className="text-4xl">{icon}</div>
        <div>
          <div className="text-3xl font-light">{Math.round(weather.temperature)}°F</div>
          <div className="text-sm text-white/50 capitalize">{weather.description}</div>
        </div>
        <div className="ml-4 text-sm text-white/40 space-y-1">
          <div className="flex items-center gap-1"><Droplets className="h-3 w-3" />{weather.humidity}%</div>
          <div className="flex items-center gap-1"><Wind className="h-3 w-3" />{weather.windSpeed} mph</div>
        </div>
      </div>
    </div>
  );
}

function getWeatherIcon(condition: string): React.ReactNode {
  const cls = "h-10 w-10 text-white/70";
  switch (condition) {
    case 'sunny': return <Sun className={cls} />;
    case 'partly-cloudy': return <CloudSun className={cls} />;
    case 'cloudy': return <Cloud className={cls} />;
    case 'rainy':
    case 'stormy': return <CloudRain className={cls} />;
    case 'snowy': return <CloudSnow className={cls} />;
    default: return <Cloud className={cls} />;
  }
}

function ScreensaverCalendar({ gridH }: { gridH?: number }) {
  const [events, setEvents] = useState<Array<{ id: string; title: string; startTime: Date; allDay: boolean }>>([]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const now = new Date();
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const res = await fetch(`/api/events?startDate=${now.toISOString()}&endDate=${endDate.toISOString()}`);
        if (res.ok) {
          const data = await res.json();
          const upcoming = (data.events || [])
            .map((e: { id: string; title: string; startTime: string; allDay: boolean }) => ({
              ...e,
              startTime: new Date(e.startTime),
            }))
            .sort((a: { startTime: Date }, b: { startTime: Date }) => a.startTime.getTime() - b.startTime.getTime());
          setEvents(upcoming);
        }
      } catch { /* optional */ }
    }
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (events.length === 0) return null;

  const useAgendaView = (gridH ?? 0) >= 4;

  if (useAgendaView) {
    const grouped = new Map<string, typeof events>();
    for (const event of events) {
      const dayKey = startOfDay(event.startTime).toISOString();
      const group = grouped.get(dayKey) || [];
      group.push(event);
      grouped.set(dayKey, group);
    }

    const dayEntries = Array.from(grouped.entries()).slice(0, 5);

    return (
      <div className="h-full flex flex-col justify-start text-right p-2 space-y-2 overflow-hidden">
        <div className="text-[10px] uppercase tracking-wider text-white/40">Upcoming</div>
        {dayEntries.map(([dayKey, dayEvents]) => {
          const day = new Date(dayKey);
          const label = isToday(day) ? 'Today' : isTomorrow(day) ? 'Tomorrow' : format(day, 'EEE, MMM d');
          return (
            <div key={dayKey} className="space-y-0.5">
              <div className="text-xs text-white/50 font-medium">{label}</div>
              {dayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="text-sm text-white/80">
                  <span className="text-white/90">{event.title}</span>
                  <span className="text-white/50 ml-2 text-xs">
                    {event.allDay ? 'All day' : format(event.startTime, 'h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  const displayEvents = events.slice(0, 3);
  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">Upcoming</div>
      {displayEvents.map((event) => (
        <div key={event.id} className="text-sm text-white/80">
          <span className="text-white/90">{event.title}</span>
          <span className="text-white/50 ml-2 text-xs">
            {event.allDay ? 'All day' : format(event.startTime, 'EEE h:mm a')}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScreensaverBirthdays() {
  const [birthdays, setBirthdays] = useState<Array<{ id: string; name: string; daysUntil: number }>>([]);

  useEffect(() => {
    async function fetchBirthdays() {
      try {
        const res = await fetch('/api/birthdays?limit=3');
        if (res.ok) {
          const data = await res.json();
          setBirthdays(data.birthdays || []);
        }
      } catch { /* optional */ }
    }
    fetchBirthdays();
  }, []);

  if (birthdays.length === 0) return null;

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">Birthdays</div>
      {birthdays.map((b) => (
        <div key={b.id} className="text-sm text-white/80">
          {b.name}
          <span className="text-white/50 ml-2 text-xs">
            {b.daysUntil === 0 ? 'Today!' : b.daysUntil === 1 ? 'Tomorrow' : `in ${b.daysUntil} days`}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScreensaverTasks() {
  const [taskList, setTaskList] = useState<Array<{ id: string; title: string; priority: string | null }>>([]);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch('/api/tasks?completed=false&limit=5');
        if (res.ok) {
          const data = await res.json();
          setTaskList((data.tasks || []).slice(0, 5));
        }
      } catch { /* optional */ }
    }
    fetchTasks();
    const interval = setInterval(fetchTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (taskList.length === 0) return null;

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">Tasks</div>
      {taskList.map((task) => (
        <div key={task.id} className="text-sm text-white/80 flex items-center justify-end gap-2">
          <span className="text-white/90 line-clamp-1">{task.title}</span>
          {task.priority === 'high' && (
            <span className="text-red-400 text-xs flex-shrink-0">!</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ScreensaverChores() {
  const [choreList, setChoreList] = useState<Array<{ id: string; title: string; assignedTo: { name: string; color: string } | null }>>([]);

  useEffect(() => {
    async function fetchChores() {
      try {
        const res = await fetch('/api/chores?limit=5');
        if (res.ok) {
          const data = await res.json();
          setChoreList((data.chores || []).slice(0, 5));
        }
      } catch { /* optional */ }
    }
    fetchChores();
    const interval = setInterval(fetchChores, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (choreList.length === 0) return null;

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">Chores</div>
      {choreList.map((chore) => (
        <div key={chore.id} className="text-sm text-white/80 flex items-center justify-end gap-2">
          <span className="text-white/90 line-clamp-1">{chore.title}</span>
          {chore.assignedTo && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: chore.assignedTo.color || '#3B82F6' }}
            >
              {chore.assignedTo.name.charAt(0)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScreensaverShopping() {
  const [items, setItems] = useState<Array<{ id: string; name: string; checked: boolean }>>([]);
  const [listName, setListName] = useState<string>('');

  useEffect(() => {
    async function fetchShopping() {
      try {
        const res = await fetch('/api/shopping-lists');
        if (res.ok) {
          const data = await res.json();
          const lists = data.lists || [];
          if (lists.length > 0) {
            setListName(lists[0].name);
            const itemsRes = await fetch(`/api/shopping-items?listId=${lists[0].id}`);
            if (itemsRes.ok) {
              const itemsData = await itemsRes.json();
              setItems((itemsData.items || []).filter((i: { checked: boolean }) => !i.checked).slice(0, 6));
            }
          }
        }
      } catch { /* optional */ }
    }
    fetchShopping();
    const interval = setInterval(fetchShopping, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {listName || 'Shopping'}
      </div>
      {items.map((item) => (
        <div key={item.id} className="text-sm text-white/80">
          {item.name}
        </div>
      ))}
    </div>
  );
}

function ScreensaverMeals() {
  const [mealList, setMealList] = useState<Array<{ id: string; name: string; mealType: string }>>([]);

  useEffect(() => {
    async function fetchMeals() {
      try {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        const weekOf = format(monday, 'yyyy-MM-dd');

        const res = await fetch(`/api/meals?weekOf=${weekOf}`);
        if (res.ok) {
          const data = await res.json();
          const todayName = format(now, 'EEEE').toLowerCase();
          const todayMeals = (data.meals || []).filter(
            (m: { dayOfWeek: string }) => m.dayOfWeek === todayName
          );
          setMealList(todayMeals.slice(0, 4));
        }
      } catch { /* optional */ }
    }
    fetchMeals();
    const interval = setInterval(fetchMeals, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (mealList.length === 0) return null;

  const typeOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sorted = [...mealList].sort((a, b) => typeOrder.indexOf(a.mealType) - typeOrder.indexOf(b.mealType));

  return (
    <div className="h-full flex flex-col justify-end text-right p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/40">Today&apos;s Meals</div>
      {sorted.map((meal) => (
        <div key={meal.id} className="text-sm text-white/80">
          <span className="text-white/90">{meal.name}</span>
          <span className="text-white/50 ml-2 text-xs capitalize">{meal.mealType}</span>
        </div>
      ))}
    </div>
  );
}

function ScreensaverPhotos() {
  const { photos } = usePhotos({ sort: 'random', limit: 10, usage: 'screensaver' });
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % photos.length);
        setFade(false);
      }, 800);
    }, 10000);
    return () => clearInterval(timer);
  }, [photos.length]);

  if (photos.length === 0) return null;

  const photo = photos[index];
  const src = photo ? `/api/photos/${photo.id}/file` : '';

  return (
    <div className="h-full w-full relative overflow-hidden rounded">
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-800"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fade ? 0 : 1,
          }}
        />
      )}
    </div>
  );
}
