'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, ExternalLink, Loader2, Check, AlertCircle, MapPin } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface KrogerStatus {
  configured: boolean;
  connected: boolean;
  tokenExpiresAt: string | null;
  preferredLocationId: string | null;
  preferredLocationName: string | null;
}

interface KrogerLocation {
  locationId: string;
  chain: string;
  name: string;
  address: { addressLine1?: string; city?: string; state?: string; zipCode?: string };
}

/**
 * Kroger / Mariano's cart push.
 *
 * Different shape from MS To-Do sync: Kroger is push-only (Prism → Kroger
 * cart, on demand), not bidirectional list sync. So this card sits above
 * the regular list-sync card with its own connect/disconnect controls.
 */
export function KrogerConnectionCard() {
  const [status, setStatus] = useState<KrogerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [zip, setZip] = useState('');
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [locations, setLocations] = useState<KrogerLocation[] | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showCredForm, setShowCredForm] = useState(false);
  const [credClientId, setCredClientId] = useState('');
  const [credClientSecret, setCredClientSecret] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/kroger/callback`
    : '';

  const saveCredentials = async () => {
    if (!credClientId.trim() || !credClientSecret.trim()) return;
    setSavingCreds(true);
    try {
      const res = await fetch('/api/setup/credentials/kroger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credClientId.trim(),
          clientSecret: credClientSecret.trim(),
          redirectUri,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ title: 'Kroger credentials saved — connect your account below' });
      setCredClientId('');
      setCredClientSecret('');
      setShowCredForm(false);
      await fetchStatus();
    } catch {
      toast({ title: 'Failed to save credentials', variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  const copyRedirectUri = async () => {
    await navigator.clipboard.writeText(redirectUri);
    toast({ title: 'Redirect URI copied' });
  };

  const searchStores = async () => {
    if (!/^\d{5}$/.test(zip)) {
      toast({ title: 'Enter a 5-digit zip code', variant: 'warning' });
      return;
    }
    setSearchingLocations(true);
    try {
      const res = await fetch(
        `/api/integrations/kroger/locations?zip=${zip}&chain=MARIANOS`,
      );
      if (!res.ok) throw new Error('Search failed');
      const data: { locations: KrogerLocation[] } = await res.json();
      // If Mariano's-only search returned nothing, fall back to all banners.
      if (data.locations.length === 0) {
        const fallback = await fetch(`/api/integrations/kroger/locations?zip=${zip}`);
        const fallbackData: { locations: KrogerLocation[] } = await fallback.json();
        setLocations(fallbackData.locations);
      } else {
        setLocations(data.locations);
      }
    } catch {
      toast({ title: 'Failed to search Kroger stores', variant: 'destructive' });
    } finally {
      setSearchingLocations(false);
    }
  };

  const pickStore = async (loc: KrogerLocation) => {
    const friendlyName = [
      loc.name,
      [loc.address.city, loc.address.state].filter(Boolean).join(', '),
    ].filter(Boolean).join(' — ');
    try {
      const res = await fetch('/api/integrations/kroger/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: loc.locationId, name: friendlyName }),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus((s) => s ? {
        ...s,
        preferredLocationId: loc.locationId,
        preferredLocationName: friendlyName,
      } : s);
      setShowPicker(false);
      setLocations(null);
      setZip('');
      toast({ title: `Default store set to ${friendlyName}` });
    } catch {
      toast({ title: 'Failed to save store', variant: 'destructive' });
    }
  };

  const clearStore = async () => {
    try {
      const res = await fetch('/api/integrations/kroger/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: null }),
      });
      if (!res.ok) throw new Error('Clear failed');
      setStatus((s) => s ? { ...s, preferredLocationId: null, preferredLocationName: null } : s);
      toast({ title: 'Default store cleared' });
    } catch {
      toast({ title: 'Failed to clear store', variant: 'destructive' });
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/integrations/kroger/status');
      if (!res.ok) throw new Error('Status fetch failed');
      const data: KrogerStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        configured: false,
        connected: false,
        tokenExpiresAt: null,
        preferredLocationId: null,
        preferredLocationName: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Read the URL the OAuth callback redirects to and surface a toast.
    const params = new URLSearchParams(window.location.search);
    if (params.get('kroger') === 'connected') {
      toast({ title: 'Connected to Kroger / Mariano’s' });
      // Strip the query param so reload doesn't re-toast.
      params.delete('kroger');
      const next = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (next ? `?${next}` : ''));
    } else if (params.get('error')?.startsWith('kroger_')) {
      toast({
        title: `Kroger connection failed (${params.get('error')})`,
        variant: 'destructive',
      });
    }
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/kroger/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Disconnect failed');
      toast({ title: 'Disconnected from Kroger' });
      setStatus((s) => s ? { ...s, connected: false, tokenExpiresAt: null } : s);
    } catch {
      toast({ title: 'Failed to disconnect Kroger', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <CardTitle>Kroger / Mariano&apos;s cart</CardTitle>
        </div>
        <CardDescription>
          Push your shopping list to your Kroger online cart. Works with any
          Kroger banner (Mariano&apos;s, Ralphs, Smith&apos;s, Fred Meyer, etc.) — one
          account spans all of them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading status…
          </div>
        ) : !status?.configured ? (
          <div className="space-y-3">
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Kroger credentials not configured</p>
                  <ol className="mt-2 space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>
                      Register an app at{' '}
                      <a
                        href="https://developer.kroger.com/manage/apps/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        developer.kroger.com <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>
                      Set the redirect URI to:
                      <code className="block mt-1 text-xs bg-muted rounded px-2 py-1 break-all">{redirectUri}</code>
                      <button
                        onClick={copyRedirectUri}
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        Copy
                      </button>
                    </li>
                    <li>
                      Select scopes: <code className="text-xs bg-muted px-1 rounded">product.compact</code>,{' '}
                      <code className="text-xs bg-muted px-1 rounded">cart.basic:write</code>,{' '}
                      <code className="text-xs bg-muted px-1 rounded">profile.compact</code>
                    </li>
                    <li>Paste the Client ID and Secret below.</li>
                  </ol>
                </div>
              </div>
            </div>
            {!showCredForm ? (
              <Button variant="outline" size="sm" onClick={() => setShowCredForm(true)}>
                Enter Kroger credentials
              </Button>
            ) : (
              <div className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Client ID</label>
                  <Input
                    value={credClientId}
                    onChange={(e) => setCredClientId(e.target.value)}
                    placeholder="Application Id from Kroger dev portal"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Client Secret</label>
                  <Input
                    type="password"
                    value={credClientSecret}
                    onChange={(e) => setCredClientSecret(e.target.value)}
                    placeholder="Secret value"
                    className="h-8"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={saveCredentials}
                    disabled={savingCreds || !credClientId.trim() || !credClientSecret.trim()}
                  >
                    {savingCreds ? 'Saving…' : 'Save credentials'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCredForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-success" />
                <span>Connected — &quot;Send to Kroger&quot; is live on the Shopping page.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Default store</span>
                <span className="text-muted-foreground flex-1 truncate">
                  {status.preferredLocationName ?? 'None set (uses Kroger default pricing)'}
                </span>
              </div>
              {!showPicker ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                    {status.preferredLocationId ? 'Change' : 'Set store'}
                  </Button>
                  {status.preferredLocationId && (
                    <Button variant="ghost" size="sm" onClick={clearStore}>Clear</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={zip}
                      onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="Zip code"
                      maxLength={5}
                      inputMode="numeric"
                      className="h-8 max-w-[120px]"
                      onKeyDown={(e) => { if (e.key === 'Enter') searchStores(); }}
                    />
                    <Button size="sm" onClick={searchStores} disabled={searchingLocations}>
                      {searchingLocations ? 'Searching…' : 'Search'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowPicker(false); setLocations(null); }}>
                      Cancel
                    </Button>
                  </div>
                  {locations && (
                    <ul className="max-h-60 overflow-y-auto space-y-1 border rounded p-1">
                      {locations.length === 0 ? (
                        <li className="text-sm text-muted-foreground p-2">No stores found near that zip.</li>
                      ) : locations.map((loc) => (
                        <li key={loc.locationId}>
                          <button
                            type="button"
                            onClick={() => pickStore(loc)}
                            className="w-full text-left p-2 text-sm rounded hover:bg-muted transition"
                          >
                            <div className="font-medium">{loc.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {loc.chain} • {[loc.address.addressLine1, loc.address.city, loc.address.state].filter(Boolean).join(', ')}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Not connected.</span>
            <Button asChild size="sm">
              <a href="/api/auth/kroger">
                Connect Kroger <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
