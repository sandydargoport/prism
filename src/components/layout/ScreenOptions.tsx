'use client';

/**
 * The screen's hardware options and notices (#1153), under the Screen tab's
 * Advanced fold (#1349): orientation, performance, keyboard, auto-hide, sign
 * out, notices. The edited screen's, sent on Done, or with no screen this
 * device's own, written to it on Done (#1341).
 */
import * as React from 'react';
import { useState } from 'react';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { changesFor, currentOption, SCREEN_SETTING_FIELDS, type ScreenSettingField } from '@/lib/displays/screenSettingFields';
import { SCREEN_ATTENTION_KEY } from '@/lib/displays/screenAttention';
import { loadBase } from '@/lib/displays/displaySettingsSync';
import { remoteEditHost } from '@/lib/displays/remoteEdit';
import { ScreenAttentionPanel } from '@/app/settings/sections/ScreenAttentionPanel';
import { field } from './sheetRows';

/** The order the Advanced fold names them in. */
const ORDER = ['prism-orientation-override', 'prism-perf-mode', 'prism:keyboard-on-this-device', 'prism:auto-hide-ui', 'prism-idle-logout-minutes'];

function ScreenOption({ option }: { option: ScreenSettingField }) {
  const stored = useStoredString(option.key);
  const value = currentOption(option, stored === null ? {} : { [option.key]: stored });
  return (
    <label className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]" data-screen-option={option.key}>
      <span>{option.label}</span>
      <select aria-label={option.label} className={`${field} min-w-0`} value={value}
        onChange={(e) => {
          for (const [key, raw] of Object.entries(changesFor(option, e.target.value))) writeStored(key, raw ?? null);
        }}>
        {option.options.map((o) => <option key={o.raw} value={o.raw}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** The screen's notices: small cards at the side when something is close. Named screens only. */
function Notices() {
  const stored = useStoredString(SCREEN_ATTENTION_KEY);
  const [named] = useState(() => (typeof window === 'undefined' ? null : loadBase()));
  if (!named) return null;
  return (
    <div className="flex flex-col gap-2" data-notices-section>
      <span className="text-body font-medium">Notices</span>
      <ScreenAttentionPanel
        name="This screen"
        stored={stored ?? undefined}
        online
        savedText={remoteEditHost() ? 'Kept. The screen gets it when you press Done.' : 'Saved. This screen shows them from now on.'}
        save={async (raw) => { writeStored(SCREEN_ATTENTION_KEY, raw); return true; }}
      />
    </div>
  );
}

export function ScreenOptions() {
  const fields = [...SCREEN_SETTING_FIELDS].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  return (
    <div className="flex flex-col gap-3" data-screen-options>
      {fields.map((f) => <ScreenOption key={f.key} option={f} />)}
      <Notices />
    </div>
  );
}
