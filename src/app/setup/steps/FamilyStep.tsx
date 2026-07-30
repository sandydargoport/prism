'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinLength } from '@/lib/hooks/usePinLength';
import { MIN_PIN_LENGTH, MAX_PIN_LENGTH } from '@/lib/constants';

const COLOR_OPTIONS = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
];

interface AddedMember {
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
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<AddedMember[]>([]);
  // Family-wide default — seeds the PIN length for each newly-added member,
  // but each member below can choose their own (4/5/6) independently.
  const { pinLength: defaultPinLength, setPinLength: setDefaultPinLength, loading: defaultPinLengthLoading } = usePinLength();
  const [memberPinLength, setMemberPinLength] = useState(defaultPinLength);

  // Once the family default finishes loading from the server (it starts as a
  // locally-cached guess), adopt it for the member currently being added.
  useEffect(() => {
    if (!defaultPinLengthLoading) setMemberPinLength(defaultPinLength);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPinLengthLoading]);

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
  // feedback instead of a round-trip error.
  const trimmedName = name.trim();
  const isDuplicateName =
    trimmedName.length > 0 &&
    added.some((m) => m.name.trim().toLowerCase() === trimmedName.toLowerCase());

  const canAdd = trimmedName.length > 0 && pinMatchesLength && !isDuplicateName;

  // This only changes the DEFAULT offered to the next member added — each
  // member's own pin_length is sent (and persisted) individually when they're
  // added below, so changing the default here never strands an
  // already-added member's PIN. If the member currently being filled in
  // hasn't had a PIN typed yet, adopt the new default for them too.
  const handleDefaultPinLengthChange = async (len: number) => {
    if (len !== defaultPinLength) await setDefaultPinLength(len);
    if (pin.length === 0) setMemberPinLength(len);
  };

  const addMember = async () => {
    // Guard against re-entrant submits (e.g. an Enter keypress firing while
    // the previous add is still in flight) creating a duplicate member.
    if (!canAdd || saving) return;
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
        return;
      }

      setAdded((prev) => [...prev, { name: trimmedName, role, color, hasPin: !!pin.trim(), pinLength: memberPinLength }]);
      setName('');
      setPin('');
      setRole('child');
      setColor(COLOR_OPTIONS[added.length % COLOR_OPTIONS.length] ?? COLOR_OPTIONS[0]!);
      setMemberPinLength(defaultPinLength);
      toast({ title: `Added ${trimmedName}` });
    } finally {
      setSaving(false);
    }
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
        {/* Default PIN length — seeds the picker below for each new member;
            every member can still choose their own length independently. */}
        <div className="space-y-1">
          <Label>Default PIN length</Label>
          <div className="flex gap-2">
            {Array.from(
              { length: MAX_PIN_LENGTH - MIN_PIN_LENGTH + 1 },
              (_, i) => MIN_PIN_LENGTH + i
            ).map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => handleDefaultPinLengthChange(len)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  len === defaultPinLength
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                )}
              >
                {len} digits
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Used to pre-fill each new member&apos;s PIN length below — every member can choose their own (4/5/6). You can change this later in Settings → Security.
          </p>
        </div>

        {/* Already added */}
        {added.length > 0 && (
          <div className="space-y-2">
            {added.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                <Badge variant="secondary" className="capitalize text-xs">{m.role}</Badge>
                {m.hasPin && (
                  <Badge variant="outline" className="text-xs">{m.pinLength}-digit PIN</Badge>
                )}
                <Check className="h-4 w-4 text-green-500" />
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
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
              {Array.from(
                { length: MAX_PIN_LENGTH - MIN_PIN_LENGTH + 1 },
                (_, i) => MIN_PIN_LENGTH + i
              ).map((len) => (
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
            <Label htmlFor="member-pin">PIN <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="member-pin"
              type="password"
              maxLength={memberPinLength}
              placeholder={`${memberPinLength} digits`}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
            {pin.length > 0 && pin.length !== memberPinLength && (
              <p className="text-xs text-destructive">
                PIN must be exactly {memberPinLength} digits
              </p>
            )}
          </div>

          <Button onClick={addMember} disabled={!canAdd || saving} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Add member
          </Button>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={onNext} className="flex-1">
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {added.length === 0 && (
          <p className="text-xs text-center text-muted-foreground -mt-1">
            Add a member above, or skip if your family is already set up.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
