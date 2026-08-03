'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/**
 * Admin form to set/rotate the Microsoft (Azure AD) OAuth *app* credentials —
 * Client ID, Client Secret, Redirect URI. Saved encrypted to the DB (settings
 * key 'credentials.microsoft'), which takes precedence over .env, so this is
 * the self-serve way to update an expired client secret without SSH-ing into
 * the env file. Write-only: the stored secret is never read back to the UI.
 */
export function MicrosoftCredentialsForm({ onSaved }: { onSaved?: () => void }) {
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const defaultRedirect =
    typeof window !== 'undefined' ? `${window.location.origin}/api/auth/microsoft/callback` : '';
  const [redirectUri, setRedirectUri] = React.useState(defaultRedirect);
  const [saving, setSaving] = React.useState(false);

  const canSave = clientId.trim() && clientSecret.trim() && redirectUri.trim() && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const tasksRedirectUri =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/microsoft-tasks/callback`
          : redirectUri;
      const res = await fetch('/api/setup/credentials/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim(),
          tasksRedirectUri,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save credentials');
      }
      toast({ title: 'Microsoft credentials saved', description: 'You can now connect Microsoft / OneDrive.' });
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
        Paste your Azure AD app registration values. In the Azure portal, create a{' '}
        <span className="font-medium">Client secret</span> under{' '}
        <span className="font-medium">Certificates &amp; secrets</span> and copy its{' '}
        <span className="font-medium">Value</span>. Client secrets expire — set a long
        expiry (e.g. 24 months). Add the Redirect URI below to the app&apos;s{' '}
        <span className="font-medium">Authentication → Redirect URIs</span>. The app must
        allow <span className="font-medium">personal Microsoft accounts</span> (Supported
        account types) — otherwise sign-in fails with{' '}
        <span className="font-medium">&ldquo;not enabled for consumers&rdquo;</span>.
      </p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Client ID</span>
        <input
          className={inputClass}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="text-[11px] text-muted-foreground">
          The app&apos;s <span className="font-medium">Application (client) ID</span> from its
          Overview page.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Client secret (value)</span>
        <input
          className={inputClass}
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Paste the new secret value"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="text-[11px] text-muted-foreground">
          Copy the secret&apos;s <span className="font-medium">Value</span> column — not the{' '}
          <span className="font-medium">Secret ID</span>. Azure hides the Value once you
          leave the page.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Redirect URI</span>
        <input
          className={inputClass}
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          spellCheck={false}
        />
      </label>

      <Button size="sm" onClick={handleSave} disabled={!canSave}>
        {saving ? 'Saving…' : 'Save credentials'}
      </Button>
    </div>
  );
}
