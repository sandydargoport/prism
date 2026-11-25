'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PHOTO_DATE_SETTING, PHOTO_ON_THIS_DAY_SETTING, PHOTO_PLACE_SETTING } from '@/lib/photos/caption';

/**
 * Settings > Photos > Captions and On this day (#958, #1351): when and where
 * photos were taken, on the wallpaper and the photo frame, and On this day.
 * Household settings, saved at once. The date shows unless turned off; the
 * place only when turned on, because finding it sends a photo's rough
 * location to OpenStreetMap's geocoder.
 *
 * They were behind the wallpaper switch in Appearance, so a screen that
 * shows photos only when idle could not reach them; here they always show.
 */
export function PhotoCaptionsCard() {
  const [values, setValues] = useState<{ date: boolean; place: boolean; onThisDay: boolean } | null>(null);
  useEffect(() => {
    fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).then((d) => setValues({
      date: d?.settings?.[PHOTO_DATE_SETTING] !== false,
      place: d?.settings?.[PHOTO_PLACE_SETTING] === true,
      onThisDay: d?.settings?.[PHOTO_ON_THIS_DAY_SETTING] === true,
    })).catch(() => setValues({ date: true, place: false, onThisDay: false }));
  }, []);
  const save = async (key: string, field: 'date' | 'place' | 'onThisDay', value: boolean) => {
    const before = values;
    setValues((v) => (v ? { ...v, [field]: value } : v));
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) }).catch(() => null);
    if (!res?.ok) setValues(before);
  };
  return (
    <Card data-photo-captions>
      <CardHeader>
        <CardTitle>Captions and On this day</CardTitle>
        <CardDescription>On every screen, behind the dashboard and in the photo frame</CardDescription>
      </CardHeader>
      {values && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">Show when photos were taken</span>
              <p className="text-xs text-muted-foreground">A short line in a free corner, like &ldquo;March 2019&rdquo;</p>
            </div>
            <Switch checked={values.date} onCheckedChange={(v) => void save(PHOTO_DATE_SETTING, 'date', v)} aria-label="Show when photos were taken" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">Show where photos were taken</span>
              <p className="text-xs text-muted-foreground">
                Names the town for photos that have a location. To find it, Prism sends the photo&rsquo;s rough location (to about a kilometre) to OpenStreetMap, once per photo.
              </p>
            </div>
            <Switch checked={values.place} onCheckedChange={(v) => void save(PHOTO_PLACE_SETTING, 'place', v)} aria-label="Show where photos were taken" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">On this day</span>
              <p className="text-xs text-muted-foreground">On a date with photos from earlier years, show those more often</p>
            </div>
            <Switch checked={values.onThisDay} onCheckedChange={(v) => void save(PHOTO_ON_THIS_DAY_SETTING, 'onThisDay', v)} aria-label="On this day" />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
