'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Users,
  Palette,
  Shield,
  Info,
  Home,
  Calendar,
  User,
  ImageIcon,
  ListTodo,
  ShoppingCart,
  Baby,
} from 'lucide-react';
import { PrismIcon } from '@/components/ui/PrismIcon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageWrapper } from '@/components/layout';
import { AccountSection } from './sections/AccountSection';
import { FamilySection } from './sections/FamilySection';
import { CalendarsSection } from './sections/CalendarsSection';
import { DisplaySection } from './sections/DisplaySection';
import { SecuritySection } from './sections/SecuritySection';
import { PhotosSettingsSection } from './sections/PhotosSettingsSection';
import { TaskIntegrationsSection } from './sections/TaskIntegrationsSection';
import { ShoppingIntegrationsSection } from './sections/ShoppingIntegrationsSection';
import { BabysitterInfoSection } from './sections/BabysitterInfoSection';


// Exported hooks (consumed by other components)

const DISPLAY_CONTEXTS_STORAGE_KEY = 'prism-display-contexts';
const TARGET_RESOLUTION_STORAGE_KEY = 'prism-target-resolution';
const ORIENTATION_OVERRIDE_KEY = 'prism-orientation-override';

interface DisplayContextFilters {
  gallery: { orientation: ('landscape' | 'portrait' | 'square')[]; usage: ('gallery' | 'all')[] };
  wallpaper: { orientation: ('landscape' | 'portrait' | 'square')[]; usage: ('wallpaper' | 'all')[] };
  screensaver: { orientation: ('landscape' | 'portrait' | 'square')[]; usage: ('screensaver' | 'all')[] };
}

const defaultDisplayContexts: DisplayContextFilters = {
  gallery: { orientation: ['landscape', 'portrait', 'square'], usage: ['gallery', 'all'] },
  wallpaper: { orientation: ['landscape'], usage: ['wallpaper', 'all'] },
  screensaver: { orientation: ['landscape'], usage: ['screensaver', 'all'] },
};

export function useDisplayContextFilters() {
  const [filters, setFiltersState] = React.useState<DisplayContextFilters>(() => {
    if (typeof window === 'undefined') return defaultDisplayContexts;
    try {
      const stored = localStorage.getItem(DISPLAY_CONTEXTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultDisplayContexts;
    } catch { return defaultDisplayContexts; }
  });

  const setFilters = React.useCallback((f: DisplayContextFilters) => {
    setFiltersState(f);
    localStorage.setItem(DISPLAY_CONTEXTS_STORAGE_KEY, JSON.stringify(f));
  }, []);

  return { filters, setFilters };
}

export function useOrientationOverride() {
  const [override, setOverrideState] = React.useState<'auto' | 'landscape' | 'portrait'>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem(ORIENTATION_OVERRIDE_KEY) as 'auto' | 'landscape' | 'portrait') || 'auto';
  });

  const setOverride = React.useCallback((v: 'auto' | 'landscape' | 'portrait') => {
    setOverrideState(v);
    localStorage.setItem(ORIENTATION_OVERRIDE_KEY, v);
  }, []);

  return { override, setOverride };
}

export function useTargetResolution() {
  const [resolution, setResState] = React.useState<{ width: number; height: number }>(() => {
    if (typeof window === 'undefined') return { width: 1920, height: 1080 };
    try {
      const stored = localStorage.getItem(TARGET_RESOLUTION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { width: 1920, height: 1080 };
    } catch { return { width: 1920, height: 1080 }; }
  });

  const setResolution = React.useCallback((r: { width: number; height: number }) => {
    setResState(r);
    localStorage.setItem(TARGET_RESOLUTION_STORAGE_KEY, JSON.stringify(r));
  }, []);

  const screenSize = React.useMemo(() => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return { width: window.screen.width, height: window.screen.height };
  }, []);

  return { resolution, setResolution, screenSize };
}


// Main Settings View

export function SettingsView() {
  const searchParams = useSearchParams();
  const initialSection = searchParams.get('section') || 'account';
  const [activeSection, setActiveSection] = useState<string>(initialSection);

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'family', label: 'Family Members', icon: Users },
    { id: 'calendars', label: 'Calendars', icon: Calendar },
    { id: 'tasks', label: 'Task Integrations', icon: ListTodo },
    { id: 'shopping', label: 'Shopping Integrations', icon: ShoppingCart },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
    { id: 'babysitter', label: 'Babysitter Info', icon: Baby },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Settings</h1>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <nav className="w-64 flex-shrink-0 border-r border-border bg-card/85 backdrop-blur-sm p-4">
            <div className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left',
                      'hover:bg-accent/50 transition-colors',
                      activeSection === section.id && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              {activeSection === 'account' && <AccountSection />}
              {activeSection === 'family' && <FamilySection />}
              {activeSection === 'calendars' && <CalendarsSection />}
              {activeSection === 'tasks' && <TaskIntegrationsSection />}
              {activeSection === 'shopping' && <ShoppingIntegrationsSection />}
              {activeSection === 'photos' && <PhotosSettingsSection />}
              {activeSection === 'babysitter' && <BabysitterInfoSection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'security' && <SecuritySection />}
              {activeSection === 'about' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">About Prism</h2>
                    <p className="text-muted-foreground">
                      Your family&apos;s digital home
                    </p>
                  </div>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center">
                        <PrismIcon size={96} className="mb-4 drop-shadow-lg" />
                        <h3 className="text-4xl font-bold text-primary mb-2">Prism</h3>
                        <p className="text-muted-foreground mb-4">Version 0.9.0</p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Prism brings your family together with a shared calendar,
                          tasks, messages, and more. All on one beautiful dashboard.
                        </p>
                        <div className="mt-6 text-xs text-muted-foreground">
                          <p>Open Source under AGPL-3.0 License</p>
                          <a
                            href="https://github.com/yourusername/prism"
                            className="text-primary hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on GitHub
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
