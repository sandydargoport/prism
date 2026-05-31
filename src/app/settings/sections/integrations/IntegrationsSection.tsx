'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { useIntegrationStatus } from './shared/useIntegrationStatus';
import { useIntegrationsHashRouter } from './shared/useIntegrationsHashRouter';
import { GoogleProviderCard } from './cards/GoogleProviderCard';
import { MicrosoftProviderCard } from './cards/MicrosoftProviderCard';
import { CalDAVProviderCard } from './cards/CalDAVProviderCard';
import { KrogerProviderCard } from './cards/KrogerProviderCard';
import { PhotoSourcesCard } from './cards/PhotoSourcesCard';

/**
 * Consolidated integrations page (issue #52). One card per provider brand.
 * Google card hosts Calendars/Tasks plus the Gmail-OAuth-based Bus tracking
 * as a sub-section — they're independent OAuth flows but the brand is the
 * same and most family dashboards use one Google account for both. Users
 * with two accounts (personal calendars + family Gmail for school bus)
 * still see the truth via per-sub-section status badges.
 *
 * URL anchors:
 *   /settings?section=integrations#google
 *   /settings?section=integrations#google-calendars
 *   /settings?section=integrations#google-bus
 *   /settings?section=integrations#microsoft
 *   /settings?section=integrations#microsoft-tasks
 *   /settings?section=integrations#caldav
 *   /settings?section=integrations#kroger
 *   /settings?section=integrations#photo-sources
 *
 * Phase 1 dual-mount: this section is mounted alongside the legacy
 * Connected Accounts / Task Sync / Shopping Sync / Wish List Sync /
 * Photos sections. The legacy sections continue to handle their OAuth
 * callbacks. Phase 2 deletes them and remaps the callbacks here.
 */
export function IntegrationsSection() {
  const searchParams = useSearchParams();
  const { hash } = useIntegrationsHashRouter();
  const { status, refetch } = useIntegrationStatus();

  // Surface OAuth callback success/error toasts that targeted this section.
  React.useEffect(() => {
    const section = searchParams.get('section');
    if (section !== 'integrations') return;
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      toast({ title: 'Connection updated', variant: 'success' });
      void refetch();
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    } else if (error) {
      toast({ title: `Authorization failed: ${error}`, variant: 'destructive' });
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, refetch]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          One card per provider. Click any sub-section to wire it up.
        </p>
      </div>

      <div className="space-y-4">
        <GoogleProviderCard
          status={status}
          onChange={refetch}
          forceSubSectionOpen={hash}
        />
        <MicrosoftProviderCard
          status={status}
          onChange={refetch}
          forceSubSectionOpen={hash}
        />
        <CalDAVProviderCard
          onChange={refetch}
          forceSubSectionOpen={hash}
        />
        <KrogerProviderCard />
        <PhotoSourcesCard forceSubSectionOpen={hash} />
      </div>
    </div>
  );
}
