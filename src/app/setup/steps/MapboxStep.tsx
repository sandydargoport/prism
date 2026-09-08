'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, ChevronRight, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

interface MapboxStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function MapboxStep({ onNext, onBack }: MapboxStepProps) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/settings/mapboxToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: token.trim() }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          <Globe className="h-6 w-6 text-blue-500" />
          <CardTitle>Travel Map</CardTitle>
        </div>
        <CardDescription>
          Prism includes an interactive globe for tracking places your family has visited and wants
          to visit. It uses Mapbox, which has a generous free tier (50,000 map loads/month).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Steps */}
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">1</span>
            <span>
              Sign up at{' '}
              <a
                href="https://mapbox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                mapbox.com <ExternalLink className="h-3 w-3" />
              </a>
              {' '}(free account, no credit card required)
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">2</span>
            <span>
              After signing in, go to <strong>Account → Tokens</strong>. Copy your <strong>Default public token</strong> — it starts with <code className="bg-muted px-1 rounded text-xs">pk.</code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">3</span>
            <span>Paste it below and click Save.</span>
          </li>
        </ol>

        {/* Token input */}
        <div className="space-y-1.5">
          <Label htmlFor="mapbox-token">Public Token</Label>
          <div className="flex gap-2">
            <Input
              id="mapbox-token"
              placeholder="pk.eyJ1IjoiLi4uIn0..."
              value={token}
              onChange={(e) => { setToken(e.target.value); setSaved(false); }}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              onClick={save}
              disabled={saving || !token.trim() || saved}
              size="sm"
              variant={saved ? 'outline' : 'default'}
              className="shrink-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <><CheckCircle2 className="h-4 w-4 text-success mr-1" />Saved</>
              ) : (
                'Save'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is a public token — it&apos;s safe to use in the browser. Never use a secret token here.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onNext} className="text-muted-foreground">
              Skip for now
            </Button>
            <Button onClick={onNext} disabled={!saved}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
