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
import { DEFAULT_PIN_LENGTH, MAX_PIN_LENGTH } from '@/lib/constants';

import type { FamilyMember } from '@/types';
export type { FamilyMember };

export function PinEditModal({
  member,
  onClose,
  onSaved,
}: {
  member: FamilyMember;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin && !new RegExp(`^\\d{${pinLength}}$`).test(newPin)) {
      setError(`PIN must be exactly ${pinLength} digits`);
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setSaving(true);

    try {
      const body: { pin: string | null; currentPin?: string } = {
        pin: newPin || null,
      };

      if (member.hasPin) {
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
            {member.hasPin ? 'Change PIN' : 'Set PIN'} for {member.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {member.hasPin && (
            <div>
              <label className="text-sm font-medium">Current PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={MAX_PIN_LENGTH}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">New PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={pinLength}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder={`${pinLength} digits`}
              autoFocus={!member.hasPin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to remove PIN (not recommended)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Confirm New PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={pinLength}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Re-enter new PIN"
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
              {saving ? 'Saving...' : 'Save PIN'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
