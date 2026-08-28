'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, ScanBarcode } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

interface ShoppingListOption {
  id: string;
  name: string;
}

export function InputSection() {
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundStyle, setSoundStyle] = useState<'beep' | 'scan'>('beep');
  const [defaultListId, setDefaultListId] = useState<string>('');
  const [lists, setLists] = useState<ShoppingListOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, listsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/shopping/lists'),
        ]);
        if (settingsRes.ok) {
          // GET /api/settings returns { settings: { ... } }, not a bare map.
          // Reading the top level meant every lookup was undefined, so each
          // toggle silently reset to its default on load.
          const { settings: s = {} } = (await settingsRes.json()) as {
            settings?: Record<string, unknown>;
          };
          setKeyboardEnabled(s['input.virtualKeyboardEnabled'] !== false);
          setScannerEnabled(s['scanner.enabled'] !== false);
          setSoundEnabled(s['scanner.soundEnabled'] !== false);
          setSoundStyle(s['scanner.soundStyle'] === 'scan' ? 'scan' : 'beep');
          setDefaultListId((s['scanner.defaultListId'] as string) ?? '');
        }
        if (listsRes.ok) {
          const data = await listsRes.json();
          setLists((data as { id: string; name: string }[]).map(l => ({ id: l.id, name: l.name })));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = useCallback(async (key: string, value: unknown) => {
    try {
      // PATCH, not POST: /api/settings implements GET and PATCH only, so every
      // save from this section was returning 405. fetch() does not throw on an
      // HTTP error status, so the catch below never fired and the failure was
      // invisible — the toggle animated and nothing was written.
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      toast({ title: 'Failed to save setting', variant: 'destructive' });
    }
  }, []);

  if (loading) return <div className="h-32 animate-pulse bg-muted rounded" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Input</h2>
        <p className="text-muted-foreground">
          On-screen keyboard, voice input, and barcode scanner settings.
        </p>
      </div>

      {/* Virtual Keyboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Virtual Keyboard</CardTitle>
              <CardDescription>
                Shows an on-screen keyboard when tapping text fields on a touchscreen.
                Disable if using a physical keyboard.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="kb-enabled">Enable on-screen keyboard</Label>
            <Switch
              id="kb-enabled"
              checked={keyboardEnabled}
              onCheckedChange={v => {
                setKeyboardEnabled(v);
                save('input.virtualKeyboardEnabled', v);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Barcode Scanner */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Barcode Scanner</CardTitle>
              <CardDescription>
                Plug in a USB or Bluetooth barcode scanner to add items to your shopping list
                by scanning barcodes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="scanner-enabled">Enable barcode scanner</Label>
            <Switch
              id="scanner-enabled"
              checked={scannerEnabled}
              onCheckedChange={v => {
                setScannerEnabled(v);
                save('scanner.enabled', v);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label>Default shopping list</Label>
            <Select
              value={defaultListId || '__auto__'}
              onValueChange={v => {
                const val = v === '__auto__' ? '' : v;
                setDefaultListId(val);
                save('scanner.defaultListId', val || null);
              }}
              disabled={!scannerEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto-select Groceries list" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Auto (Groceries list)</SelectItem>
                {lists.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Scanned items go here. Falls back to the first list named &quot;Groceries&quot; if not set.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sound-enabled">Sound on scan</Label>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              disabled={!scannerEnabled}
              onCheckedChange={v => {
                setSoundEnabled(v);
                save('scanner.soundEnabled', v);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label>Sound style</Label>
            <Select
              value={soundStyle}
              onValueChange={v => {
                setSoundStyle(v as 'beep' | 'scan');
                save('scanner.soundStyle', v);
              }}
              disabled={!scannerEnabled || !soundEnabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beep">Short beep</SelectItem>
                <SelectItem value="scan">Scanner chirp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
