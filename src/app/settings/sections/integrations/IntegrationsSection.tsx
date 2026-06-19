'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useIntegrationStatus } from './shared/useIntegrationStatus';
import { useIntegrationsHashRouter } from './shared/useIntegrationsHashRouter';
import { GoogleProviderCard } from './cards/GoogleProviderCard';
import { MicrosoftProviderCard } from './cards/MicrosoftProviderCard';
import { GmailProviderCard } from './cards/GmailProviderCard';
import { CalDAVProviderCard } from './cards/CalDAVProviderCard';
import { KrogerProviderCard } from './cards/KrogerProviderCard';
import { PhotoSourcesCard } from './cards/PhotoSourcesCard';

/**
 * Consolidated integrations page (issue #52). One card per provider brand.
 *
 * Bus tracking (Gmail) is intentionally its own card even though it uses
 * Gmail OAuth under the hood — only a small fraction of users wire bus
 * tracking, so folding it into the Google card made the common case
 * noisier without helping the bus case. Card naming reflects what the
 * user came here for ("Bus tracking") rather than the underlying provider.
 *
 * URL anchors:
 *   /settings?section=integrations#google
 *   /settings?section=integrations#google-calendars
 *   /settings?section=integrations#microsoft
 *   /settings?section=integrations#microsoft-tasks
 *   /settings?section=integrations#gmail
 *   /settings?section=integrations#gmail-bus
 *   /settings?section=integrations#caldav
 *   /settings?section=integrations#kroger
 *   /settings?section=integrations#photo-sources
 *
 * Phase 1 dual-mount: this section is mounted alongside the legacy
 * Connected Accounts / Task Sync / Shopping Sync / Wish List Sync /
 * Photos sections. The legacy sections continue to handle their OAuth
 * callbacks. Phase 2 deletes them and remaps the callbacks here.
 */
/**
 * Friendly copy for the "you clicked Connect before configuring OAuth" banner
 * (issue #108). Keyed by the `?setup=` provider the init route redirected with.
 */
const SETUP_PROMPTS: Record<string, { name: string; env: string }> = {
  google: { name: 'Google', env: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI' },
  gmail: { name: 'Gmail / Bus tracking', env: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_GMAIL_REDIRECT_URI' },
  microsoft: { name: 'Microsoft', env: 'MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and MICROSOFT_REDIRECT_URI' },
};

export function IntegrationsSection() {
  const searchParams = useSearchParams();
  const { hash } = useIntegrationsHashRouter();
  const { status, refetch } = useIntegrationStatus();

  // "Connect" was clicked before OAuth credentials were configured: the init
  // route redirected here with ?setup=<provider> instead of dumping JSON (#108).
  const setupProvider = searchParams.get('setup');
  const setupPrompt = setupProvider ? SETUP_PROMPTS[setupProvider] : undefined;
  const [setupDismissed, setSetupDismissed] = React.useState(false);

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

      {setupPrompt && !setupDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{setupPrompt.name} isn&apos;t set up yet</p>
            <p className="mt-1">
              You skipped this during onboarding, so there are no OAuth credentials to connect with
              yet. Open the{' '}
              <Link href="/setup/rerun" className="font-medium underline">Setup Wizard</Link>{' '}
              to enter them, or set <code className="text-xs">{setupPrompt.env}</code> in your
              {' '}<code className="text-xs">.env</code>.
            </p>
            <Link
              href="/setup/rerun"
              className="mt-3 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Open Setup Wizard
            </Link>
          </div>
          <button
            onClick={() => setSetupDismissed(true)}
            aria-label="Dismiss"
            className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        <GmailProviderCard
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
