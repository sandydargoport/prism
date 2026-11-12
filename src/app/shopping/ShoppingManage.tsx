'use client';

/**
 * Shopping's Manage view in the new look (#1055).
 *
 * The list itself ticks, edits and adds items, so Manage is for the categories:
 * one quiet row each, in the household's order. A row moves by dragging (mouse,
 * or press-and-hold on a touchscreen), its emoji and name change in place, its
 * switch says whether this list shows it, and it can be removed. A new category
 * is added at the foot. This replaces the card grid with ruled lines and the
 * separate Manage Categories dialog.
 */
import { useState } from 'react';
import { GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Emoji } from '@/components/ui/Emoji';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useLongPressDrag } from '@/lib/hooks/useLongPressDrag';
import type { ShoppingCategoryDef } from '@/lib/hooks/useShoppingCategories';
import { cn } from '@/lib/utils';

export const CATEGORY_EMOJI = [
  '🥬', '🥛', '🥩', '🥖', '🧊', '🥫', '👕', '🏠', '🌱', '🔌', '📎', '🎁',
  '🧴', '🥤', '🍿', '🧀', '🥚', '🍕', '🧹', '💊', '🐾', '🍬', '🧃', '🥜',
  '🫒', '🌶️', '🍯', '🛒', '🧺', '🍎', '🥦', '🧈', '🥐', '🍳', '🧂', '🫧',
  '🪥', '🧻', '🧽', '💡', '🔋', '🎉', '✏️',
];

interface Drag {
  dragged: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onTouchStart: (id: string) => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchEnd: () => void;
}

export interface ShoppingManageProps {
  categories: ShoppingCategoryDef[];
  listName: string;
  /** Items still to buy on this list, by category id. */
  counts: Record<string, number>;
  /** Is the category shown on this list? */
  shown: (id: string) => boolean;
  drag: Drag;
  onShow: (id: string, show: boolean) => void;
  onRename: (id: string, name: string) => void;
  onEmoji: (id: string, emoji: string) => void;
  onRemove: (category: ShoppingCategoryDef) => void;
  onAdd: (name: string) => Promise<boolean>;
  onReset: () => void;
}

export function ShoppingManage(props: ShoppingManageProps) {
  const { categories, listName, onAdd, onReset } = props;
  const [newName, setNewName] = useState('');

  return (
    <div className="mx-auto max-w-2xl" data-shopping-manage-view>
      <p className="px-2 pb-3 text-sm text-muted-foreground">
        Drag to change the order. The switch shows or hides a category on {listName}.
      </p>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card/85">
        {categories.map((cat) => <Row key={cat.id} cat={cat} {...props} />)}
      </ul>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          if (await onAdd(name)) setNewName('');
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category"
          className="min-h-[44px] rounded-full px-4"
          aria-label="New category"
          data-shopping-new-category
        />
        <Button type="submit" variant="outline" disabled={!newName.trim()} data-shopping-add-category>
          <Plus className="mr-1 h-4 w-4" />Add category
        </Button>
      </form>

      <Button variant="ghost" size="sm" className="mt-6 text-muted-foreground" onClick={onReset} data-shopping-reset-categories>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />Reset to the default categories
      </Button>
    </div>
  );
}

function Row({ cat, counts, shown, drag, onShow, onRename, onEmoji, onRemove }: ShoppingManageProps & { cat: ShoppingCategoryDef }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [picking, setPicking] = useState(false);
  const { ref } = useLongPressDrag<HTMLLIElement>({
    onStart: () => drag.onTouchStart(cat.id),
    onMove: drag.onTouchMove,
    onEnd: drag.onTouchEnd,
  });
  const on = shown(cat.id);
  const count = counts[cat.id] ?? 0;
  const save = () => {
    setEditing(false);
    const next = name.trim();
    if (next && next !== cat.name) onRename(cat.id, next);
    else setName(cat.name);
  };

  return (
    <li
      ref={ref}
      data-category={cat.id}
      data-shopping-manage-row={cat.id}
      draggable={!editing}
      onDragStart={() => drag.onDragStart(cat.id)}
      onDragOver={(e) => drag.onDragOver(e, cat.id)}
      onDragEnd={drag.onDragEnd}
      className={cn('relative flex min-h-[56px] items-center gap-3 px-3 py-2', drag.dragged === cat.id && 'opacity-50')}
    >
      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />
      <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
      <button
        type="button"
        className="shrink-0 rounded-md p-1 text-xl hover:bg-accent"
        onClick={() => setPicking(!picking)}
        aria-label={`Change the emoji for ${cat.name}`}
      >
        <Emoji e={cat.emoji} />
      </button>
      {picking && (
        <div className="absolute left-12 top-full z-50 mt-1 grid w-72 grid-cols-8 gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
          {CATEGORY_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className={cn('rounded p-1 text-lg hover:bg-accent', cat.emoji === e && 'bg-accent ring-1 ring-primary')}
              onClick={() => { setPicking(false); onEmoji(cat.id, e); }}
            >
              <Emoji e={e} />
            </button>
          ))}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              if (e.key === 'Escape') { setName(cat.name); setEditing(false); }
            }}
            className="h-9"
            aria-label={`New name for ${cat.name}`}
            data-shopping-rename-input
          />
        ) : (
          <button
            type="button"
            className="block max-w-full truncate text-left text-body font-medium hover:underline"
            onClick={() => { setName(cat.name); setEditing(true); }}
            aria-label={`Rename ${cat.name}`}
          >
            {cat.name}
          </button>
        )}
        {count > 0 && <span className="text-sm text-muted-foreground">{count} to buy</span>}
      </div>
      <Switch
        checked={on}
        onCheckedChange={(v) => onShow(cat.id, v)}
        aria-label={`Show ${cat.name} on this list`}
        data-shopping-shown={on ? 'on' : 'off'}
      />
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onRemove(cat)}
        aria-label={`Remove ${cat.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
