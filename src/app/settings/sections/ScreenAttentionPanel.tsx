'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ATTENTION_DEFAULTS, ATTENTION_KINDS, ATTENTION_LIMITS, parseAttention, serializeAttention,
  type AttentionKind, type AttentionSettings,
} from '@/lib/displays/screenAttention';

/**
 * Which notices a screen shows in its attention panel (#692), edited from any
 * device. Saved as a whole with the Save button, like the schedule.
 */

const ROWS: Record<AttentionKind, { label: string; unit: string }> = {
  bus: { label: 'The bus is due at your stop within', unit: 'minutes' },
  event: { label: 'An event starts within', unit: 'minutes' },
  message: { label: 'A message was posted in the last', unit: 'minutes' },
};

export function ScreenAttentionPanel({
  name,
  stored,
  online,
  save,
}: {
  name: string;
  /** The stored value of the attention setting. */
  stored: string | undefined;
  online: boolean;
  /** Stores the new value (null for all off); false when that failed (the caller shows why). */
  save: (raw: string | null) => Promise<boolean>;
}) {
  const [settings, setSettings] = useState<AttentionSettings>(() => parseAttention(stored));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const edit = (kind: AttentionKind, minutes: number | null) => {
    setSettings({ ...settings, [kind]: minutes });
    setSaved(false);
  };
  const submit = async () => {
    setSaving(true);
    const ok = await save(serializeAttention(settings));
    setSaving(false);
    setSaved(ok);
  };

  return (
    <div className="basis-full space-y-3 rounded-md border border-border p-3" data-testid="screen-attention">
      <p className="text-sm text-muted-foreground">
        {name} shows a small card at the side of its dashboard when one of these happens, newest
        on top. Tap a card to dismiss it.
      </p>
      <ul className="space-y-2">
        {ATTENTION_KINDS.map((kind) => {
          const minutes = settings[kind];
          const { min, max } = ATTENTION_LIMITS[kind];
          return (
            <li key={kind} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={minutes !== null}
                  onChange={(e) => edit(kind, e.target.checked ? ATTENTION_DEFAULTS[kind] : null)}
                />
                {ROWS[kind].label}
              </label>
              <input
                type="number"
                aria-label={`${ROWS[kind].label} (${ROWS[kind].unit})`}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 disabled:opacity-50"
                min={min}
                max={max}
                disabled={minutes === null}
                value={minutes ?? ATTENTION_DEFAULTS[kind]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) edit(kind, Math.min(max, Math.max(min, Math.round(n))));
                }}
              />
              <span>{ROWS[kind].unit}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={saving}>
          Save notices
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saved && (online ? `Saved. ${name} follows it within a minute.` : `Saved. ${name} follows it when it is next switched on.`)}
        </span>
      </div>
    </div>
  );
}
