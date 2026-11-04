'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronRight, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAPER } from '@/lib/design/tokens';
import { SCENERY } from '@/lib/scenery';
import { DEFAULT_LOOK, FIRST_LOOK_SETTING_KEY, LOOK_IDS, type LookId } from '@/lib/looks';

type LookStepProps = {
  onNext: () => void;
  onBack: () => void;
};

const COPY: Record<LookId, { name: string; body: string }> = {
  photo: { name: 'Photo', body: 'National park scenery behind glass cards, light by day.' },
  night: { name: 'Night', body: 'The same scenery behind dark glass, always dark.' },
  paper: { name: 'Paper', body: 'Plain warm cards, no photo. Follows light and dark.' },
};

/**
 * "Pick a look" (#808). The choice is saved as `firstLook` and applied once,
 * when setup finishes (src/lib/looks.ts). Each part can be changed later where
 * it lives, so this only picks a starting point.
 */
export function LookStep({ onNext, onBack }: LookStepProps) {
  const [look, setLook] = useState<LookId>(DEFAULT_LOOK);
  const [saving, setSaving] = useState(false);

  const saveAndNext = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: FIRST_LOOK_SETTING_KEY, value: look }),
      });
    } catch {
      // Unsaved means Photo, the default; setup still finishes.
    } finally {
      setSaving(false);
    }
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>Pick a look</CardTitle>
        </div>
        <CardDescription>
          A starting point for the wall. Change any part later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="radiogroup" aria-label="Look" className="grid grid-cols-3 gap-3">
          {LOOK_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={look === id}
              onClick={() => setLook(id)}
              className={cn(
                'flex flex-col justify-start rounded-lg border-2 p-1.5 text-left transition-colors',
                look === id ? 'border-primary' : 'border-transparent hover:border-border',
              )}
            >
              <LookPreview id={id} />
              <span className="mt-2 block text-sm font-semibold">{COPY[id].name}</span>
              <span className="block text-xs text-muted-foreground">{COPY[id].body}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={() => void saveAndNext()} disabled={saving} className="flex-1">
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** A small drawing of the wall in this look: a calendar card and two side cards. */
function LookPreview({ id }: { id: LookId }) {
  const mode = id === 'night' ? 'dark' : 'light';
  const t = PAPER[mode];
  const photo = id !== 'paper';
  const card = photo ? `hsl(${t.card} / 0.65)` : `hsl(${t.card})`;
  const line = `hsl(${t['muted-foreground']} / 0.5)`;
  return (
    <div
      aria-hidden
      className="relative aspect-video overflow-hidden rounded-md bg-cover bg-center"
      style={{
        backgroundColor: `hsl(${t.background})`,
        backgroundImage: photo ? `url(${SCENERY[0]!.src})` : undefined,
      }}
    >
      {id === 'night' && <div className="absolute inset-0 bg-black/40" />}
      <div className="absolute inset-[6%] grid grid-cols-[2fr_1fr] gap-[4%]">
        <div className="rounded-sm p-[8%] space-y-[6%]" style={{ background: card, backdropFilter: photo ? 'blur(4px)' : undefined, border: photo ? undefined : `1px solid hsl(${t.border})` }}>
          {[70, 50, 60].map((w, i) => (
            <div key={i} className="h-[6%] min-h-[2px] rounded-full" style={{ width: `${w}%`, background: line }} />
          ))}
        </div>
        <div className="grid grid-rows-[1fr_2fr] gap-[8%]">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-sm" style={{ background: card, backdropFilter: photo ? 'blur(4px)' : undefined, border: photo ? undefined : `1px solid hsl(${t.border})` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
