'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useAutoOrientationSetting } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useMessages } from '@/lib/hooks/useMessages';
import { format } from 'date-fns';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind } from 'lucide-react';
import { ResponsiveGridLayout as RGL, useContainerWidth, noCompactor } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const SCREENSAVER_LAYOUT_KEY = 'prism-screensaver-layout';

interface ScreensaverWidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const defaultLayout: ScreensaverWidgetLayout[] = [
  { i: 'clock', x: 8, y: 9, w: 4, h: 3 },
  { i: 'weather', x: 8, y: 7, w: 4, h: 2 },
  { i: 'messages', x: 8, y: 4, w: 4, h: 3 },
];

function loadScreensaverLayout(): ScreensaverWidgetLayout[] {
  if (typeof window === 'undefined') return defaultLayout;
  try {
    const stored = localStorage.getItem(SCREENSAVER_LAYOUT_KEY);
    return stored ? JSON.parse(stored) : defaultLayout;
  } catch { return defaultLayout; }
}

export function saveScreensaverLayout(layout: ScreensaverWidgetLayout[]) {
  localStorage.setItem(SCREENSAVER_LAYOUT_KEY, JSON.stringify(layout));
}

export function Screensaver() {
  const { isIdle } = useIdleDetection();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
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

  // Rotate photos
  useEffect(() => {
    if (!isIdle || photos.length <= 1) return;
    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, 15000);
    return () => clearInterval(timer);
  }, [isIdle, photos.length]);

  // Fade in/out
  useEffect(() => {
    if (isIdle) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isIdle]);

  if (!isIdle) return null;

  const photo = photos[currentIndex];
  const src = photo ? `/api/photos/${photo.id}/file` : '';

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Full-screen photo background */}
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fadingOut ? 0 : 1,
          }}
        />
      )}
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Grid overlay for widgets */}
      <ScreensaverGrid />
    </div>
  );
}

function ScreensaverGrid() {
  const [layout, setLayout] = useState<ScreensaverWidgetLayout[]>(loadScreensaverLayout);
  const { width, containerRef, mounted } = useContainerWidth();

  const rowHeight = useMemo(() => {
    if (typeof window === 'undefined') return 60;
    return Math.max(30, Math.floor((window.innerHeight - 24) / 12));
  }, []);

  const rglLayout: LayoutItem[] = useMemo(
    () => layout.map((w) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 1 })),
    [layout]
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
          compactor={noCompactor}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          onLayoutChange={handleLayoutChange}
          containerPadding={[12, 12]}
          margin={[0, 0]}
        >
          <div key="clock"><ScreensaverClock /></div>
          <div key="weather"><ScreensaverWeather /></div>
          <div key="messages"><ScreensaverMessages /></div>
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
