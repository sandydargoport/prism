/**
 * A person's mark (#932): a dot, a ring (a chore's tick) or a bar (an event's
 * edge), in the person's colour at the strength for the ground it sits on.
 * Never a filled pill with white text: a name sits beside the mark.
 */
import { cn } from '@/lib/utils';
import { personColor, type PersonGround } from '@/lib/design/personColor';

export function PersonMark({ color, kind = 'dot', ground = 'paper', className }: {
  color: string;
  kind?: 'dot' | 'ring' | 'bar';
  ground?: PersonGround;
  className?: string;
}) {
  const c = personColor(color, ground);
  if (kind === 'ring') return <span className={cn('inline-block h-6 w-6 shrink-0 rounded-full border-[3px]', className)} style={{ borderColor: c }} aria-hidden data-person-mark="ring" />;
  if (kind === 'bar') return <span className={cn('inline-block w-1 shrink-0 self-stretch rounded-full', className)} style={{ backgroundColor: c }} aria-hidden data-person-mark="bar" />;
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: c }} aria-hidden data-person-mark="dot" />;
}
