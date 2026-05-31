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
  Gift,
  Baby,
  Database,
  Link2,
  ToggleLeft,
  ClipboardList,
  Bus,
  KeyboardIcon,
  Monitor,
  Wand2,
} from 'lucide-react';
import { PrismIcon } from '@/components/ui/PrismIcon';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/constants';
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
import { WishListIntegrationsSection } from './sections/WishListIntegrationsSection';
import { BabysitterInfoSection } from './sections/BabysitterInfoSection';
import { BackupSection } from './sections/BackupSection';
import { BusTrackingSection } from './sections/BusTrackingSection';
import { InputSection } from './sections/InputSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { ActivityLogSection } from './sections/ActivityLogSection';

import { ConnectedAccountsSection } from './sections/ConnectedAccountsSection';
import { DisplaysSection } from './sections/DisplaysSection';
import { IntegrationsSection } from './sections/integrations/IntegrationsSection';


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

  // Sync activeSection when the URL changes mid-mount. Without this, in-app
  // links like <Link href="/settings?section=calendars"> from inside one
  // section update the address bar but never re-render the content panel
  // — SettingsView only read the search param at first mount.
  const urlSection = searchParams.get('section');
  React.useEffect(() => {
    if (urlSection && urlSection !== activeSection) {
      setActiveSection(urlSection);
    }
  }, [urlSection, activeSection]);

  const sections = [
    { id: 'account', label: 'Account & Profile', icon: User },
    { id: 'family', label: 'Family Members', icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'connections', label: 'Connected Accounts', icon: Link2 },
    { id: 'displays', label: 'Displays', icon: Monitor },
    { id: 'display', label: 'Appearance', icon: Palette },
    { id: 'calendars', label: 'Calendars', icon: Calendar },
    { id: 'tasks', label: 'Task Sync', icon: ListTodo },
    { id: 'shopping', label: 'Shopping Sync', icon: ShoppingCart },
    { id: 'wish', label: 'Wish List Sync', icon: Gift },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
    { id: 'bus', label: 'Bus Tracking', icon: Bus },
    { id: 'input', label: 'Input', icon: KeyboardIcon },
    { id: 'babysitter', label: 'Babysitter Info', icon: Baby },
    { id: 'features', label: 'Features', icon: ToggleLeft },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'backups', label: 'Backups & Data', icon: Database },
    { id: 'activity', label: 'Activity Log', icon: ClipboardList },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4">
          <div className="flex items-center gap-4 h-16">
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
          <nav className="hidden md:block w-64 flex-shrink-0 border-r border-border bg-card/85 backdrop-blur-sm p-4">
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

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/*
              Mobile section selector. The desktop sidebar above is hidden on
              <md, so without this the Settings page is reachable from MobileNav
              but every section other than 'account' (the default) is not.
            */}
            <div className="md:hidden mb-4">
              <label htmlFor="settings-section-select" className="sr-only">
                Settings section
              </label>
              <select
                id="settings-section-select"
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-w-2xl">
              {activeSection === 'account' && <AccountSection />}
              {activeSection === 'family' && <FamilySection />}
              {activeSection === 'integrations' && <IntegrationsSection />}
              {activeSection === 'connections' && <ConnectedAccountsSection />}
              {activeSection === 'displays' && <DisplaysSection />}
              {activeSection === 'calendars' && <CalendarsSection />}
              {activeSection === 'tasks' && <TaskIntegrationsSection />}
              {activeSection === 'shopping' && <ShoppingIntegrationsSection />}
              {activeSection === 'wish' && <WishListIntegrationsSection />}
              {activeSection === 'photos' && <PhotosSettingsSection />}
              {activeSection === 'bus' && <BusTrackingSection />}
              {activeSection === 'babysitter' && <BabysitterInfoSection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'input' && <InputSection />}
              {activeSection === 'features' && <FeaturesSection />}
              {activeSection === 'security' && <SecuritySection />}
              {activeSection === 'backups' && <BackupSection />}
              {activeSection === 'activity' && <ActivityLogSection />}
              {activeSection === 'about' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">About Prism</h2>
                  </div>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center">
                        <PrismIcon size={96} className="mb-4 drop-shadow-lg" />
                        <h3 className="text-4xl font-bold text-primary mb-6">Prism</h3>
                        <div className="text-sm text-muted-foreground max-w-lg space-y-4 text-left">
                          <p>
                            Prism is a subscription-free, self-hosted family dashboard that pulls together
                            your calendars, tasks, and photos from the services you already use.
                          </p>
                          <p>
                            Prism is free and open-source under the AGPL-3.0 license. If you find it useful,
                            please star the repo and share it with others who might benefit.
                          </p>
                          <div className="space-y-1 pt-2">
                            <p>
                              <strong>GitHub:</strong>{' '}
                              <a href="https://github.com/sandydargoport/prism" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                                github.com/sandydargoport/prism
                              </a>
                            </p>
                            <p>
                              <strong>Report issues or request features:</strong>{' '}
                              <a href="https://github.com/sandydargoport/prism/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                                github.com/sandydargoport/prism/issues
                              </a>
                            </p>
                            <p>
                              <strong>See what&apos;s being worked on:</strong>{' '}
                              <a href="https://github.com/sandydargoport/prism/projects" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                                github.com/sandydargoport/prism/projects
                              </a>
                            </p>
                            <p><strong>Version:</strong> {APP_VERSION}</p>
                            <p>
                              <strong>Help Guide:</strong>{' '}
                              <a href="/help" className="text-primary hover:underline">
                                View the user guide
                              </a>
                            </p>
                          </div>
                          <p className="pt-2 text-xs">
                            Built with Claude Code.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div>
                        <p className="font-medium">Setup Wizard</p>
                        <p className="text-sm text-muted-foreground">
                          Re-run the initial setup to update credentials or add integrations.
                        </p>
                      </div>
                      <Button variant="outline" asChild>
                        <Link href="/setup/rerun">Re-run wizard</Link>
                      </Button>
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
