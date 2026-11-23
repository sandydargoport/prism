'use client';

/**
 * The one-time "What's new" note (#1032, #1308): after an update, each screen
 * shows what is new in the release, once, with a link to the full changelog.
 * Never on a fresh install (setup marks it seen). Help keeps the same list.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WHATS_NEW, markWhatsNewSeen, whatsNewRuns, whatsNewUnseen } from '@/lib/whatsNew';

export function WhatsNewList() {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" data-whats-new-list>
      {WHATS_NEW.items.map((item) => (
        <li key={item} className="text-body leading-relaxed">
          {whatsNewRuns(item).map((r, i) => (r.bold
            ? <span key={i} className="font-semibold">{r.text}</span>
            : <span key={i}>{r.text}</span>))}
        </li>
      ))}
    </ul>
  );
}

/** The full changelog on the docs site, in a new tab. */
export function WhatsNewChangelogLink() {
  return (
    <a
      href={WHATS_NEW.changelog}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline-offset-2 hover:underline"
      data-whats-new-changelog
    >
      See everything that changed
    </a>
  );
}

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  // After mount: the screen's own memory decides, never the server render.
  // Under test automation it stays away unless asked for (?whats-new), so it
  // does not cover what every other test clicks.
  useEffect(() => {
    const automated = typeof navigator !== 'undefined' && navigator.webdriver;
    const asked = new URLSearchParams(window.location.search).has('whats-new');
    if (!(asked || !automated) || !whatsNewUnseen()) return;
    // A beat after the page settles, not over its first paint.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);
  const close = () => { markWhatsNewSeen(); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg" data-whats-new>
        <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{WHATS_NEW.title}</DialogTitle>
        <WhatsNewList />
        <DialogDescription className="text-body">
          <WhatsNewChangelogLink /> · This list stays in More &gt; Help.
        </DialogDescription>
        <div className="flex justify-end pt-2">
          <Button onClick={close} data-whats-new-ok>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
