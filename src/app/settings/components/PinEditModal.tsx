'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_PIN_LENGTH } from '@/lib/constants';
import { describePin, normalizePin, pinMatches, pinNoun } from '@/lib/auth/pinKind';

import type { FamilyMember } from '@/types';
export type { FamilyMember };

export function PinEditModal({
  member,
  canReset = false,
  onClose,
  onSaved,
}: {
  member: FamilyMember;
  /** A parent setting a child's or guest's PIN: no current PIN needed
   *  (parentCanResetPin). */
  canReset?: boolean;
  onClose: () => void;
  onSaved: (hasPin: boolean) => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // This member's own configured PIN length — set on the member (via
  // MemberModal / the setup wizard), not a family-wide constant.
  const pinLength = member.pinLength ?? DEFAULT_PIN_LENGTH;
  // A PIN or a passcode (#1197); the member editor chooses which.
  const kind = member.pinKind ?? 'digits';
  const noun = pinNoun(kind);
  const Noun = kind === 'passcode' ? 'Passcode' : 'PIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin && !pinMatches(kind, pinLength, newPin)) {
      setError(`${Noun} must be exactly ${describePin(kind, pinLength)}`);
      return;
    }

    if (newPin !== confirmPin) {
      setError(`${Noun}s do not match`);
      return;
    }

    setSaving(true);

    try {
      const body: { pin: string | null; currentPin?: string } = {
        pin: newPin || null,
      };

      if (member.hasPin && !canReset) {
        body.currentPin = currentPin;
      }

      const response = await fetch(`/api/family/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update PIN');
      }

      onSaved(!!newPin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {member.hasPin ? `Change ${noun}` : `Set ${noun}`} for {member.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {member.hasPin && !canReset && (
            <div>
              <label className="text-sm font-medium">Current {noun}</label>
              <Input
                type="password"
                inputMode={kind === 'passcode' ? 'text' : 'numeric'}
                autoCapitalize="none"
                maxLength={pinLength}
                value={currentPin}
                onChange={(e) => setCurrentPin(normalizePin(kind, e.target.value))}
                placeholder={`Enter current ${noun}`}
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">New {noun}</label>
            <Input
              type="password"
              inputMode={kind === 'passcode' ? 'text' : 'numeric'}
              autoCapitalize="none"
              maxLength={pinLength}
              value={newPin}
              onChange={(e) => setNewPin(normalizePin(kind, e.target.value))}
              placeholder={describePin(kind, pinLength)}
              autoFocus={!member.hasPin || canReset}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to remove the {noun} (not recommended)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Confirm new {noun}</label>
            <Input
              type="password"
              inputMode={kind === 'passcode' ? 'text' : 'numeric'}
              autoCapitalize="none"
              maxLength={pinLength}
              value={confirmPin}
              onChange={(e) => setConfirmPin(normalizePin(kind, e.target.value))}
              placeholder={`Re-enter new ${noun}`}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : `Save ${noun}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
