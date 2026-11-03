'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Check, ChevronRight, Loader2, Plus } from 'lucide-react';
import { addIcalSubscription } from '@/lib/calendar/addIcalSubscription';

type CalendarStepProps = {
  onNext: () => void;
  onBack: () => void;
};

/**
 * "Bring your calendars in" (#808). Pasting a calendar link is the one way in
 * that needs no account and no OAuth app, and the server accepts it before
 * anyone has signed in while setup is open. Two-way Google and Outlook sync
 * need a signed-in parent, so they stay in Settings and are pointed to here.
 */
export function CalendarStep({ onNext, onBack }: CalendarStepProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const add = async () => {
    if (!url.trim() || adding) return;
    setAdding(true);
    setError(null);
    const problem = await addIcalSubscription(url, name);
    setAdding(false);
    if (problem) {
      setError(problem);
      return;
    }
    setAdded((list) => [...list, name.trim() || 'Calendar']);
    setUrl('');
    setName('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <CardTitle>Bring your calendars in</CardTitle>
        </div>
        <CardDescription>
          Paste a calendar link and the family&apos;s week shows on the wall. Add as many as you like.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {added.length > 0 && (
          <ul className="space-y-1" aria-label="Calendars added">
            {added.map((n, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{n}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="setup-calendar-url">Calendar link</Label>
          <Input
            id="setup-calendar-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            placeholder="webcal://… or https://….ics"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
            disabled={adding}
          />
          <div className="flex gap-2">
            <Input
              aria-label="Calendar name"
              placeholder="Name (optional), like School or Soccer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
              disabled={adding}
              className="flex-1"
            />
            <Button type="button" onClick={() => void add()} disabled={adding || !url.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {adding ? 'Adding' : 'Add'}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">Where do I find the link?</summary>
          <ul className="mt-2 space-y-2 pl-1">
            <li>
              <span className="font-medium text-foreground">Google:</span> Calendar settings, pick the
              calendar, Integrate calendar, then copy the &quot;Secret address in iCal format&quot;.
            </li>
            <li>
              <span className="font-medium text-foreground">Apple / iCloud:</span> share the calendar as a
              Public Calendar and copy its <code>webcal://</code> link.
            </li>
            <li>
              <span className="font-medium text-foreground">Outlook:</span> Settings, Calendar, Shared
              calendars, Publish a calendar, then copy the ICS link.
            </li>
            <li>School, team and league sites often have a &quot;Subscribe&quot; or iCal link too.</li>
          </ul>
        </details>

        <p className="text-xs text-muted-foreground">
          A link shows events; it does not add them back. To add events from Prism, connect a Google or
          Outlook account in Settings after setup.
        </p>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={onNext} className="flex-1">
            {added.length > 0 ? 'Continue' : 'Skip for now'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
