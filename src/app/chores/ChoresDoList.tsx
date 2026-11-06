'use client';

/**
 * The Chores page's first view (#880): what to do, not how chores are set up.
 * Due today (and overdue), Tomorrow, Later this week, as list rows with the
 * person's ring; one tap ticks, with Undo. Chores waiting for a parent are one
 * line each with Approve. Switches, points and categories are behind Manage.
 */
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
  return {
    waiting: chores.filter((c) => c.pendingApproval),
    today: live.filter((c) => !c.pendingApproval && due(c) <= t),
    tomorrow: live.filter((c) => !c.pendingApproval && due(c) === tomorrow),
    later: live.filter((c) => !c.pendingApproval && due(c) > tomorrow && due(c) <= week),
  };
}

export function ChoresDoList({ chores, today, onTick, onApprove, canApprove }: {
  chores: Chore[];
  today: Date;
  onTick: (chore: Chore) => void;
  onApprove: (chore: Chore) => void;
  canApprove: boolean;
}) {
  const g = choreGroups(chores, today);
  const section = (title: string, list: Chore[], id: string) => list.length > 0 && (
    <section className="flex flex-col gap-1" data-chores-section={id}>
      <h2 className="m-0 px-3 pb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
      {list.map((c) => (
        <ListRow
          key={c.id}
          mark={<PersonMark color={c.assignedTo?.color ?? '#888888'} kind="ring" ground="paper" />}
          title={c.title}
          meta={[c.assignedTo?.name, c.pointValue ? `${c.pointValue} pts` : null].filter(Boolean).join(' · ')}
          onClick={() => onTick(c)}
        />
      ))}
    </section>
  );

  if (g.today.length + g.tomorrow.length + g.later.length + g.waiting.length === 0) {
    return <p className="mx-auto max-w-3xl p-6 text-body text-muted-foreground" data-chores-done>Nothing to do this week.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-chores-do>
      {g.waiting.map((c) => (
        <div key={c.id} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-foreground/[0.06] px-4" data-chores-waiting>
          <span className="flex-1 text-body">
            {c.title}: waiting for a parent to approve{c.pendingApproval?.completedBy?.name ? ` (done by ${c.pendingApproval.completedBy.name})` : ''}.
          </span>
          {canApprove && <Button onClick={() => onApprove(c)}>Approve</Button>}
        </div>
      ))}
      {section('Due today', g.today, 'today')}
      {section('Tomorrow', g.tomorrow, 'tomorrow')}
      {section('Later this week', g.later, 'later')}
    </div>
  );
}
