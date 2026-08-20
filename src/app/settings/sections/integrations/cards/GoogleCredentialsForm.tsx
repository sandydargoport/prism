'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/**
 * Admin form to set/rotate the Google OAuth *app* credentials — Client ID,
 * Client Secret, Redirect URI. Saved encrypted to the DB (settings key
 * 'credentials.google'), which takes precedence over .env — so Home Assistant
 * addon and other no-shell installs can configure Google Calendar entirely from
 * the UI, without touching a .env file. Write-only: the stored secret is never
 * read back to the UI.
 */
export function GoogleCredentialsForm({ onSaved }: { onSaved?: () => void }) {
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const defaultRedirect =
    typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google/callback` : '';
  const [redirectUri, setRedirectUri] = React.useState(defaultRedirect);
  const [saving, setSaving] = React.useState(false);

  const canSave = clientId.trim() && clientSecret.trim() && redirectUri.trim() && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch('/api/setup/credentials/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save credentials');
      }
      toast({ title: 'Google credentials saved', description: 'You can now connect Google Calendar / Tasks.' });
      setClientSecret('');
      onSaved?.();
    } catch (err) {
      toast({
        title: 'Could not save credentials',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        In the{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Google Cloud Console
        </a>
        , enable the <span className="font-medium">Google Calendar API</span> (and{' '}
        <span className="font-medium">Tasks API</span> if you want tasks), then create an{' '}
        <span className="font-medium">OAuth 2.0 Client ID</span> of type{' '}
        <span className="font-medium">Web application</span>. Add the Redirect URI below to the
        client&apos;s <span className="font-medium">Authorized redirect URIs</span>, and add your
        Google account as a <span className="font-medium">Test user</span> on the OAuth consent
        screen (or publish it). Then paste the Client ID and Secret here — no{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> editing needed.
      </p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Client ID</span>
        <input
          className={inputClass}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="1234567890-abc123.apps.googleusercontent.com"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Client secret</span>
        <input
          className={inputClass}
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Paste the client secret"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Redirect URI</span>
        <input
          className={inputClass}
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          spellCheck={false}
        />
        <span className="text-[11px] text-muted-foreground">
          Copy this exact value into your Google OAuth client&apos;s Authorized redirect URIs.
        </span>
      </label>

      <Button size="sm" onClick={handleSave} disabled={!canSave}>
        {saving ? 'Saving…' : 'Save credentials'}
      </Button>
    </div>
  );
}
