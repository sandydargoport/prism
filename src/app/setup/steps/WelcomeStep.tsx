'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Prism</h1>
          <p className="text-muted-foreground">
            Let&apos;s set up your family and a few basics — about a minute, no accounts or API
            keys required. Calendars, tasks, photos, and other integrations can be connected
            anytime from their own pages once you&apos;re in.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-left">
          {[
            { icon: '👨‍👩‍👧', label: 'Family members' },
            { icon: '🏠', label: 'Household basics' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground">
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <Button onClick={onNext} className="w-full" size="lg">
          Get started
        </Button>
      </CardContent>
    </Card>
  );
}
