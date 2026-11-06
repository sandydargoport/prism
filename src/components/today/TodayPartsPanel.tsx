'use client';

/**
 * The editor for a Today layout (#927): no grid, because Today places its
 * parts by meaning. For each part, Show or Hide and whether it stays when the
 * wall is idle; for the whole scene, how many days the sentences look ahead
 * and the text size. Parts cannot be moved.
 *
 * The settings live on the calendar part (`daysAhead`, `textSize`), so they
 * travel with the layout through export and the gallery.
 */
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { Switch } from '@/components/ui/switch';
import { shownWhenIdle } from '@/components/screensaver/calmMode';
import { TODAY_TEMPLATE } from '@/lib/constants/layoutTemplates';
import { SENTENCES } from '@/lib/today/sentences';

export const TODAY_TEXT_SIZES = { normal: 1, large: 1.15, larger: 1.3 } as const;
export type TodayTextSize = keyof typeof TODAY_TEXT_SIZES;

const PART_NAMES: Record<string, string> = {
  clock: 'Clock and date',
  weather: 'Weather',
  calendar: 'The day and the coming days',
  birthdays: 'Birthday nudge',
  chores: 'Chores left',
  shopping: 'Shopping list',
};

/** The layout's parts, adding any Today part it does not have yet (hidden). */
export function todayParts(widgets: WidgetConfig[]): WidgetConfig[] {
  const have = new Map(widgets.map((w) => [w.i, w]));
  return TODAY_TEMPLATE.widgets.map((t) => have.get(t.i) ?? { ...t, visible: false });
}

export function TodayPartsPanel({ widgets, onChange }: {
  widgets: WidgetConfig[];
  onChange: (next: WidgetConfig[]) => void;
}) {
  const parts = todayParts(widgets);
  const calendar = parts.find((p) => p.i === 'calendar');
  const daysAhead = Number(calendar?.settings?.daysAhead) || SENTENCES.daysAheadDefault;
  const textSize = (calendar?.settings?.textSize as TodayTextSize | undefined) ?? 'normal';

  const update = (id: string, patch: Partial<WidgetConfig>) =>
    onChange(parts.map((p) => (p.i === id ? { ...p, ...patch } : p)));
  const updateScene = (patch: Record<string, unknown>) =>
    update('calendar', { settings: { ...(calendar?.settings ?? {}), ...patch } });

  return (
    // On its own solid sheet, readable over any photo (#908's sheet material).
    <div className="relative z-10 mx-auto mt-8 flex w-full max-w-2xl flex-col gap-6 rounded-[1.4rem] bg-card p-8 text-card-foreground shadow-2xl dark:bg-[rgb(22_17_13)]" data-today-parts>
      <div>
        <h2 className="m-0 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>Today</h2>
        <p className="m-0 mt-1 text-body text-muted-foreground">
          Today places each part by what it is, so parts are shown or hidden here rather than moved.
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {parts.map((p) => {
          const shown = p.visible !== false;
          return (
            <li key={p.i} className="flex min-h-[56px] items-center gap-4 rounded-xl px-3 hover:bg-muted/50" data-part={p.i}>
              <span className="flex-1 text-body">{PART_NAMES[p.i] ?? p.i}</span>
              <label className="flex items-center gap-2 text-caption text-muted-foreground">
                Stays when idle
                <Switch
                  checked={shownWhenIdle(p)}
                  disabled={!shown}
                  onCheckedChange={(v) => update(p.i, { showWhenIdle: v })}
                  aria-label={`${PART_NAMES[p.i]} stays when idle`}
                  data-part-idle={p.i}
                />
              </label>
              <label className="flex items-center gap-2 text-caption text-muted-foreground">
                Show
                <Switch
                  checked={shown}
                  onCheckedChange={(v) => update(p.i, { visible: v })}
                  aria-label={`Show ${PART_NAMES[p.i]}`}
                  data-part-show={p.i}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-3 text-body">
          Days ahead
          <select
            className="min-h-[44px] rounded-full border-[1.5px] border-foreground/30 bg-transparent px-4"
            value={daysAhead}
            onChange={(e) => updateScene({ daysAhead: Number(e.target.value) })}
            data-days-ahead
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 text-body" role="radiogroup" aria-label="Text size">
          Text size
          {(Object.keys(TODAY_TEXT_SIZES) as TodayTextSize[]).map((size) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={textSize === size}
              onClick={() => updateScene({ textSize: size })}
              className={`min-h-[44px] rounded-full px-4 ${textSize === size ? 'bg-foreground text-background' : 'border-[1.5px] border-foreground/30'}`}
              data-text-size={size}
            >
              {size === 'normal' ? 'Normal' : size === 'large' ? 'Large' : 'Larger'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
