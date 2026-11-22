'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast } from '@/components/ui/use-toast';
import { Upload, Trash2, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_PIN_LENGTH } from '@/lib/constants';
import { describePin, lengthOptions, normalizePin, pinMatches, pinNoun, type PinKind } from '@/lib/auth/pinKind';
import { MemberColorPicker, type TakenMemberColor } from '@/components/ui/MemberColorPicker';
import { nextFreeMemberColor } from '@/lib/constants/memberColors';
import type { FamilyMember } from './PinEditModal';

const EmojiPicker = dynamic(
  () => import('@emoji-mart/react').then((m) => ({ default: m.default as React.ComponentType<Record<string, unknown>> })),
  { ssr: false },
);

export interface MemberModalSaveData {
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  pinLength: number;
  /** A PIN or a passcode of lowercase letters and numbers (#1197). */
  pinKind: PinKind;
  /** Sent with a length change on a member who has a PIN: the new PIN, and
   *  the current one the server needs to allow it. */
  pin?: string;
  currentPin?: string;
}

export function MemberModal({
  member,
  canResetPin = false,
  takenColors = [],
  onClose,
  onSave,
}: {
  member?: FamilyMember;
  /** Colours the other members already use, marked on the swatches. */
  takenColors?: readonly TakenMemberColor[];
  /** A parent editing a child or guest: a new PIN needs no current one. */
  canResetPin?: boolean;
  onClose: () => void;
  onSave: (member: MemberModalSaveData) => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState<'parent' | 'child' | 'guest'>(member?.role || 'child');
  // A new member starts on the first colour nobody has yet.
  const [color, setColor] = useState(
    () => member?.color || nextFreeMemberColor(takenColors.map((t) => t.color)),
  );
  // A new member defaults to a plain 4-digit PIN length — editing an
  // existing member starts from whatever length is already persisted on
  // them. Each member's own choice is the source of truth; there is no
  // family-wide default any more.
  const [pinLength, setPinLength] = useState(member?.pinLength ?? DEFAULT_PIN_LENGTH);
  // A PIN or a passcode (#1197): switching picks that kind's first length
  // unless the current one is allowed for it too.
  const savedKind: PinKind = member?.pinKind ?? 'digits';
  const [pinKind, setPinKindState] = useState<PinKind>(savedKind);
  const setPinKind = (k: PinKind) => {
    setPinKindState(k);
    if (!lengthOptions(k).includes(pinLength)) setPinLength(lengthOptions(k)[0]!);
    setNewPin('');
    setConfirmPin('');
  };
  // A new length or kind strands the PIN this member already has, so it is
  // only saved together with a new one of that shape (the server refuses it
  // otherwise).
  const lengthChanged = !!member?.hasPin && (pinLength !== (member.pinLength ?? DEFAULT_PIN_LENGTH) || pinKind !== savedKind);
  const noun = pinNoun(pinKind);
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
        setPinError(`Enter the current ${pinNoun(savedKind)}`);
        return;
      }
      if (!pinMatches(pinKind, pinLength, newPin)) {
        setPinError(`The new ${noun} must be exactly ${describePin(pinKind, pinLength)}`);
        return;
      }
      if (newPin !== confirmPin) {
        setPinError(`The new ${noun}s do not match`);
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
      pinKind,
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
            <MemberColorPicker
              className="mt-1"
              value={color}
              onChange={setColor}
              taken={takenColors}
            />
          </div>

          <div>
            <label className="text-sm font-medium" id="member-sign-in-with">Signs in with</label>
            <div className="flex gap-2 mt-1" role="group" aria-labelledby="member-sign-in-with">
              {(['digits', 'passcode'] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={k === pinKind ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPinKind(k)}
                  className="flex-1"
                  aria-pressed={k === pinKind}
                  data-pin-kind={k}
                >
                  {k === 'passcode' ? 'Passcode' : 'PIN'}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pinKind === 'passcode'
                ? 'Letters and numbers, typed on the pad with ABC. Best for adults; a child who cannot spell yet is better on a PIN.'
                : 'Numbers on the pad.'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">{pinKind === 'passcode' ? 'Passcode length' : 'PIN length'}</label>
            <div className="flex gap-2 mt-1">
              {lengthOptions(pinKind).map((len) => (
                <Button
                  key={len}
                  type="button"
                  variant={len === pinLength ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPinLength(len)}
                  className="flex-1"
                  aria-pressed={len === pinLength}
                >
                  {pinKind === 'passcode' ? len : `${len} digits`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              How many {pinKind === 'passcode' ? 'letters and numbers' : 'digits'} {member ? `${name || 'this member'}'s` : "this member's"} pad will require.
            </p>
          </div>

          {lengthChanged && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                {describePin(pinKind, pinLength)[0]!.toUpperCase() + describePin(pinKind, pinLength).slice(1)} needs a new {noun} of that length.
              </p>
              {!canResetPin && (
              <div>
                <label className="text-sm font-medium">Current {pinNoun(savedKind)}</label>
                <Input
                  type="password"
                  inputMode={savedKind === 'passcode' ? 'text' : 'numeric'}
                  autoCapitalize="none"
                  maxLength={member?.pinLength ?? DEFAULT_PIN_LENGTH}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(normalizePin(savedKind, e.target.value))}
                  placeholder={`Enter current ${pinNoun(savedKind)}`}
                />
              </div>
              )}
              <div>
                <label className="text-sm font-medium">New {noun}</label>
                <Input
                  type="password"
                  inputMode={pinKind === 'passcode' ? 'text' : 'numeric'}
                  autoCapitalize="none"
                  maxLength={pinLength}
                  value={newPin}
                  onChange={(e) => setNewPin(normalizePin(pinKind, e.target.value))}
                  placeholder={describePin(pinKind, pinLength)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm new {noun}</label>
                <Input
                  type="password"
                  inputMode={pinKind === 'passcode' ? 'text' : 'numeric'}
                  autoCapitalize="none"
                  maxLength={pinLength}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(normalizePin(pinKind, e.target.value))}
                  placeholder={`Re-enter new ${noun}`}
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
