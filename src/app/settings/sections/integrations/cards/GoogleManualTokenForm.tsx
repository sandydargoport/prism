'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { GOOGLE_CAPABILITIES, type GoogleCapability } from '@/lib/integrations/googleManualScopes';

/**
 * The capabilities a user can ask for by pasting scopes, in the order shown.
 *
 * Only the prose lives here — the scope lines themselves come from
 * GOOGLE_CAPABILITIES, which is also what validates the resulting token. That
 * is deliberate: these instructions and that check used to be separate copies,
 * and #312 changed one without the other.
 *
 * 'calendarReadonly' is described inside the Calendar entry rather than listed
 * as its own bullet, because it is a weaker version of the same thing, not a
 * fourth feature to choose.
 */
const PASTEABLE: Array<{ key: GoogleCapability; blurb: string; note?: React.ReactNode }> = [
  {
    key: 'calendar',
    blurb: 'two-way sync. Both lines:',
    note: (
      <>
        The{' '}
        <code>{GOOGLE_CAPABILITIES.calendarReadonly.playgroundScopes.join(' ')}</code> line on its
        own also works and gives you read-only calendars: their events show in Prism, but they are
        not offered when you add an event.
      </>
    ),
  },
  { key: 'tasks', blurb: 'Google Tasks as a task source:' },
  {
    key: 'gmail',
    blurb: 'bus tracking only:',
    note: (
      <>
        Bus tracking marks the transport emails it has read, which needs <code>modify</code>.{' '}
        <code>gmail.readonly</code> also works if you would rather it never wrote anything, but then
        those emails stay unread in your inbox.
      </>
    ),
  },
];

/**
 * Connect Google Calendar without a public URL by pasting a refresh token
 * generated via Google's OAuth 2.0 Playground. For LAN-only installs (Home
 * Assistant add-on, bare Docker on a private IP) where Google refuses to
 * register a private/non-HTTPS redirect URI.
 *
 * Write-only: the secret and refresh token are never read back to the UI.
 */
export function GoogleManualTokenForm({ onSaved }: { onSaved?: () => void }) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const [refreshToken, setRefreshToken] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const canSave = clientId.trim() && clientSecret.trim() && refreshToken.trim() && !saving;

  const submit = async (overwriteCredentials: boolean) => {
    const res = await fetch('/api/integrations/google/manual-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        refreshToken: refreshToken.trim(),
        overwriteCredentials,
      }),
    });
    return res;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let res = await submit(false);

      if (res.status === 409) {
        // A different Google client is already configured — confirm replacement.
        const data = await res.json().catch(() => ({}));
        const ok = await confirm(
          'Replace existing Google client?',
          data.message ||
            'A different Google client is already configured. Calendars connected through the browser flow will need to be re-authenticated.',
        );
        if (!ok) return;
        res = await submit(true);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not connect with the pasted token.');
      }

      const data = await res.json();
      // Report what the token actually covered, not just that it worked. The
      // scopes are chosen in the Playground, so someone who meant to include
      // Tasks and forgot to tick it would otherwise see a success message and
      // then wonder why no tasks appeared.
      const parts: string[] = [];
      if (data.capabilities?.includes('calendar')) {
        parts.push(`${data.calendarCount ?? 0} calendar${data.calendarCount === 1 ? '' : 's'} imported`);
      }
      if (data.capabilities?.includes('calendarReadonly')) {
        parts.push(
          `${data.calendarCount ?? 0} calendar${data.calendarCount === 1 ? '' : 's'} imported, ` +
          'read-only (Prism cannot add events to them)',
        );
      }
      if (data.capabilities?.includes('gmail')) parts.push('Gmail connected for bus tracking');
      if (data.needsTaskListSelection) parts.push('choose which task lists to show under Tasks sync');
      toast({
        title: `Google connected: ${data.enabled ?? 'Calendar'}`,
        description: parts.join(' · ') || undefined,
        variant: 'success',
      });
      // Clear the sensitive fields; they're never hydrated from the server.
      setClientSecret('');
      setRefreshToken('');
      onSaved?.();
    } catch (err) {
      toast({
        title: 'Could not connect',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';
  const linkClass = 'text-primary hover:underline';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        On a LAN-only install (no public URL), Google won&apos;t accept your address as a redirect
        URI. Instead, generate a refresh token with Google&apos;s{' '}
        <a
          href="https://developers.google.com/oauthplayground"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          OAuth 2.0 Playground
        </a>{' '}
        and paste it here — the login stays on Google&apos;s own domain.
      </p>

      <p className="text-xs font-medium text-foreground">
        Do all of this signed into a <span className="underline">single</span> Google account — the one
        whose calendars you want — ideally in a private/incognito window, so you never mix up accounts.
      </p>

        <p className="text-xs text-muted-foreground">
          One token can cover more than the calendar. The Playground&apos;s API list is long, so use the
          <strong> Input your own scopes</strong> box at the top of Step 1 and paste the lines you want,
          space-separated. Paste only what you want Prism to use:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
          {PASTEABLE.map(({ key, blurb, note }) => (
            <li key={key}>
              <strong>{GOOGLE_CAPABILITIES[key].label}</strong> &mdash; {blurb}
              <code className="mt-0.5 block break-all text-[11px]">
                {GOOGLE_CAPABILITIES[key].playgroundScopes.join(' ')}
              </code>
              {note ? <span className="mt-0.5 block">{note}</span> : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Leave one out and Prism simply will not enable it. A token cannot gain a scope later, so to add
          one afterwards you generate a new token with the extra scope included and paste it here again.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li><strong>Google Calendar API v3</strong> &mdash; two-way calendar sync</li>
          <li><strong>Tasks API v1</strong> &mdash; Google Tasks as a task source</li>
          <li><strong>Gmail API v1</strong> &mdash; bus tracking only, which reads transport emails</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Leave one out and Prism simply will not enable it. A token cannot gain a scope later, so to add
          one afterwards you generate a new token with the extra scope ticked and paste it here again.
        </p>

      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          In the{' '}
          <a
            href="https://console.cloud.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Google Cloud Console
          </a>
          , create a project, then enable the <span className="font-medium">Google Calendar API</span>.
        </li>
        <li>
          Configure the <span className="font-medium">OAuth consent screen</span> (User type:{' '}
          <span className="font-medium">External</span>), then <span className="font-medium">Publish</span>{' '}
          it to <span className="font-medium">Production</span> — this is what keeps the connection from
          expiring after 7 days.
        </li>
        <li>
          Create an <span className="font-medium">OAuth Client ID</span> of type{' '}
          <span className="font-medium">Web application</span>, and add{' '}
          <code className="rounded bg-muted px-1">https://developers.google.com/oauthplayground</code> to
          its <span className="font-medium">Authorized redirect URIs</span>. Copy the Client ID and Secret
          (the secret is shown only once).
        </li>
        <li>
          Open the{' '}
          <a
            href="https://developers.google.com/oauthplayground"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            OAuth Playground
          </a>{' '}
          → gear icon → check{' '}
          <span className="font-medium">&ldquo;Use your own OAuth credentials&rdquo;</span> → paste that
          Client ID and Secret.
        </li>
        <li>
          Step 1: enter the scopes you chose above &rarr;{' '}
          <span className="font-medium">Authorize APIs</span> → sign in → if warned the app isn&apos;t
          verified, choose <span className="font-medium">Advanced → proceed</span> (expected for your own
          app) → <span className="font-medium">Allow</span>.
        </li>
        <li>
          Step 2: <span className="font-medium">Exchange authorization code for tokens</span> → copy the{' '}
          <span className="font-medium">Refresh token</span>.
        </li>
        <li>Paste the Client ID, Client Secret, and Refresh token below.</li>
      </ol>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
        <span className="font-medium">Keep it from expiring:</span> publish the consent screen to{' '}
        <span className="font-medium">Production</span> (step 2). In <span className="font-medium">Testing</span>{' '}
        mode Google expires refresh tokens after 7 days. Publishing shows a one-time &ldquo;Google
        hasn&apos;t verified this app&rdquo; notice — click <span className="font-medium">Advanced → proceed</span>;
        that&apos;s normal for an app you run yourself.
      </div>

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
          placeholder="GOCSPX-…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Refresh token</span>
        <input
          className={inputClass}
          type="password"
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          placeholder="1//0g…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <Button size="sm" onClick={handleSave} disabled={!canSave}>
        {saving ? 'Validating with Google…' : 'Connect with token'}
      </Button>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
