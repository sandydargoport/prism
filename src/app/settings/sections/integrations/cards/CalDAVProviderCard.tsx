'use client';

import * as React from 'react';
import Link from 'next/link';
import { Server, Calendar, ListTodo, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalDAVConnectDialog } from '@/app/settings/components/CalDAVConnectDialog';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';

interface Props {
  onChange: () => void | Promise<void>;
  forceSubSectionOpen?: string;
}

const CalDAVIcon = () => (
  <Server className="h-6 w-6 text-slate-500" aria-hidden="true" />
);

export function CalDAVProviderCard({ onChange, forceSubSectionOpen }: Props) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <ProviderCardShell
        id="caldav"
        name="Apple iCloud / CalDAV"
        icon={<CalDAVIcon />}
        // Status is intentionally fixed at 'alpha' for Phase 1 — matches the
        // existing ConnectedAccountsSection treatment of CalDAV. Real per-
        // server connected/disconnected status can come in a follow-up.
        status="alpha"
        description="Also works with Nextcloud, Radicale, Baikal, and Synology Calendar."
        primaryAction={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Server className="h-4 w-4 mr-2" />
            Connect server
          </Button>
        }
      >
        <CollapsibleSubSection
          id="caldav-overview"
          label="What can I sync from iCloud?"
          icon={<ExternalLink className="h-4 w-4" />}
          summary="Calendars and contacts only — see the integration overview"
          forceOpen={forceSubSectionOpen === 'caldav-overview'}
        >
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Apple keeps the IETF CalDAV and CardDAV standards open at{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">caldav.icloud.com</code>{' '}
              and{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">contacts.icloud.com</code>,
              so calendars and contacts (incl. birthdays) sync cleanly.
              Everything else in iCloud — Reminders, Notes, Photos, Find My,
              Health — is CloudKit-only with no public API.
            </p>
            <p>
              Full breakdown:{' '}
              <a
                href="https://sandydargoport.github.io/prism/features/ICLOUD/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                iCloud integration overview
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="caldav-calendars"
          label="Calendars"
          icon={<Calendar className="h-4 w-4" />}
          summary="Manage CalDAV-backed calendar sources"
          forceOpen={forceSubSectionOpen === 'caldav-calendars'}
        >
          <div className="text-sm">
            <Link
              href="/settings?section=calendars"
              className="text-primary hover:underline"
            >
              Open Calendars settings →
            </Link>
          </div>
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="caldav-tasks"
          label="Reminders / tasks"
          icon={<ListTodo className="h-4 w-4" />}
          summary="VTODO items sync into Prism Tasks (read-only)"
          forceOpen={forceSubSectionOpen === 'caldav-tasks'}
        >
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              CalDAV-backed task lists appear in the regular Tasks view. Note:
              iCloud accounts return placeholder VTODOs for Reminders lists
              that have migrated to CloudKit (most modern accounts) — Prism
              filters those out automatically.
            </p>
            <Link
              href="/settings?section=tasks"
              className="text-primary hover:underline"
            >
              Open Task Sync settings →
            </Link>
          </div>
        </CollapsibleSubSection>
      </ProviderCardShell>
      <CalDAVConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={() => {
          void onChange();
        }}
      />
    </>
  );
}
