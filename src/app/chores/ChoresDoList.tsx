'use client';

/**
 * The Chores page's first view (#880): what to do, not how chores are set up.
 * Due today (and overdue), Tomorrow, Later this week, as list rows with the
 * person's dot; a tap strikes the title through while the tick saves, then the
 * chore leaves the list, with Undo in the toast (#1051). Chores waiting for a
 * parent are one line each with Approve. Switches, points and categories are
 * behind Manage. With Group by Person chosen under Manage (#985), a block per
 * person, side by side as the width allows, each with its own due days.
 */
import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { ListRow } from '@/components/ui/ListRow';
import { PersonMark } from '@/components/ui/PersonMark';
import { Button } from '@/components/ui/button';
import type { Chore } from '@/types';

export function choreGroups(chores: Chore[], today: Date) {
  const key = (d: Date) => format(d, 'yyyy-MM-dd');
  const t = key(today), tomorrow = key(addDays(today, 1)), week = key(addDays(today, 7));
  const live = chores.filter((c) => c.enabled && c.nextDue);
  const due = (c: Chore) => c.nextDue!.slice(0, 10);
  // Done today (#984): not the next round waiting under Tomorrow or Later;
  // the page leaves it out altogether (#1051).
  const doneToday = (c: Chore) => !!c.lastCompleted && key(new Date(c.lastCompleted)) === t;
  const open = live.filter((c) => !c.pendingApproval && !doneToday(c));
  return {
    waiting: chores.filter((c) => c.pendingApproval),
    today: open.filter((c) => due(c) <= t),
    done: live.filter((c) => !c.pendingApproval && doneToday(c)),
    tomorrow: open.filter((c) => due(c) === tomorrow),
    later: open.filter((c) => due(c) > tomorrow && due(c) <= week),
  };
}

type Person = { id: string; name: string; color: string };

/** Chores split by person, in the given order, then anyone's; people with nothing this week are left out. */
export function choresByPerson(chores: Chore[], people: Person[]): Array<{ person: Person | null; chores: Chore[] }> {
  const order = [...people];
  for (const c of chores) if (c.assignedTo && !order.some((p) => p.id === c.assignedTo!.id)) order.push(c.assignedTo);
  const blocks: Array<{ person: Person | null; chores: Chore[] }> = order
    .map((p) => ({ person: p, chores: chores.filter((c) => c.assignedTo?.id === p.id) }));
  blocks.push({ person: null, chores: chores.filter((c) => !c.assignedTo) });
  return blocks;
}

export function ChoresDoList({ chores, today, onTick, onApprove, canApprove, groupBy = 'none', people = [] }: {
  chores: Chore[];
  today: Date;
  /** Manage's Group by (#985): a block per person, or one list. */
  groupBy?: 'none' | 'person';
  /** Household order for the person blocks. */
  people?: Person[];
  /** Resolves once the tick is saved, or was cancelled. */
  onTick: (chore: Chore) => Promise<unknown> | void;
  onApprove: (chore: Chore) => void;
  canApprove: boolean;
}) {
  const g = choreGroups(chores, today);
  // Struck through while its tick saves; the refreshed list then leaves it out.
  const [striking, setStriking] = useState<ReadonlySet<string>>(new Set());
  const strike = async (c: Chore) => {
    if (striking.has(c.id)) return;
    setStriking((s) => new Set(s).add(c.id));
    try {
      await Promise.all([onTick(c), new Promise((r) => setTimeout(r, 450))]);
    } finally {
      setStriking((s) => { const n = new Set(s); n.delete(c.id); return n; });
    }
  };
  const row = (c: Chore) => {
    const struck = striking.has(c.id);
    return (
      <ListRow
        key={c.id}
        mark={<PersonMark color={c.assignedTo?.color ?? '#888888'} kind="dot" ground="paper" />}
        title={<span className={struck ? 'text-muted-foreground line-through' : undefined} data-chore-struck={struck || undefined}>{c.title}</span>}
        // Under a person's heading the name would only repeat it.
        meta={[groupBy === 'person' ? null : c.assignedTo?.name, c.pointValue ? `${c.pointValue} pts` : null].filter(Boolean).join(' · ')}
        onClick={() => void strike(c)}
      />
    );
  };
  const section = (title: string, list: Chore[], id: string, small = false) => list.length > 0 && (
    <section key={id} className="flex flex-col gap-1" data-chores-section={id}>
      {small
        ? <h3 className="m-0 px-3 pb-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
        : <h2 className="m-0 px-3 pb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>}
      {list.map((c) => row(c))}
    </section>
  );
  const days = (d: ReturnType<typeof choreGroups>, small = false) => [
    section('Due today', d.today, 'today', small),
    section('Tomorrow', d.tomorrow, 'tomorrow', small),
    section('Later this week', d.later, 'later', small),
  ];

  if (g.today.length + g.tomorrow.length + g.later.length + g.waiting.length === 0) {
    return <p className="mx-auto max-w-3xl p-6 text-body text-muted-foreground" data-chores-done>Nothing to do this week.</p>;
  }

  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${groupBy === 'person' ? 'max-w-7xl' : 'max-w-3xl'}`} data-chores-do>
      {g.waiting.map((c) => (
        <div key={c.id} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-foreground/[0.06] px-4" data-chores-waiting>
          <span className="flex-1 text-body">
            {c.title}: waiting for a parent to approve{c.pendingApproval?.completedBy?.name ? ` (done by ${c.pendingApproval.completedBy.name})` : ''}.
          </span>
          {canApprove && <Button onClick={() => onApprove(c)}>Approve</Button>}
        </div>
      ))}
      {groupBy === 'person'
        // Side by side as the width allows (#1051), one column on a phone.
        ? <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3" data-chores-people>{choresByPerson(chores.filter((c) => !c.pendingApproval), people).map(({ person, chores: mine }) => {
          const d = choreGroups(mine, today);
          if (d.today.length + d.tomorrow.length + d.later.length === 0) return null;
          return (
            <div key={person?.id ?? 'anyone'} className="flex flex-col gap-3" data-chores-person={person?.id ?? 'anyone'}>
              <h2 className="m-0 flex items-center gap-3 px-3 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>
                <PersonMark color={person?.color ?? '#888888'} kind="dot" ground="paper" />
                {person?.name ?? 'Anyone'}
              </h2>
              {days(d, true)}
            </div>
          );
        })}</div>
        : days(g)}
    </div>
  );
}
