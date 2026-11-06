'use client';

/**
 * The one-time "What's new" note (#1032): after an update, each screen shows
 * what moved and where, once. Never on a fresh install (setup marks it seen).
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WHATS_NEW, markWhatsNewSeen, whatsNewUnseen } from '@/lib/whatsNew';

export function WhatsNewList() {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" data-whats-new-list>
      {WHATS_NEW.items.map((i) => (
        <li key={i.what} className="text-body leading-relaxed">
          <span className="font-semibold">{i.what}</span> {i.where}
        </li>
      ))}
    </ul>
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
        <DialogDescription>{"Nothing was removed; some things moved. It's also in Help."}</DialogDescription>
        <WhatsNewList />
        <div className="flex justify-end pt-2">
          <Button onClick={close} data-whats-new-ok>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
