'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useMessages } from '@/lib/hooks/useMessages';
import { SlideshowCore } from '@/components/photos/SlideshowCore';
import { format } from 'date-fns';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind } from 'lucide-react';

export function Screensaver() {
  const { isIdle } = useIdleDetection();
  const { photos } = usePhotos({ sort: 'random', limit: 50 });
  const { messages } = useMessages({ limit: 5 });
  const [time, setTime] = useState(new Date());
  const [visible, setVisible] = useState(false);

  // Update clock
  useEffect(() => {
    if (!isIdle) return;
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isIdle]);

  // Fade in/out
  useEffect(() => {
    if (isIdle && photos.length > 0) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isIdle, photos.length]);

  if (!isIdle || photos.length === 0) return null;

  // Get recent messages (last 3)
  const recentMessages = messages.slice(0, 3);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex h-full w-full">
        {/* Left side: Photo — floats over transparent background */}
        <div className="w-1/2 h-full flex items-center justify-center">
          <SlideshowCore
            photos={photos}
            interval={15}
            transition="fade"
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Right side: Info panel — clustered at bottom-right */}
        <div className="w-1/2 h-full flex flex-col justify-end p-6 text-right gap-6">
          {/* Messages */}
          {recentMessages.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-white/40">
                Family Messages
              </div>
              {recentMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2 justify-end">
                  <div className="min-w-0 text-right">
                    <p className="text-sm text-white/90 line-clamp-2">
                      {msg.message}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {msg.author?.name}
                    </p>
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
          )}

          {/* Weather */}
          <div className="text-white/80 flex justify-end">
            <ScreensaverWeather />
          </div>

          {/* Clock */}
          <div className="text-white">
            <div className="text-7xl font-light tabular-nums">
              {format(time, 'h:mm')}
              <span className="text-3xl ml-2 opacity-70">{format(time, 'a')}</span>
            </div>
            <div className="text-lg mt-1 text-white/60">
              {format(time, 'EEEE, MMMM d')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Inline weather display for screensaver
 */
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
          if (data.current) {
            setWeather(data.current);
          }
        }
      } catch {
        // Silently fail — weather is optional
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  const icon = getWeatherIcon(weather.condition);

  return (
    <div className="flex items-center gap-4">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="text-3xl font-light">
          {Math.round(weather.temperature)}°F
        </div>
        <div className="text-sm text-white/50 capitalize">
          {weather.description}
        </div>
      </div>
      <div className="ml-4 text-sm text-white/40 space-y-1">
        <div className="flex items-center gap-1">
          <Droplets className="h-3 w-3" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1">
          <Wind className="h-3 w-3" />
          {weather.windSpeed} mph
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
