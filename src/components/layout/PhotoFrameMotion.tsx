'use client';

/**
 * How the photo frame moves and changes (#1349), in the Screen tab's When
 * idle > Advanced, where the Screensaver motion window used to open from.
 * Each is one of the screen's own settings, so it waits for Done (#1341).
 * A control shows only for the effect that uses it.
 */
import * as React from 'react';
import { EFFECT_ORDER, getEffect } from '@/components/screensaver/effects';
import { useScreensaverMotion, type ScreensaverMotion } from '@/components/screensaver/useScreensaverMotion';
import { useScreensaverInterval } from './WallpaperBackground';
import { Switch } from '@/components/ui/switch';
import { field } from './sheetRows';

const ROW = 'grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]';

function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <label className={ROW}>
      <span>{label}</span>
      <select aria-label={label} className={`${field} min-w-0`} value={String(value)}
        onChange={(e) => {
          const picked = options.find(([v]) => String(v) === e.target.value);
          if (picked) onChange(picked[0]);
        }}>
        {options.map(([v, text]) => <option key={String(v)} value={String(v)}>{text}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={ROW}>
      <span>{label}</span>
      <Switch aria-label={label} checked={on} onCheckedChange={onChange} />
    </label>
  );
}

export function PhotoFrameMotion() {
  const m = useScreensaverMotion();
  const { interval: photoEvery, setInterval: setPhotoEvery } = useScreensaverInterval();
  return (
    <div className="flex flex-col gap-3" data-photo-frame-motion>
      <Choice<ScreensaverMotion> label="Transition effect" value={m.motion} onChange={m.setMotion}
        options={[['off', 'None'], ...EFFECT_ORDER.map((id): [ScreensaverMotion, string] => [id, getEffect(id)?.label ?? id])]} />
      {m.motion !== 'off' && (
        <>
          <Choice label="Change every" value={m.interval} onChange={m.setInterval}
            options={[[10, '10 seconds'], [20, '20 seconds'], [45, '45 seconds'], [90, '1.5 minutes'], [300, '5 minutes']]} />
          <Choice label="Show at least" value={m.floor} onChange={m.setFloor}
            options={[1, 2, 3, 4, 5, 6, 8].map((n): [number, string] => [n, `${n} widget${n === 1 ? '' : 's'}`])} />
          <Choice label="and at most" value={m.ceiling} onChange={m.setCeiling}
            options={[[0, 'no limit'], ...[2, 3, 4, 5, 6, 8, 10, 12].map((n): [number, string] => [n, `${n} widgets`])]} />
          <Choice label="Transition length" value={m.speed} onChange={m.setSpeed}
            options={[[0.5, 'Brisk'], [1, 'Normal'], [1.6, 'Slow'], [2.4, 'Very slow']]} />
        </>
      )}
      {m.motion === 'liquid' && (
        <>
          <Toggle label="Carbonation" on={m.carbonation} onChange={m.setCarbonation} />
          <Toggle label="Keep text clear of the waterline" on={m.waterClear} onChange={m.setWaterClear} />
          <Choice label="Surface wobble" value={m.wobble} onChange={m.setWobble}
            options={[[0, 'None'], [0.5, 'Slight'], [1, 'Normal'], [1.8, 'Choppy']]} />
        </>
      )}
      <Toggle label="Drift, so nothing sits on the same pixels for months" on={m.drift} onChange={m.setDrift} />
      <Choice label="Change photo every" value={photoEvery} onChange={setPhotoEvery}
        options={[[5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes'], [600, '10 minutes'], [3600, '1 hour'], [0, 'Never']]} />
      <Toggle label="Outlines on the photo frame" on={m.outlines} onChange={m.setOutlines} />
    </div>
  );
}
