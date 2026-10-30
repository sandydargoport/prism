'use client';

import { useSyncExternalStore } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

const DISMISSED_KEY = 'prism-insecure-page-notice-dismissed';
export const HTTPS_DOCS_URL = 'https://sandydargoport.github.io/prism/getting-started/https/';

const noSubscribe = () => () => {};

/**
 * Browsers turn some features off on a page that is not secure (plain http://
 * on anything but localhost). Prism cannot switch them back on, so say once,
 * in one place, what is missing and how to get https, instead of each feature
 * failing on its own. Dismissal is per device: each device has its own address.
 */
export function InsecurePageNotice() {
  // The server cannot know how the page was reached, so it renders nothing.
  const insecure = useSyncExternalStore(noSubscribe, () => window.isSecureContext === false, () => false);
  const dismissed = useStoredString(DISMISSED_KEY) === '1';

  if (!insecure || dismissed) return null;

  const dismiss = () => writeStored(DISMISSED_KEY, '1');

  return (
    <div role="status" className="mb-4 flex gap-3 p-3 rounded-md border border-warning/50 bg-warning/10">
      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">Some features need an https:// address</p>
        <p className="text-xs text-muted-foreground">
          This page was opened over plain http://, so the browser turns off: the keyboard&apos;s
          microphone, barcode scanning with the camera, copy buttons, and installing Prism as an app.
        </p>
        <a
          href={HTTPS_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary hover:underline"
        >
          How to use Prism over https at home
        </a>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismiss} aria-label="Dismiss">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
