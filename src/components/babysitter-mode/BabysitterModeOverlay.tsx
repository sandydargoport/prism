'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Cloud, CloudRain, CloudSnow, Sun, CloudSun, Droplets, Wind,
  Phone, Home, User, ScrollText, AlertTriangle, Lock,
} from 'lucide-react';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { useBabysitterInfo, type BabysitterSection, type BabysitterInfoItem } from '@/lib/hooks/useBabysitterInfo';
import { ExitBabysitterModeModal } from './ExitBabysitterModeModal';
import { cn } from '@/lib/utils';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary?: string;
}

interface HouseInfo {
  label: string;
  value: string;
}

interface ChildInfo {
  name: string;
  age?: string;
  allergies?: string;
  medications?: string;
  bedtime?: string;
  notes?: string;
}

interface HouseRule {
  rule: string;
  importance?: string;
}

export function BabysitterModeOverlay() {
  const { isActive, toggle } = useBabysitterMode();
  const { items } = useBabysitterInfo({ includeSensitive: true });
  const [visible, setVisible] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Fade in effect
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setShowExitModal(false);
    }
  }, [isActive]);

  const handleExitSuccess = useCallback(async () => {
    await toggle(false);
    setShowExitModal(false);
  }, [toggle]);

  const handleOverlayClick = useCallback(() => {
    setShowExitModal(true);
  }, []);

  if (!isActive) return null;

  const getItemsBySection = (section: BabysitterSection) =>
    items.filter((item) => item.section === section);

  return (
    <div
      className={`fixed inset-0 z-[9997] bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 transition-opacity duration-1000 cursor-pointer overflow-auto ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleOverlayClick}
    >
      {/* Header with clock and weather */}
      <div className="sticky top-0 z-10 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <BabysitterClock />
          </div>
          <BabysitterWeather />
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 pb-24">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Babysitter Information
        </h1>

        {items.length === 0 ? (
          <div className="text-center text-white/60 py-12">
            <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No information configured</p>
            <p className="text-sm mt-1">Parents can add info in Settings</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {/* Emergency Contacts */}
            <SectionCard
              title="Emergency Contacts"
              icon={<Phone className="h-5 w-5" />}
              items={getItemsBySection('emergency_contact')}
              renderItem={(item) => (
                <EmergencyContactCard content={item.content as unknown as EmergencyContact} />
              )}
            />

            {/* House Info */}
            <SectionCard
              title="House Information"
              icon={<Home className="h-5 w-5" />}
              items={getItemsBySection('house_info')}
              renderItem={(item) => (
                <HouseInfoCard content={item.content as unknown as HouseInfo} />
              )}
            />

            {/* Children */}
            <SectionCard
              title="Children"
              icon={<User className="h-5 w-5" />}
              items={getItemsBySection('child_info')}
              renderItem={(item) => (
                <ChildInfoCard content={item.content as unknown as ChildInfo} />
              )}
            />

            {/* House Rules */}
            <SectionCard
              title="House Rules"
              icon={<ScrollText className="h-5 w-5" />}
              items={getItemsBySection('house_rule')}
              renderItem={(item) => (
                <HouseRuleCard content={item.content as unknown as HouseRule} />
              )}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 text-center py-4 bg-black/30 backdrop-blur-sm">
        <p className="text-white/50 text-sm">Tap anywhere to unlock</p>
      </div>

      {/* Exit modal */}
      <ExitBabysitterModeModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onSuccess={handleExitSuccess}
      />
    </div>
  );
}

function BabysitterClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-white">
      <div className="text-4xl font-light tabular-nums">
        {format(time, 'h:mm')}
        <span className="text-xl ml-2 opacity-70">{format(time, 'a')}</span>
      </div>
      <div className="text-sm text-white/60">
        {format(time, 'EEEE, MMMM d')}
      </div>
    </div>
  );
}

function BabysitterWeather() {
  const [weather, setWeather] = useState<{
    temperature: number;
    condition: string;
    description: string;
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
    <div className="flex items-center gap-3 text-white/80">
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-light">{Math.round(weather.temperature)}°F</div>
        <div className="text-xs text-white/50 capitalize">{weather.description}</div>
      </div>
    </div>
  );
}

function getWeatherIcon(condition: string) {
  const cls = 'h-8 w-8 text-white/70';
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

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  items: BabysitterInfoItem[];
  renderItem: (item: BabysitterInfoItem) => React.ReactNode;
}

function SectionCard({ title, icon, items, renderItem }: SectionCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
        {icon}
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>{renderItem(item)}</div>
        ))}
      </div>
    </div>
  );
}

function EmergencyContactCard({ content }: { content: EmergencyContact }) {
  if (!content) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{content.name}</span>
          {content.isPrimary === 'true' && (
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
              Primary
            </span>
          )}
        </div>
        <p className="text-sm text-white/60">{content.relationship}</p>
      </div>
      <a
        href={`tel:${content.phone}`}
        onClick={(e) => e.stopPropagation()}
        className="text-blue-300 font-medium hover:text-blue-200 text-lg"
      >
        {content.phone}
      </a>
    </div>
  );
}

function HouseInfoCard({ content }: { content: HouseInfo }) {
  if (!content) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
      <span className="text-sm text-white/60">{content.label}</span>
      <span className="font-medium text-white">{content.value}</span>
    </div>
  );
}

function ChildInfoCard({ content }: { content: ChildInfo }) {
  if (!content) return null;

  return (
    <div className="p-3 bg-white/10 rounded-lg space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{content.name}</span>
        {content.age && (
          <span className="text-sm text-white/60">Age: {content.age}</span>
        )}
      </div>
      {content.allergies && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <span className="text-sm text-red-300">
            <strong>Allergies:</strong> {content.allergies}
          </span>
        </div>
      )}
      {content.medications && (
        <p className="text-sm text-white/70">
          <span className="text-white/50">Medications:</span> {content.medications}
        </p>
      )}
      {content.bedtime && (
        <p className="text-sm text-white/70">
          <span className="text-white/50">Bedtime:</span> {content.bedtime}
        </p>
      )}
      {content.notes && (
        <p className="text-sm text-white/50 italic">{content.notes}</p>
      )}
    </div>
  );
}

function HouseRuleCard({ content }: { content: HouseRule }) {
  if (!content) return null;

  const importanceColors: Record<string, string> = {
    high: 'border-l-red-400',
    medium: 'border-l-yellow-400',
    low: 'border-l-white/30',
  };

  return (
    <div
      className={cn(
        'p-3 bg-white/10 rounded-lg border-l-4',
        importanceColors[content.importance || 'medium']
      )}
    >
      <p className="text-sm text-white">{content.rule}</p>
    </div>
  );
}
