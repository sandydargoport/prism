'use client';

import { Button } from '@/components/ui/button';
import { Emoji } from '@/components/ui/Emoji';
import { Card, CardContent } from '@/components/ui/card';
import { PrismIcon } from '@/components/ui/PrismIcon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <PrismIcon className="h-10 w-10" size={40} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Prism</h1>
          <p className="text-muted-foreground text-balance">
            Let&apos;s set up your family and a few basics.
          </p>
          <p className="text-muted-foreground text-balance">
            Calendars, tasks, photos, and other integrations connect anytime from their own
            pages once you&apos;re in.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {[
            { icon: '👨‍👩‍👧', label: 'Family members' },
            { icon: '🏠', label: 'Household basics' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-lg"><Emoji e={icon} /></span>
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
