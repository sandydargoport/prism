'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PartyPopper, Settings } from 'lucide-react';

export function CompleteStep() {
  const [marking, setMarking] = useState(false);

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
      </CardContent>
    </Card>
  );
}
