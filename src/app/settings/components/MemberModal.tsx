'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast } from '@/components/ui/use-toast';
import { Upload, Trash2, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PIN_LENGTH_OPTIONS, DEFAULT_PIN_LENGTH, MAX_PIN_LENGTH } from '@/lib/constants';
import type { FamilyMember } from './PinEditModal';

const EmojiPicker = dynamic(
  () => import('@emoji-mart/react').then((m) => ({ default: m.default as React.ComponentType<Record<string, unknown>> })),
  { ssr: false },
);

const colorOptions = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
];

export interface MemberModalSaveData {
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  pinLength: number;
  /** Sent with a length change on a member who has a PIN: the new PIN, and
   *  the current one the server needs to allow it. */
  pin?: string;
  currentPin?: string;
}

export function MemberModal({
  member,
  canResetPin = false,
  onClose,
  onSave,
}: {
  member?: FamilyMember;
  /** A parent editing a child or guest: a new PIN needs no current one. */
  canResetPin?: boolean;
  onClose: () => void;
  onSave: (member: MemberModalSaveData) => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState<'parent' | 'child' | 'guest'>(member?.role || 'child');
  const [color, setColor] = useState(member?.color || colorOptions[0] || '#3B82F6');
  // A new member defaults to a plain 4-digit PIN length — editing an
  // existing member starts from whatever length is already persisted on
  // them. Each member's own choice is the source of truth; there is no
  // family-wide default any more.
  const [pinLength, setPinLength] = useState(member?.pinLength ?? DEFAULT_PIN_LENGTH);
  // A new length strands the PIN this member already has, so it is only
  // saved together with a new PIN of that length (the server refuses it
  // otherwise).
  const lengthChanged = !!member?.hasPin && pinLength !== (member.pinLength ?? DEFAULT_PIN_LENGTH);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member?.avatarUrl || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Please select a JPEG, PNG, or WebP image.', variant: 'warning' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large. Max 5MB.', variant: 'warning' });
      return;
    }

    setAvatarFile(file);
    setAvatarUrl(null);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const selectEmoji = (emoji: string) => {
    setAvatarUrl(`emoji:${emoji}`);
    setAvatarFile(null);
    setShowEmojiPicker(false);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
  };

  const removeAvatar = () => {
    setAvatarUrl(null);
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
  };

  const displayImageUrl = avatarPreview || avatarUrl;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (lengthChanged) {
      if (!canResetPin && !currentPin) {
        setPinError('Enter the current PIN');
        return;
      }
      if (!new RegExp(`^\\d{${pinLength}}$`).test(newPin)) {
        setPinError(`The new PIN must be exactly ${pinLength} digits`);
        return;
      }
      if (newPin !== confirmPin) {
        setPinError('The new PINs do not match');
        return;
      }
    }
    setPinError(null);

    onSave({
      name: name.trim(),
      role,
      color,
      avatarUrl: avatarFile ? null : avatarUrl,
      avatarFile,
      pinLength,
      ...(lengthChanged ? { pin: newPin, ...(canResetPin ? {} : { currentPin }) } : {}),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit Member' : 'Add Family Member'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Section */}
          <div>
            <label className="text-sm font-medium">Avatar</label>
            <div className="flex items-center gap-3 mt-1">
              <UserAvatar
                name={name || '?'}
                color={color}
                imageUrl={displayImageUrl}
                size="xl"
                className="h-16 w-16 text-lg"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
                {(avatarUrl || avatarFile) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeAvatar}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Emoji picker */}
            <div className="mt-3 relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="gap-2"
              >
                <Smile className="h-4 w-4" />
                {avatarUrl?.startsWith('emoji:') ? 'Change Emoji' : 'Choose Emoji'}
              </Button>
              {showEmojiPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                  <div className="absolute left-0 top-10 z-50">
                    <EmojiPicker
                      onEmojiSelect={(e: Record<string, unknown>) => selectEmoji(e.native as string)}
                      theme="auto"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family member name"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Role</label>
            <div className="flex gap-2 mt-1">
              {(['parent', 'child', 'guest'] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={role === r ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRole(r)}
                  className="capitalize flex-1"
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">PIN length</label>
            <div className="flex gap-2 mt-1">
              {PIN_LENGTH_OPTIONS.map((len) => (
                <Button
                  key={len}
                  type="button"
                  variant={len === pinLength ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPinLength(len)}
                  className="flex-1"
                  aria-pressed={len === pinLength}
                >
                  {len} digits
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              How many digits {member ? `${name || 'this member'}'s` : "this member's"} PIN pad will require.
            </p>
          </div>

          {lengthChanged && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                A {pinLength}-digit length needs a new {pinLength}-digit PIN.
              </p>
              {!canResetPin && (
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
                />
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
              {pinError && (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
                  {pinError}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {member ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
