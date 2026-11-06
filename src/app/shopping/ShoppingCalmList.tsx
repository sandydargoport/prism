'use client';

/**
 * The Shopping page's first view (#881): one calm list. The add field at the
 * top; quiet category headings in the display face, each with a muted mark of
 * its colour (#986); rows with a ring to tick (#932). Edit and delete show on
 * the item you tap, not on every row. What is checked folds into "Checked off".
 * The category cards stay behind Manage.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { ListRow } from '@/components/ui/ListRow';
import { Button } from '@/components/ui/button';
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

export function ShoppingCalmList({ items, order, onToggle, onEdit, onDelete, onAdd, label, color }: {
  items: ShoppingItem[];
  order: string[];
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string) => Promise<unknown>;
  label: (category: string) => string;
  /** The category's colour; shown muted beside its heading. */
  color: (category: string) => string;
}) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { groups, inCart } = groupForCalmList(items, order);

  const ring = (item: ShoppingItem) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center"
      aria-label={item.checked ? `Put back ${item.name}` : `Check off ${item.name}`}
      data-shopping-ring
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-[3px] ${item.checked ? 'border-foreground/40 bg-foreground/40' : 'border-foreground/60'}`}>
        {item.checked && <Check className="h-3.5 w-3.5 text-background" />}
      </span>
    </button>
  );
  const row = (item: ShoppingItem) => (
    <ListRow
      key={item.id}
      mark={ring(item)}
      title={item.name}
      meta={[item.quantity, item.unit].filter(Boolean).join(' ')}
      highlighted={selected === item.id}
      editing={selected === item.id}
      onClick={() => setSelected(selected === item.id ? null : item.id)}
      actions={<>
        <Button variant="outline" size="sm" onClick={() => onEdit(item)}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>Delete</Button>
      </>}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5" data-shopping-calm>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = draft.trim();
          if (!name) return;
          await onAdd(name);
          setDraft('');
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item"
          className="min-h-[52px] rounded-full px-5 text-body"
          data-shopping-add
        />
      </form>

      {groups.map((g) => (
        <section key={g.category} className="flex flex-col" data-shopping-category={g.category}>
          <h2 className="m-0 flex items-center gap-2.5 px-3 pb-1 text-body font-medium text-muted-foreground" style={{ fontFamily: 'var(--font-display)' }}>
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
