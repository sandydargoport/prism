'use client';

/**
 * Everyday jobs on the wall (#835): whether the household has turned "Require
 * the PIN for every change" off, and the "Who did it?" sheet for a chore
 * nobody is assigned to.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useFamily } from '@/components/providers';

/** Read once per page load: may the wall tick and add without a PIN? */
let pending: Promise<boolean> | null = null;
function readPinFree(): Promise<boolean> {
  pending ??= fetch('/api/settings')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => (data?.security ?? data?.settings?.security)?.requirePinForEveryChange === false)
    .catch(() => false);
  return pending;
}

/** Forget the answer, after a parent changes the setting on this screen. */
export function resetPinFreeCache(): void {
  pending = null;
}

/**
 * Whether the wall may tick and add without a PIN, as a question a tap can
 * wait on: a tap that lands before the setting has loaded must not fall back
 * to the PIN pad.
 */
export function usePinFreeEveryday(): () => Promise<boolean> {
  useEffect(() => { void readPinFree(); }, []);
  return readPinFree;
}

export interface Member { id: string; name: string; color?: string }

/** Ask who did a chore. Resolves with the person, or null if the sheet is closed. */
export function useWhoDidIt(): { ask: (chore: string) => Promise<Member | null>; element: ReactNode } {
  const { members } = useFamily();
  const [chore, setChore] = useState<string | null>(null);
  const resolver = useRef<((m: Member | null) => void) | null>(null);

  const ask = useCallback((title: string) => new Promise<Member | null>((resolve) => {
    resolver.current = resolve;
    setChore(title);
  }), []);
  const finish = (m: Member | null) => {
    resolver.current?.(m);
    resolver.current = null;
    setChore(null);
  };

  const element = (
    <Dialog open={chore !== null} onOpenChange={(open) => { if (!open) finish(null); }}>
      <DialogContent className="max-w-md" data-who-did-it>
        <DialogTitle>Who did it?</DialogTitle>
        <DialogDescription className="text-body text-foreground">{chore}</DialogDescription>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <button
              key={m.loginIndex ?? m.name}
              type="button"
              onClick={() => finish({ id: m.id, name: m.name, color: m.color })}
              className="flex min-h-[52px] items-center gap-3 rounded-full border-[1.5px] border-foreground/30 px-5 text-body hover:bg-foreground/5"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
              {m.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
  return { ask, element };
}
