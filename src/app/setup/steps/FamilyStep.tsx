'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIN_LENGTH_OPTIONS, DEFAULT_PIN_LENGTH } from '@/lib/constants';

const COLOR_OPTIONS = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
];

interface AddedMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
  color: string;
  hasPin: boolean;
  pinLength: number;
}

interface FamilyStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FamilyStep({ onNext, onBack }: FamilyStepProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'parent' | 'child'>('parent');
  const [color, setColor] = useState(COLOR_OPTIONS[0]!);
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [added, setAdded] = useState<AddedMember[]>([]);
  // Each member picks their own PIN length (4/5/6) independently — this is
  // just the plain built-in default offered for the next member added.
  const [memberPinLength, setMemberPinLength] = useState(DEFAULT_PIN_LENGTH);
  // Non-null while the form below is editing an already-added member (by id)
  // instead of adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingMember = editingId ? added.find((m) => m.id === editingId) ?? null : null;

  // Re-load members already created this setup session, so returning to this
  // step (or reloading the page) re-shows them — they live in the DB, not just
  // local state. During setup the family GET returns real ids (setup-bootstrap).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/family');
        if (!res.ok) return;
        const data = await res.json();
        const members: Array<Record<string, unknown>> = Array.isArray(data)
          ? data
          : (data.members ?? []);
        if (cancelled) return;
        setAdded(
          members
            .filter((m) => typeof m.id === 'string' && m.id)
            .map((m) => ({
              id: m.id as string,
              name: m.name as string,
              role: m.role === 'child' ? 'child' : 'parent',
              color: (m.color as string) ?? COLOR_OPTIONS[0]!,
              hasPin: !!m.hasPin,
              pinLength: (m.pinLength as number) ?? DEFAULT_PIN_LENGTH,
            })),
        );
      } catch {
        /* ignore — start with an empty list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A PIN is optional, but if one is being entered it must match this
  // member's chosen length exactly — otherwise the member could be saved
  // with a PIN shorter than what their login pad will later require,
  // locking them out (bug: creation let a 4-digit PIN save while "5 digits"
  // was selected).
  const pinMatchesLength = pin.length === 0 || pin.length === memberPinLength;

  // Names must be unique (case-insensitive, trimmed) — two members with the
  // same name break login/admin member selection. The server enforces this
  // too (it's the source of truth for members added in a prior wizard run),
  // but checking here against members added in *this* session gives instant
  // feedback instead of a round-trip error. When editing, exclude the member
  // being edited from the check against itself.
  const trimmedName = name.trim();
  const isDuplicateName =
    trimmedName.length > 0 &&
    added.some((m) => m.id !== editingId && m.name.trim().toLowerCase() === trimmedName.toLowerCase());

  const canSubmit = trimmedName.length > 0 && pinMatchesLength && !isDuplicateName;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPin('');
    setRemovePin(false);
    setRole('child');
    setColor(COLOR_OPTIONS[added.length % COLOR_OPTIONS.length] ?? COLOR_OPTIONS[0]!);
    setMemberPinLength(DEFAULT_PIN_LENGTH);
  };

  const startEdit = (member: AddedMember) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setColor(member.color);
    setMemberPinLength(member.pinLength);
    setPin('');
    setRemovePin(false);
  };

  const cancelEdit = () => resetForm();

  // Returns the saved member on success (so callers like "Continue" can act on
  // the freshly-added member before React state has flushed), or null if the
  // submit was skipped or the request failed.
  const submitMember = async (): Promise<AddedMember | null> => {
    // Guard against re-entrant submits (e.g. an Enter keypress firing while
    // the previous save is still in flight) creating a duplicate/racing call.
    if (!canSubmit || saving) return null;

    if (editingMember) {
      // Changing PIN length without also supplying a new matching PIN would
      // silently strand the member's existing PIN (the pad will require the
      // new length, but the stored hash was made for the old one).
      if (
        editingMember.hasPin &&
        memberPinLength !== editingMember.pinLength &&
        !removePin &&
        !pin.trim()
      ) {
        const confirmed = window.confirm(
          `Changing ${trimmedName}'s PIN length to ${memberPinLength} digits means their current PIN will stop working — they'll need a new ${memberPinLength}-digit PIN. Continue?`
        );
        if (!confirmed) return null;
      }

      setSaving(true);
      try {
        const body: Record<string, string | number | null> = {
          name: trimmedName,
          role,
          color,
          pinLength: memberPinLength,
        };
        if (removePin) body.pin = null;
        else if (pin.trim()) body.pin = pin.trim();

        const res = await fetch(`/api/family/${editingMember.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ title: data.error || 'Failed to update member', variant: 'destructive' });
          return null;
        }

        const updated = await res.json();
        const updatedMember: AddedMember = {
          id: updated.id, name: updated.name, role: updated.role,
          color: updated.color, hasPin: updated.hasPin, pinLength: updated.pinLength,
        };
        setAdded((prev) => prev.map((m) => (m.id === editingMember.id ? updatedMember : m)));
        toast({ title: `Updated ${trimmedName}` });
        resetForm();
        return updatedMember;
      } finally {
        setSaving(false);
      }
    }

    setSaving(true);
    try {
      const body: Record<string, string | number> = {
        name: trimmedName,
        role,
        color,
        pinLength: memberPinLength,
      };
      if (pin.trim()) body.pin = pin.trim();

      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || 'Failed to add member', variant: 'destructive' });
        return null;
      }

      const created = await res.json();
      const newMember: AddedMember = { id: created.id, name: trimmedName, role, color, hasPin: !!pin.trim(), pinLength: memberPinLength };
      setAdded((prev) => [...prev, newMember]);
      toast({ title: `Added ${trimmedName}` });
      resetForm();
      return newMember;
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: AddedMember) => {
    if (deletingId) return;
    if (!window.confirm(`Remove ${member.name}?`)) return;

    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/family/${member.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || 'Failed to remove member', variant: 'destructive' });
        return;
      }
      setAdded((prev) => prev.filter((m) => m.id !== member.id));
      if (editingId === member.id) resetForm();
      toast({ title: `Removed ${member.name}` });
    } finally {
      setDeletingId(null);
    }
  };

  const handleContinue = async () => {
    if (saving || deletingId) return;

    let effective = added;

    // Auto-save a member the user typed into the form but never clicked "Add
    // member" on. Without this, that half-entered person is silently dropped —
    // and if they were the only member, setup finishes with zero accounts and
    // the whole family is locked out of login (no member to select, no PIN pad).
    if (!editingMember && trimmedName.length > 0) {
      if (!canSubmit) {
        toast({
          title: 'Finish the member you\'re adding first',
          description: isDuplicateName
            ? 'That name is already taken.'
            : 'Check the PIN length, then tap “Add member”.',
          variant: 'destructive',
        });
        return;
      }
      const saved = await submitMember();
      if (!saved) return; // save failed — stay on this step so they can retry
      effective = [...added, saved];
    }

    if (effective.length === 0) {
      toast({ title: 'Add at least one family member to continue', variant: 'destructive' });
      return;
    }
    if (!effective.some((m) => m.role === 'parent')) {
      toast({
        title: 'Add at least one parent',
        description: 'Only parents can manage the household, so you need one to continue.',
        variant: 'destructive',
      });
      return;
    }

    onNext();
  };

  return (
    <Card className="max-h-[90vh] overflow-y-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Family Members</CardTitle>
        </div>
        <CardDescription>
          Add the people who will use this dashboard. Add at least one parent to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Already added */}
        {added.length > 0 && (
          <div className="space-y-2">
            {added.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                <Badge variant="secondary" className="capitalize text-xs">{m.role}</Badge>
                {m.hasPin && (
                  <Badge variant="outline" className="text-xs">{m.pinLength}-digit PIN</Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(m)}
                  disabled={saving || !!deletingId}
                  aria-label={`Edit ${m.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeMember(m)}
                  disabled={saving || !!deletingId}
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add / edit form */}
        <div className="space-y-3 rounded-lg border p-4">
          {editingMember && (
            <p className="text-sm font-medium text-muted-foreground">
              Editing {editingMember.name}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitMember(); }}
            />
            {isDuplicateName && (
              <p className="text-xs text-destructive">
                A member named &quot;{trimmedName}&quot; already exists. Use a different name.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Role</Label>
            <div className="flex gap-2">
              {(['parent', 'child'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    role === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-muted',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-transform',
                    color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : '',
                  )}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>PIN length for this member</Label>
            <div className="flex gap-2">
              {PIN_LENGTH_OPTIONS.map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => setMemberPinLength(len)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    len === memberPinLength
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-muted',
                  )}
                >
                  {len} digits
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="member-pin">
              PIN{' '}
              <span className="text-muted-foreground font-normal">
                {editingMember
                  ? removePin ? '(will be removed)' : '(leave blank to keep current)'
                  : '(optional)'}
              </span>
            </Label>
            <Input
              id="member-pin"
              type="password"
              maxLength={memberPinLength}
              placeholder={`${memberPinLength} digits`}
              value={pin}
              disabled={removePin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                if (removePin) setRemovePin(false);
              }}
            />
            {pin.length > 0 && pin.length !== memberPinLength && (
              <p className="text-xs text-destructive">
                PIN must be exactly {memberPinLength} digits
              </p>
            )}
            {editingMember?.hasPin && (
              <button
                type="button"
                onClick={() => { setRemovePin((v) => !v); setPin(''); }}
                className="text-xs text-destructive underline"
              >
                {removePin ? 'Cancel removing PIN' : 'Remove PIN'}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {editingMember && (
              <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving} className="flex-1">
                Cancel
              </Button>
            )}
            <Button onClick={submitMember} disabled={!canSubmit || saving} className="flex-1">
              {editingMember ? (
                'Save changes'
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add member
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onBack} className="flex-1" disabled={saving}>Back</Button>
          <Button onClick={handleContinue} className="flex-1" disabled={saving || !!deletingId}>
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {added.length === 0 && (
          <p className="text-xs text-center text-muted-foreground -mt-1">
            Add at least one parent to continue.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
