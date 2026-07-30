'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarStepProps {
  onNext: () => void;
  onBack: () => void;
  appUrl: string;
}

export function CalendarStep({ onNext, onBack, appUrl }: CalendarStepProps) {
  const [icalUrl, setIcalUrl] = useState('');
  const [calName, setCalName] = useState('');
  const [addingIcal, setAddingIcal] = useState(false);
  const [icalAdded, setIcalAdded] = useState(false);
  const [showOAuth, setShowOAuth] = useState(false);

  // OAuth section state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [oauthSaved, setOauthSaved] = useState(false);
  const [copiedUri, setCopiedUri] = useState('');

  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const gmailRedirectUri = `${appUrl}/api/auth/google-bus/callback`;

  const addIcal = async () => {
    if (!icalUrl.trim()) return;
    setAddingIcal(true);
    try {
      const body: Record<string, string> = { url: icalUrl.trim(), type: 'ical' };
      if (calName.trim()) body.name = calName.trim();
      const res = await fetch('/api/calendar-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || 'Failed to add calendar', variant: 'destructive' });
        return;
      }
      setIcalAdded(true);
      toast({ title: 'Calendar added' });
    } finally {
      setAddingIcal(false);
    }
  };

  const saveOAuth = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/setup/credentials/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri,
          gmailRedirectUri,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || 'Failed to save credentials', variant: 'destructive' });
        return;
      }
      setOauthSaved(true);
      toast({ title: 'Google credentials saved' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUri(id);
    setTimeout(() => setCopiedUri(''), 2000);
  };

  return (
    <Card className="max-h-[90vh] overflow-y-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>Calendar</CardTitle>
        </div>
        <CardDescription>
          Add a calendar via iCal link (works with Google, Apple, Outlook, and most providers)
          with no account connection required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* iCal section */}
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Add iCal calendar (recommended)</p>
          <p className="text-xs text-muted-foreground">
            In Google Calendar: Settings → [your calendar] → Integrate calendar → copy the
            &quot;Secret address in iCal format&quot; link.
          </p>

          <div className="space-y-1">
            <Label htmlFor="cal-name">Display name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="cal-name"
              placeholder="e.g. Family Calendar"
              value={calName}
              onChange={(e) => setCalName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ical-url">iCal URL</Label>
            <Input
              id="ical-url"
              placeholder="https://calendar.google.com/calendar/ical/..."
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
            />
          </div>

          {icalAdded ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Calendar added
            </div>
          ) : (
            <Button onClick={addIcal} disabled={!icalUrl.trim() || addingIcal} variant="secondary" className="w-full">
              Add calendar
            </Button>
          )}
        </div>

        {/* Google OAuth — collapsible advanced section */}
        <div className="rounded-lg border overflow-hidden">
          <button
            onClick={() => setShowOAuth(!showOAuth)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>Two-way Google sync (optional)</span>
              {oauthSaved && <Check className="h-4 w-4 text-green-500" />}
            </span>
            {showOAuth ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showOAuth && (
            <div className="px-4 pb-4 space-y-4 border-t">
              <p className="text-xs text-muted-foreground mt-3">
                For two-way sync (create/edit events from Prism) you need a Google Cloud OAuth app.
                This is an advanced setup — iCal above covers read-only access with no accounts
                required.
              </p>

              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Google Cloud Console <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Create a project → Enable <strong>Google Calendar API</strong> and <strong>Gmail API</strong></li>
                <li>Credentials → Create OAuth Client ID → Web application</li>
                <li>Add these <strong>Authorized redirect URIs</strong>:</li>
              </ol>

              <div className="space-y-1.5">
                {[
                  { label: 'Calendar callback', value: redirectUri, id: 'cal' },
                  { label: 'Gmail callback', value: gmailRedirectUri, id: 'gmail' },
                ].map(({ label, value, id }) => (
                  <div key={id} className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 break-all">{value}</code>
                    <button
                      onClick={() => copyToClipboard(value, id)}
                      className="flex-shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                      title={`Copy ${label}`}
                    >
                      {copiedUri === id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Register all URLs you access Prism from (local IP, domain, etc.).
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="g-client-id" className="text-xs">Client ID</Label>
                  <Input
                    id="g-client-id"
                    placeholder="xxxxxx.apps.googleusercontent.com"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="g-client-secret" className="text-xs">Client Secret</Label>
                  <Input
                    id="g-client-secret"
                    type="password"
                    placeholder="GOCSPX-..."
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
                {oauthSaved ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Credentials saved — connect your account in Settings → Connected Accounts
                  </div>
                ) : (
                  <Button
                    onClick={saveOAuth}
                    disabled={!clientId.trim() || !clientSecret.trim() || saving}
                    variant="secondary"
                    className="w-full"
                  >
                    Save Google credentials
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={onNext} className="flex-1">
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground -mt-1">
          <button onClick={onNext} className="hover:underline">
            Skip — configure in Settings later
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
