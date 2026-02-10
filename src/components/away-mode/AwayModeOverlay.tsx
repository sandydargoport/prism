'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind } from 'lucide-react';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useAutoOrientationSetting, usePinnedPhoto, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { ExitAwayModeModal } from './ExitAwayModeModal';

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

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
        <AwayModeClock />
        <AwayModeWeather />
        <div className="mt-8 text-white/50 text-sm">
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
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center text-white">
      <div className="text-8xl font-light tabular-nums">
        {format(time, 'h:mm')}
        <span className="text-4xl ml-3 opacity-70">{format(time, 'a')}</span>
      </div>
      <div className="text-2xl mt-2 text-white/60">
        {format(time, 'EEEE, MMMM d')}
      </div>
    </div>
  );
}

function AwayModeWeather() {
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
      } catch {
        // Weather is optional
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  const icon = getWeatherIcon(weather.condition);

  return (
    <div className="flex items-center gap-6 mt-6 text-white/80">
      <div className="text-5xl">{icon}</div>
      <div>
        <div className="text-4xl font-light">{Math.round(weather.temperature)}°F</div>
        <div className="text-lg text-white/50 capitalize">{weather.description}</div>
      </div>
      <div className="ml-4 text-sm text-white/40 space-y-1">
        <div className="flex items-center gap-1">
          <Droplets className="h-4 w-4" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1">
          <Wind className="h-4 w-4" />
          {weather.windSpeed} mph
        </div>
      </div>
    </div>
  );
}

function getWeatherIcon(condition: string) {
  const cls = 'h-12 w-12 text-white/70';
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
