'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PartyPopper, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function CompleteStep() {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  // Mark setup complete on mount
  useEffect(() => {
    const markComplete = async () => {
      setMarking(true);
      try {
        const res = await fetch('/api/setup/complete', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({
            title: data.error || 'Could not finish setup',
            variant: 'destructive',
          });
        }
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
            onClick={() => router.push('/')}
            disabled={marking}
            size="lg"
            className="w-full"
          >
            Go to dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/settings')}
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
