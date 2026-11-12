'use client';

import { markWhatsNewSeen } from '@/lib/whatsNew';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PartyPopper, Settings, ShieldCheck } from 'lucide-react';
import { SCENERY } from '@/lib/scenery';

/**
 * Today, the built-in dashboard a first run starts on (#1151), drawn small
 * (#930).
 */
function FrontPagePreview({ kind }: { kind: 'today' }) {
  return (
    <div
      aria-hidden
      className="relative aspect-video overflow-hidden rounded-xl bg-cover bg-center"
      style={{ backgroundImage: `url(${SCENERY[0]!.src})` }}
    >
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute left-[7%] top-[9%] space-y-[6%] w-[30%]">
        <div className="h-[3px] w-[70%] rounded-full bg-white/80" />
        <div className={kind === 'today' ? 'h-[14px] w-full rounded-sm bg-white/90' : 'h-[9px] w-[70%] rounded-sm bg-white/90'} />
      </div>
      <div className="absolute right-[7%] top-[9%] h-[9px] w-[16%] rounded-sm bg-white/80" />

        <>
          <svg className="absolute left-[7%] top-[40%] h-[28%] w-[86%]" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0 28 Q50 -10 100 28" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <circle cx="38" cy="10" r="2.2" fill="white" />
          </svg>
          <div className="absolute bottom-[10%] left-[7%] w-[45%] space-y-[5%]">
            {[90, 70].map((w) => <div key={w} className="h-[3px] rounded-full bg-white/80" style={{ width: `${w}%` }} />)}
          </div>
        </>

    </div>
  );
}

export function CompleteStep({ firstRun = true }: { firstRun?: boolean }) {
  const [marking, setMarking] = useState(false);

  // Anonymous update check is opt-out (on by default). We disclose it here at
  // first run so it's never a surprise, with an off switch right in the flow.
  const [telemetryOn, setTelemetryOn] = useState(true);
  const [showSent, setShowSent] = useState(false);

  const toggleTelemetry = async (next: boolean) => {
    setTelemetryOn(next); // optimistic
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'telemetry.enabled', value: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setTelemetryOn(!next); // revert: the switch must not show a choice that was not saved
    }
  };

  // Setup is marked complete when the person leaves this step, not when it
  // appears. First-run setup has no session, and the settings route accepts
  // the switch above only while setup is incomplete, so marking it complete
  // on mount refused the opt-out while the switch showed it as off. Closing
  // the tab instead of pressing a button still completes it, via a beacon.
  const completed = useRef(false);

  const markComplete = async () => {
    if (completed.current) return;
    completed.current = true;
    // A new household has nothing that moved (#1032).
    markWhatsNewSeen();
    setMarking(true);
    try {
      await fetch('/api/setup/complete', { method: 'POST' });
    } finally {
      setMarking(false);
    }
  };

  useEffect(() => {
    const onPageHide = () => {
      if (completed.current) return;
      completed.current = true;
      navigator.sendBeacon('/api/setup/complete');
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  // Hard navigation (not router.push): the wizard added family members etc.
  // while FamilyProvider/AuthProvider were already mounted (Providers wraps
  // /setup too), and those providers fetch their state once on mount with no
  // refresh hook for "setup just finished". A client-side route change reuses
  // that same mounted tree, so the dashboard would land with stale (pre-setup)
  // family/session state, e.g. the PIN login member list rendering empty,
  // until something else happened to trigger a refetch. A full navigation
  // forces every provider to remount and re-fetch fresh, so the first paint
  // after setup is always correct.
  const finishTo = async (href: string) => {
    await markComplete();
    window.location.href = href;
  };

  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        {!firstRun && (
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <PartyPopper className="h-10 w-10 text-primary" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-2xl">You&apos;re all set</h1>
          <p className="text-muted-foreground">
            {firstRun
              ? 'The wall starts on Today. To change what it shows, or to arrange a dashboard of your own, choose More, then Edit layout.'
              : 'Head to your dashboard, or visit Settings to connect accounts, add family members, or fine-tune your display.'}
          </p>
        </div>

        {firstRun && (
          <div className="mx-auto grid max-w-xs gap-4 text-left" data-setup-front-pages>
            {([['today', 'Today', 'The day at a glance']] as const).map(([kind, name, body]) => (
              <figure key={kind} className="m-0 space-y-2" data-setup-front-page={kind}>
                <FrontPagePreview kind={kind} />
                <figcaption>
                  <span className="block text-body font-medium">{name}</span>
                  <span className="block text-caption text-muted-foreground">{body}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => finishTo('/')}
            disabled={marking}
            size="lg"
            className="w-full"
          >
            {firstRun ? 'Start on Today' : 'Go to dashboard'}
          </Button>
          <Button
            variant="outline"
            onClick={() => finishTo('/settings')}
            disabled={marking}
            className="w-full"
          >
            <Settings className="h-4 w-4 mr-2" />
            Open Settings
          </Button>
        </div>

        {/* First-run disclosure for the opt-out anonymous update check. */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Anonymous update check</p>
              <p className="text-xs text-muted-foreground">
                Once a week Prism checks for a new version and counts this install
                anonymously so we know how many families use it.{' '}
                <span className="font-medium text-foreground">No personal data, no IP address, no tracking.</span>{' '}
                <button
                  type="button"
                  data-inline-link
                  onClick={() => setShowSent((v) => !v)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {showSent ? 'Hide details' : 'See what’s sent'}
                </button>
              </p>
              {showSent && (
                <ul className="text-xs text-muted-foreground list-disc pl-4 pt-1 space-y-0.5">
                  <li>a random ID for this install (not linked to you)</li>
                  <li>the Prism version you&apos;re running</li>
                  <li>Docker vs. Home Assistant, and CPU type</li>
                </ul>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                You can change this anytime in Settings &rarr; About.
              </p>
            </div>
            <Switch
              checked={telemetryOn}
              onCheckedChange={toggleTelemetry}
              aria-label="Anonymous update check"
              className="data-[state=checked]:bg-blue-500 shrink-0 mt-0.5"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
