'use client';

/**
 * The Shopping page's first view (#881): one calm list. The add field at the
 * top; category headings in the display face with a mark of their colour, the
 * same as a person's heading on Chores. A tap anywhere on an item crosses it
 * off: the name strikes through, then it folds into "Checked off"; a tap there
 * puts it back. The pencil at the end of a row edits it, Delete included
 * (#1053), as on the Tasks and Chores widgets. The category cards stay behind
 * Manage.
 *
 * Adding asks where the item goes (#1070): the field gives way to the list's
 * categories, one tap files it and the field comes back. The item is saved
 * before the question, so walking away leaves it in Other, never lost.
 */
import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { ListRow } from '@/components/ui/ListRow';
import { Input } from '@/components/ui/input';
import { mutedMark } from '@/lib/utils/color';
import type { ShoppingItem } from '@/types';

export function groupForCalmList(items: ShoppingItem[], order: string[]) {
  const open = items.filter((i) => !i.checked);
  const byCat = new Map<string, ShoppingItem[]>();
  for (const i of open) {
    const c = i.category || 'other';
    byCat.set(c, [...(byCat.get(c) ?? []), i]);
  }
  const cats = [...order.filter((c) => byCat.has(c)), ...[...byCat.keys()].filter((c) => !order.includes(c))];
  return { groups: cats.map((c) => ({ category: c, items: byCat.get(c)! })), inCart: items.filter((i) => i.checked) };
}

export function ShoppingCalmList({ items, order, allCategories, onToggle, onEdit, onAdd, onFile, label, color }: {
  items: ShoppingItem[];
  /** This list's categories, in order. */
  order: string[];
  /** Every category, in order: the question offers them all, this list's first. */
  allCategories: string[];
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  /** Saves the item (in Other) and returns it, so it can then be filed. */
  onAdd: (name: string) => Promise<{ id: string } | unknown>;
  /** Moves a just-added item into a category. */
  onFile: (itemId: string, category: string) => Promise<unknown>;
  label: (category: string) => string;
  /** The category's colour; shown muted beside its heading. */
  color: (category: string) => string;
}) {
  const [draft, setDraft] = useState('');
  // The item just added, waiting for its category; null shows the add field.
  const [filing, setFiling] = useState<{ id: string; name: string } | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const wasFiling = useRef(false);
  useEffect(() => {
    // Back from the question: the field is ready for the next item.
    if (wasFiling.current && !filing) addRef.current?.focus();
    wasFiling.current = !!filing;
  }, [filing]);
  // Every category, this list's own first (#1076): a list that shows one
  // category would otherwise offer a single choice.
  const own = order.filter((c) => c !== 'other');
  const choices = [...own, ...allCategories.filter((c) => c !== 'other' && !own.includes(c))];
  const file = (category: string | null) => {
    const f = filing;
    setFiling(null);
    if (f && category) void onFile(f.id, category);
  };
  // Struck through for a moment before it moves to Checked off, so the tap is seen.
  const [striking, setStriking] = useState<ReadonlySet<string>>(new Set());
  const tick = (item: ShoppingItem) => {
    if (item.checked) { onToggle(item.id); return; }
    if (striking.has(item.id)) return;
    setStriking((s) => new Set(s).add(item.id));
    setTimeout(() => {
      onToggle(item.id);
      setStriking((s) => { const n = new Set(s); n.delete(item.id); return n; });
    }, 450);
  };
  const [cartOpen, setCartOpen] = useState(false);
  const { groups, inCart } = groupForCalmList(items, order);

  const row = (item: ShoppingItem) => {
    const struck = item.checked || striking.has(item.id);
    return (
      <ListRow
        key={item.id}
        title={<span className={struck ? 'text-muted-foreground line-through' : undefined} data-shopping-struck={struck || undefined}>{item.name}</span>}
        meta={[item.quantity, item.unit].filter(Boolean).join(' ')}
        onClick={() => tick(item)}
        editing
        actions={
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06]"
            aria-label={`Edit ${item.name}`}
            data-shopping-edit
          >
            <Pencil className="h-4 w-4" />
          </button>
        }
      />
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5" data-shopping-calm>
      {filing && choices.length > 0 ? (
        <div
          className="flex flex-col gap-2"
          role="group"
          aria-label={`Category for ${filing.name}`}
          data-shopping-file
        >
          <p className="m-0 px-3 text-body text-muted-foreground">Where does <span className="font-medium text-foreground">{filing.name}</span> go?</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => file(c)}
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 text-body hover:bg-foreground/[0.06]"
                data-shopping-file-choice={c}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: mutedMark(color(c)) }} aria-hidden />
                {label(c)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => file(null)}
              className="flex min-h-[44px] items-center rounded-full px-4 text-body text-muted-foreground hover:bg-foreground/[0.06]"
              data-shopping-file-skip
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            const added = await onAdd(name);
            setDraft('');
            if (added && typeof added === 'object' && 'id' in added) setFiling({ id: String(added.id), name });
          }}
        >
          <Input
            ref={addRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an item"
            className="min-h-[52px] rounded-full px-5 text-body"
            data-shopping-add
          />
        </form>
      )}

      {groups.map((g) => (
        <section key={g.category} className="flex flex-col" data-shopping-category={g.category}>
          <h2 className="m-0 flex items-center gap-3 px-3 pb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }} data-shopping-heading>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: mutedMark(color(g.category)) }} aria-hidden data-shopping-category-mark />
            {label(g.category)}
          </h2>
          {g.items.map(row)}
        </section>
      ))}

      {inCart.length > 0 && (
        <section className="flex flex-col" data-shopping-cart>
          <button
            type="button"
            onClick={() => setCartOpen(!cartOpen)}
            className="flex min-h-[44px] items-center px-3 text-left text-body text-muted-foreground"
            aria-expanded={cartOpen}
            data-shopping-cart-toggle
          >
            Checked off ({inCart.length})
          </button>
          {cartOpen && inCart.map(row)}
        </section>
      )}
    </div>
  );
}
