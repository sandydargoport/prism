'use client';

/**
 * The one-time offer to an existing household (#808): a sentence with Try it,
 * in the top band where toasts live, shown once on each screen and gone on its
 * own after half a minute. Settings > Display keeps the same choice, and the
 * way back.
 */
import { createElement, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import { NEW_LOOK_DISMISSED_KEY, shouldOfferNewLook } from '@/lib/newLook';
import { useNewLook } from './useNewLook';

/** How long the offer stays before it goes on its own. */
export const NEW_LOOK_OFFER_MS = 30_000;

function shownHere(): boolean {
  try { return localStorage.getItem(NEW_LOOK_DISMISSED_KEY) === '1'; } catch { return true; }
}

export function NewLookOffer() {
  const router = useRouter();
  const { layouts, tryIt } = useNewLook();
  const offer = shouldOfferNewLook(layouts, false, typeof window === 'undefined' || shownHere());

  useEffect(() => {
    if (!offer) return;
    // Once on this screen, whatever happens next.
    try { localStorage.setItem(NEW_LOOK_DISMISSED_KEY, '1'); } catch { /* it may show again after a reload */ }
    toast({
      title: 'Try the new look',
      description: 'A front page drawn as one scene, and a calendar on the photo. Your layout stays, one tap away in Settings.',
      duration: NEW_LOOK_OFFER_MS,
      action: createElement(ToastAction, {
        altText: 'Try it',
        onClick: () => { void tryIt().then((ok) => { if (ok) router.push('/'); }); },
        'data-new-look-try': '',
      } as never, 'Try it') as unknown as ToastActionElement,
    });
  }, [offer, tryIt, router]);

  return null;
}
