/**
 *
 * The settings page for configuring Prism.
 *
 * SECTIONS:
 * - Family Members: Add, edit, remove family members
 * - Display: Theme, layout preferences
 * - Integrations: Connect external calendars, services
 * - Security: PIN management, session settings
 * - About: Version info, help links
 *
 */

import { Suspense } from 'react';
import { SettingsPinGate } from './SettingsPinGate';


/**
 * PAGE METADATA
 */
export const metadata = {
  title: 'Settings',
  description: 'Configure your Prism family dashboard.',
};


/**
 * SETTINGS PAGE COMPONENT
 */
export default function SettingsPage() {
  return (
    <main className="min-h-fill bg-background">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsPinGate />
      </Suspense>
    </main>
  );
}


/**
 * SETTINGS SKELETON
 */
function SettingsSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="h-8 w-32 bg-muted rounded animate-pulse mb-6" />
      <div className="space-y-6 max-w-2xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
