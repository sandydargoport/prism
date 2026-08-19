'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind } from 'lucide-react';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useAutoOrientationSetting, usePinnedPhoto, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { ExitAwayModeModal } from './ExitAwayModeModal';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime } from '@/lib/utils/timeFormat';

export function AwayModeOverlay() {
  const { isAway, toggle } = useAwayMode();
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('screensaver');
  const { interval: photoInterval } = useScreensaverInterval();
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
  const [showExitModal, setShowExitModal] = useState(false);

  // Photo rotation
  useEffect(() => {
    if (!isAway || photos.length <= 1 || pinnedId || photoInterval === 0) return;
    const timer = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % photos.length);
        setFadingOut(false);
      }, 1000);
    }, photoInterval * 1000);
    return () => clearInterval(timer);
  }, [isAway, photos.length, pinnedId, photoInterval]);

  // Fade in effect
  useEffect(() => {
    if (isAway) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setShowExitModal(false);
    }
  }, [isAway]);

  const handleExitSuccess = useCallback(async () => {
    await toggle(false);
    setShowExitModal(false);
  }, [toggle]);

  const handleOverlayClick = useCallback(() => {
    setShowExitModal(true);
  }, []);

  if (!isAway) return null;

  const src = pinnedId
    ? `/api/photos/${pinnedId}/file`
    : photos[currentIndex]
      ? `/api/photos/${photos[currentIndex]!.id}/file`
      : '';

  return (
    <div
      className={`fixed inset-0 z-[9998] bg-black transition-opacity duration-1000 cursor-pointer ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleOverlayClick}
    >
      {/* Background photo */}
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: fadingOut ? 0 : 1,
          }}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Header bar — clock left, weather right */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <AwayModeClock />
          <AwayModeWeather />
        </div>
      </div>

      {/* Center tap prompt */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-white/40 text-sm">
          Tap anywhere to unlock
        </div>
      </div>

      {/* Exit modal */}
      <ExitAwayModeModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onSuccess={handleExitSuccess}
      />
    </div>
  );
}

function AwayModeClock() {
  const { timeFormat } = useTimeFormat();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 text-white">
      <div className="text-3xl font-light tabular-nums">
        {formatDisplayTime(time, timeFormat)}
      </div>
      <div className="text-sm text-white/60">
        {format(time, 'EEEE, MMMM d')}
      </div>
    </div>
  );
}

function AwayModeWeather() {
  const [data, setData] = useState<{
    current: { temperature: number; condition: string; description: string; humidity: number; windSpeed: number };
    units: { temperature: 'F' | 'C'; windSpeed: 'mph' | 'km/h'; precipitation: 'in' | 'mm' };
  } | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch('/api/weather');
        if (res.ok) {
          const json = await res.json();
          if (json.current && json.units) setData({ current: json.current, units: json.units });
        }
      } catch {
        // Weather is optional
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;
  const { current: weather, units } = data;

  const icon = getWeatherIcon(weather.condition);

  return (
    <div className="flex items-center gap-3 text-white/80">
      <div className="text-2xl">{icon}</div>
      <div className="text-xl font-light">{Math.round(weather.temperature)}°{units.temperature}</div>
      <div className="text-sm text-white/50 capitalize">{weather.description}</div>
      <div className="flex items-center gap-3 ml-2 text-xs text-white/40">
        <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{weather.humidity}%</span>
        <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{weather.windSpeed} {units.windSpeed}</span>
      </div>
    </div>
  );
}

function getWeatherIcon(condition: string) {
  const cls = 'h-6 w-6 text-white/70';
  switch (condition) {
    case 'sunny':
      return <Sun className={cls} />;
    case 'partly-cloudy':
      return <CloudSun className={cls} />;
    case 'cloudy':
      return <Cloud className={cls} />;
    case 'rainy':
    case 'stormy':
      return <CloudRain className={cls} />;
    case 'snowy':
      return <CloudSnow className={cls} />;
    default:
      return <Cloud className={cls} />;
  }
}
