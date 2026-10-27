'use client';

import { useState } from 'react';
import type { ScreenSettingChanges, ScreenSettings } from '@/lib/displays/screenSettings';
import { changesFor, currentOption, SCREEN_SETTING_FIELDS } from '@/lib/displays/screenSettingFields';

/**
 * Another screen's own settings, edited from this device (#690). Each change
 * is saved at once, as on the screen's own Settings page, and the screen picks
 * it up on its next heartbeat.
 */
export function ScreenSettingsPanel({
  name,
  settings,
  online,
  save,
}: {
  name: string;
  settings: ScreenSettings;
  online: boolean;
  /** Stores the changes; false when that failed (the caller shows why). */
  save: (changes: ScreenSettingChanges) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const pick = async (changes: ScreenSettingChanges) => {
    setSaving(true);
    setSaved(false);
    const ok = await save(changes);
    setSaving(false);
    setSaved(ok);
  };

  return (
    <div className="basis-full space-y-4 rounded-md border border-border p-3" data-testid="screen-settings">
      {(['Screensaver', 'Screen'] as const).map((group) => (
        <fieldset key={group} className="space-y-2">
          <legend className="text-sm font-medium">{group}</legend>
          {SCREEN_SETTING_FIELDS.filter((f) => f.group === group && (!f.showIf || f.showIf(settings))).map((f) => (
            <label key={f.key} className="flex flex-wrap items-center justify-between gap-2 pl-2 text-sm">
              <span className="text-muted-foreground">{f.label}</span>
              <select
                aria-label={`${f.label} on ${name}`}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                disabled={saving}
                value={currentOption(f, settings)}
                onChange={(e) => void pick(changesFor(f, e.target.value))}
              >
                {f.options.map((o) => <option key={o.raw} value={o.raw}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {saved
          ? online
            ? `Saved. ${name} changes within a minute.`
            : `Saved. ${name} changes when it is next switched on.`
          : `These are ${name}'s own settings; theme and household settings are not here.`}
      </p>
    </div>
  );
}
