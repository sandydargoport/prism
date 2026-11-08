'use client';

/**
 * Pets (#996), under Family Members: a name, a kind and a colour. A pet is
 * not a member (no account, PIN or points); a chore or reminder can be for
 * one, and shows the pet's name in its colour.
 */
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Emoji } from '@/components/ui/Emoji';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { usePets, PET_KINDS, type Pet } from '@/lib/hooks/usePets';
import { MEMBER_COLOR_OPTIONS } from '@/lib/constants/memberColors';

type Draft = Omit<Pet, 'id'>;
const COLORS = MEMBER_COLOR_OPTIONS.slice(0, 8);

function PetForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (d: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.name.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ ...d, name: d.name.trim() });
    setBusy(false);
    if (ok && !onCancel) setD({ ...initial, name: '' });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border p-4" data-pet-form>
      <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Pet's name" aria-label="Pet's name" maxLength={100} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
        {PET_KINDS.map((k) => (
          <Button key={k.value} type="button" size="sm" variant={d.kind === k.value ? 'default' : 'outline'}
            aria-pressed={d.kind === k.value} onClick={() => setD({ ...d, kind: k.value })}>
            <Emoji e={k.emoji} /> {k.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
        {COLORS.map((c) => (
          <button key={c.value} type="button" aria-label={c.name} aria-pressed={d.color === c.value}
            onClick={() => setD({ ...d, color: c.value })}
            className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-background ${d.color === c.value ? 'ring-2 ring-foreground' : ''}`}
            style={{ backgroundColor: c.value }} />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={!d.name.trim() || busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

export function PetsSection() {
  const { pets, refresh } = usePets();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const send = async (url: string, method: string, body?: Draft): Promise<boolean> => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: typeof data.error === 'string' ? data.error : 'That did not save', variant: 'destructive' });
      return false;
    }
    await refresh();
    return true;
  };

  return (
    <div className="space-y-3" data-pets-section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pets</h2>
          <p className="text-muted-foreground">A chore or reminder can be for a pet. Pets have no sign-in or points.</p>
        </div>
        {!adding && (
          <Button variant="outline" onClick={() => setAdding(true)} data-pets-add>
            <Plus className="h-4 w-4 mr-1" />Add Pet
          </Button>
        )}
      </div>

      {pets.map((p) => editing === p.id ? (
        <PetForm key={p.id} initial={{ name: p.name, kind: p.kind, color: p.color }} submitLabel="Save"
          onCancel={() => setEditing(null)}
          onSubmit={async (d) => { const ok = await send(`/api/pets/${p.id}`, 'PATCH', d); if (ok) setEditing(null); return ok; }} />
      ) : (
        <div key={p.id} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border px-4" data-pet-row={p.name}>
          <span aria-hidden className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1 font-medium">{p.name}</span>
          <span className="text-sm text-muted-foreground">
            <Emoji e={PET_KINDS.find((k) => k.value === p.kind)?.emoji ?? '🐾'} /> {PET_KINDS.find((k) => k.value === p.kind)?.label}
          </span>
          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p.id)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Remove ${p.name}`}
            onClick={async () => {
              if (!(await confirm(`Remove ${p.name}?`, 'Chores for this pet stay, for no one in particular.'))) return;
              await send(`/api/pets/${p.id}`, 'DELETE');
            }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {adding && (
        <PetForm initial={{ name: '', kind: 'cat', color: COLORS[pets.length % COLORS.length]!.value }} submitLabel="Add Pet"
          onCancel={() => setAdding(false)}
          onSubmit={async (d) => { const ok = await send('/api/pets', 'POST', d); if (ok) setAdding(false); return ok; }} />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
