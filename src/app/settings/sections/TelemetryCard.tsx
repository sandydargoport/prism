'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type TelemetryStatus = {
  enabled: boolean;
  configured: boolean;
  hardDisabled: boolean;
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastCheckAt: string | null;
  payload: Record<string, unknown>;
};

/**
 * Settings -> About card for the anonymous update check.
 *
 * Opt-out: the switch defaults on. Turning it off writes `telemetry.enabled`.
 * The card shows the exact payload that would be sent (nothing hidden) and,
 * when the last check-in reported a newer minor/major release, a quiet
 * "update available" line. Patch bumps are intentionally not surfaced.
 */
export function TelemetryCard() {
  const [status, setStatus] = React.useState<TelemetryStatus | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [showPayload, setShowPayload] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* leave null — card just won't render */
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggle = async (next: boolean) => {
    if (!status) return;
    setSaving(true);
    setStatus({ ...status, enabled: next }); // optimistic
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'telemetry.enabled', value: next }),
      });
    } catch {
      setStatus({ ...status, enabled: !next }); // revert
    } finally {
      setSaving(false);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      await fetch('/api/telemetry', { method: 'POST' });
      await load();
    } finally {
      setChecking(false);
    }
  };

  if (!status) return null;

  const lastChecked = status.lastCheckAt
    ? new Date(status.lastCheckAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'never';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anonymous update check</CardTitle>
        <CardDescription>
          Once a week Prism checks whether a newer version is available and, in
          the same request, adds one anonymous install to the maintainer&apos;s
          count. No personal data, no IP address, no usage — just the four fields
          shown below. On by default; switch it off anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Share anonymous usage &amp; check for updates</span>
            <span className="text-xs text-muted-foreground">
              {status.hardDisabled
                ? 'Disabled by the server administrator (PRISM_DISABLE_TELEMETRY).'
                : status.configured
                  ? `Last check-in: ${lastChecked}`
                  : 'No collector configured on this build — nothing is sent.'}
            </span>
          </div>
          <Switch
            checked={status.enabled}
            disabled={saving || status.hardDisabled}
            onCheckedChange={toggle}
            className="data-[state=checked]:bg-blue-500"
          />
        </div>

        {/* Version status line — only nags on minor/major, never on patches. */}
        <div className="text-sm">
          {status.updateAvailable && status.latestVersion ? (
            <span className="font-medium text-primary">
              Update available: v{status.latestVersion}{' '}
              <span className="text-muted-foreground font-normal">
                (you have v{status.version})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Prism is up to date (v{status.version})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={checkNow}
            disabled={checking || !status.enabled || !status.configured}
          >
            {checking ? 'Checking…' : 'Check now'}
          </Button>
          <button
            type="button"
            onClick={() => setShowPayload((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {showPayload ? 'Hide' : 'Show'} exactly what&apos;s sent
          </button>
        </div>

        {showPayload && (
          <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto border border-border/50">
            {JSON.stringify(status.payload, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
