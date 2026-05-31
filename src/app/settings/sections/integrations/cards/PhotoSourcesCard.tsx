'use client';

import * as React from 'react';
import Link from 'next/link';
import { ImageIcon, Cloud, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';

interface Props {
  forceSubSectionOpen?: string;
}

interface PhotoSourceSummary {
  id: string;
  type: string;
  name: string;
  photoCount: number;
  priority: number | null;
}

const PhotosIcon = () => (
  <div className="h-6 w-6 flex items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-500">
    <ImageIcon className="h-4 w-4 text-white" aria-hidden="true" />
  </div>
);

const iconForType = (type: string) => {
  if (type === 'onedrive') return <Cloud className="h-3.5 w-3.5 text-blue-500" />;
  if (type === 'immich') return <ImageIcon className="h-3.5 w-3.5 text-purple-500" />;
  return <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />;
};

/**
 * Phase 1: this card is a *summary + entry-point* into the existing
 * priority-ordered photo source list living in PhotosSettingsSection.
 * The actual management UI (folder picker, Immich connect form, ▲▼ reorder)
 * stays in PhotosSettingsSection for now. Phase 2 will lift it here so the
 * Photos settings section can shed its non-source UI.
 *
 * Why summary-only in Phase 1: the photo source flow shipped fresh in PR #91
 * — minimizing churn around it is more valuable than perfect IA today.
 */
export function PhotoSourcesCard({ forceSubSectionOpen }: Props) {
  const [sources, setSources] = React.useState<PhotoSourceSummary[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/photo-sources')
      .then((r) => (r.ok ? r.json() : { sources: [] }))
      .then((data) => {
        if (!cancelled) setSources(data.sources ?? []);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = sources !== null;
  const count = sources?.length ?? 0;
  const hasSources = count > 0;

  return (
    <ProviderCardShell
      id="photo-sources"
      name="Photo data sources"
      icon={<PhotosIcon />}
      status={hasSources ? 'connected' : 'disconnected'}
      description={
        !loaded
          ? 'Loading…'
          : hasSources
            ? `${count} source${count === 1 ? '' : 's'}. Cross-source dedup follows the priority order set in Photos settings.`
            : 'No photo sources wired yet. OneDrive, Immich, and local uploads supported today.'
      }
      primaryAction={
        <Button size="sm" asChild>
          <Link href="/settings?section=photos">Manage</Link>
        </Button>
      }
    >
      <CollapsibleSubSection
        id="photo-sources-list"
        label="Current sources"
        icon={<ImageIcon className="h-4 w-4" />}
        summary={
          !loaded
            ? 'Loading…'
            : hasSources
              ? sources!
                  .map((s) => s.name)
                  .slice(0, 3)
                  .join(', ') + (count > 3 ? `, +${count - 3} more` : '')
              : 'None yet'
        }
        forceOpen={forceSubSectionOpen === 'photo-sources-list'}
        defaultOpen={!hasSources}
      >
        <div className="space-y-2">
          {hasSources ? (
            <ul className="space-y-1.5">
              {sources!.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  {iconForType(s.type)}
                  <span className="truncate flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {s.photoCount} photos
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add your first photo source from the Photos settings page.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Folder picker, reorder, and source-type connect forms live in{' '}
            <Link
              href="/settings?section=photos"
              className="text-primary hover:underline"
            >
              Photos settings
            </Link>
            .
          </p>
        </div>
      </CollapsibleSubSection>
    </ProviderCardShell>
  );
}
