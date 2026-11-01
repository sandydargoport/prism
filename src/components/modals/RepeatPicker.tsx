'use client';

/**
 * How an event repeats (#59): the preset list the form always had, plus a
 * "Custom" builder for every N days/weeks/months/years, the days of the
 * week, "the 18th" or "the third Wednesday", and when it ends.
 *
 * The builder edits a RepeatSpec (repeatRule.ts), which stays relative to the
 * event's start date; the form turns it into an RRULE when it saves.
 */

import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useDateLabels } from '@/lib/hooks/useDateLabels';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import {
  defaultRepeatSpec,
  parseRepeatRule,
  weekdayOfMonth,
  type RepeatFreq,
  type RepeatSpec,
} from '@/lib/utils/repeatRule';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

/**
 * Presets. `labelKey` indexes `calendar.eventForm.recurrence`; the RRULE on
 * the left is protocol, the label on the right is copy.
 */
export const RECURRENCE_PRESETS = [
  { value: 'FREQ=DAILY', labelKey: 'daily' },
  { value: 'FREQ=WEEKLY', labelKey: 'weekly' },
  { value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', labelKey: 'weekdays' },
  { value: 'FREQ=MONTHLY', labelKey: 'monthly' },
  { value: 'FREQ=YEARLY', labelKey: 'yearly' },
] as const;

/**
 * What the form holds: no repeat, a preset, a builder description, or a rule
 * from another app the builder cannot show, kept exactly as it came.
 */
export type Repeat =
  | { kind: 'none' }
  | { kind: 'preset'; rule: string }
  | { kind: 'custom'; spec: RepeatSpec }
  | { kind: 'kept'; rule: string };

/** The form's value for a stored rule on an event starting on `startKey`. */
export function repeatFromRule(rule: string | null | undefined, startKey: string, timeZone: string): Repeat {
  if (!rule) return { kind: 'none' };
  if (RECURRENCE_PRESETS.some((p) => p.value === rule)) return { kind: 'preset', rule };
  const spec = parseRepeatRule(rule, startKey, timeZone);
  return spec ? { kind: 'custom', spec } : { kind: 'kept', rule };
}

const FREQS: RepeatFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

/** A small rounded toggle, for the day buttons and the either/or choices. */
function Toggle({ pressed, onClick, label, children, round }: {
  pressed: boolean;
  onClick: () => void;
  label?: string;
  children: React.ReactNode;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'h-9 text-sm font-medium border transition-colors',
        round ? 'w-9 rounded-full' : 'px-3 rounded-md',
        pressed
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

/**
 * A whole-number field that can be cleared while typing: the count is
 * committed whenever it reads as a number in range, and the field shows the
 * committed count again when it loses focus.
 */
function CountField({ value, onChange, max, label, className }: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
      }}
      onBlur={() => setText(null)}
      aria-label={label}
      className={className}
    />
  );
}

export function RepeatPicker({ value, onChange, startKey, timeZone }: {
  value: Repeat;
  onChange: (value: Repeat) => void;
  /** The event's start date, `YYYY-MM-DD`. */
  startKey: string;
  timeZone: string;
}) {
  const t = useTranslations('calendar.eventForm.recurrence');
  const d = useDateLabels();
  const { weekStartsOn } = useWeekStartsOn();

  const selectValue = value.kind === 'none' ? '__none__'
    : value.kind === 'preset' ? value.rule
    : value.kind === 'custom' ? '__custom__'
    : '__kept__';

  const choose = (v: string) => {
    if (v === '__none__') onChange({ kind: 'none' });
    else if (v === '__kept__' && value.kind === 'kept') onChange(value);
    else if (v === '__custom__') {
      // Open the builder on what was picked, so "Monthly" becomes monthly.
      const from = value.kind === 'preset' ? parseRepeatRule(value.rule, startKey, timeZone) : null;
      onChange({ kind: 'custom', spec: from ?? defaultRepeatSpec(startKey) });
    } else onChange({ kind: 'preset', rule: v });
  };

  const spec = value.kind === 'custom' ? value.spec : null;
  const update = (patch: Partial<RepeatSpec>) => spec && onChange({ kind: 'custom', spec: { ...spec, ...patch } });

  const start = parseISO(`${startKey}T12:00:00`);
  const { weekday, nth } = weekdayOfMonth(startKey);
  const weekdayName = d.weekdayByIndex(weekday, 'weekdayLong');
  const ordinal = t('ordinal', { n: String(nth) });
  const days = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);

  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={choose}>
        <SelectTrigger className="w-full" aria-label={t('label')}>
          <SelectValue placeholder={t('none')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('none')}</SelectItem>
          {RECURRENCE_PRESETS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
          ))}
          <SelectItem value="__custom__">{t('custom')}</SelectItem>
          {value.kind === 'kept' && <SelectItem value="__kept__">{t('kept')}</SelectItem>}
        </SelectContent>
      </Select>

      {spec && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3" data-testid="repeat-builder">
          {/* Every N units */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('every')}</span>
            <CountField
              value={spec.interval}
              onChange={(interval) => update({ interval })}
              max={99}
              label={t('interval')}
              className="w-16 h-9"
            />
            <Select value={spec.freq} onValueChange={(v) => update({ freq: v as RepeatFreq })}>
              <SelectTrigger className="w-32 h-9" aria-label={t('unitLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQS.map((f) => (
                  <SelectItem key={f} value={f}>{t('unit', { freq: f, count: spec.interval })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weekly: which days */}
          {spec.freq === 'WEEKLY' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('repeatOn')}>
              {days.map((i) => {
                const on = spec.weekdays.includes(i);
                return (
                  <Toggle
                    key={i}
                    round
                    pressed={on}
                    label={d.weekdayByIndex(i, 'weekdayLong')}
                    // The last day cannot be turned off: a weekly rule needs one.
                    onClick={() => {
                      const next = on ? spec.weekdays.filter((x) => x !== i) : [...spec.weekdays, i];
                      if (next.length > 0) update({ weekdays: next });
                    }}
                  >
                    {d.weekdayByIndex(i, 'weekdayNarrow')}
                  </Toggle>
                );
              })}
            </div>
          )}

          {/* Monthly / yearly: on the date, or on the nth weekday */}
          {(spec.freq === 'MONTHLY' || spec.freq === 'YEARLY') && (
            <div className="flex flex-wrap gap-1.5">
              <Toggle pressed={spec.by === 'date'} onClick={() => update({ by: 'date' })}>
                {spec.freq === 'MONTHLY'
                  ? t('monthlyOnDay', { day: start.getDate() })
                  : t('yearlyOnDate', { date: d.monthDay(start) })}
              </Toggle>
              <Toggle pressed={spec.by === 'weekday'} onClick={() => update({ by: 'weekday' })}>
                {spec.freq === 'MONTHLY'
                  ? t('monthlyOnWeekday', { ordinal, weekday: weekdayName })
                  : t('yearlyOnWeekday', { ordinal, weekday: weekdayName, month: d.monthLong(start) })}
              </Toggle>
            </div>
          )}

          {/* Ends */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground mr-1">{t('ends')}</span>
            <Toggle pressed={spec.ends.type === 'never'} onClick={() => update({ ends: { type: 'never' } })}>
              {t('endsNever')}
            </Toggle>
            <Toggle
              pressed={spec.ends.type === 'until'}
              onClick={() => spec.ends.type !== 'until' && update({ ends: { type: 'until', date: startKey } })}
            >
              {t('endsOn')}
            </Toggle>
            <Toggle
              pressed={spec.ends.type === 'count'}
              onClick={() => spec.ends.type !== 'count' && update({ ends: { type: 'count', count: 10 } })}
            >
              {t('endsAfter')}
            </Toggle>
            {spec.ends.type === 'until' && (
              <Input
                type="date"
                value={spec.ends.date}
                min={startKey}
                onChange={(e) => e.target.value && update({ ends: { type: 'until', date: e.target.value } })}
                aria-label={t('endDate')}
                className="w-40 h-9"
              />
            )}
            {spec.ends.type === 'count' && (
              <span className="flex items-center gap-1.5">
                <CountField
                  value={spec.ends.count}
                  onChange={(count) => update({ ends: { type: 'count', count } })}
                  max={999}
                  label={t('count')}
                  className="w-20 h-9"
                />
                <span className="text-sm text-muted-foreground">{t('times', { count: spec.ends.count })}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
