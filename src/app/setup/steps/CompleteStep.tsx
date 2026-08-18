'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PartyPopper, Settings, ShieldCheck } from 'lucide-react';

export function CompleteStep() {
  const [marking, setMarking] = useState(false);

  // Anonymous update check is opt-out (on by default). We disclose it here at
  // first run so it's never a surprise, with an off switch right in the flow.
  const [telemetryOn, setTelemetryOn] = useState(true);
  const [showSent, setShowSent] = useState(false);

  const toggleTelemetry = async (next: boolean) => {
    setTelemetryOn(next); // optimistic
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'telemetry.enabled', value: next }),
      });
    } catch {
      setTelemetryOn(!next); // revert
    }
  };

  // Mark setup complete on mount
  useEffect(() => {
    const markComplete = async () => {
      setMarking(true);
      try {
        await fetch('/api/setup/complete', { method: 'POST' });
      } finally {
        setMarking(false);
      }
    };
    markComplete();
  }, []);

  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <PartyPopper className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You&apos;re all set!</h1>
          <p className="text-muted-foreground">
            Prism is ready. Head to your dashboard to get started, or visit Settings to
            connect accounts, add more family members, or fine-tune your display.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              // Hard navigation (not router.push): the wizard added family
              // members etc. while FamilyProvider/AuthProvider were already
              // mounted (Providers wraps /setup too), and those providers
              // fetch their state once on mount with no refresh hook for
              // "setup just finished". A client-side route change reuses
              // that same mounted tree, so the dashboard would land with
              // stale (pre-setup) family/session state — e.g. the PIN
              // login member list rendering empty — until something else
              // happened to trigger a refetch. A full navigation forces
              // every provider to remount and re-fetch fresh, so the first
              // paint after setup is always correct.
              window.location.href = '/';
            }}
            disabled={marking}
            size="lg"
            className="w-full"
          >
            Go to dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => { window.location.href = '/settings'; }}
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
