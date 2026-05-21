'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast } from '@/components/ui/use-toast';
import { X, Upload, Trash2, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
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
  pin?: string;
}

export function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member?: FamilyMember;
  onClose: () => void;
  onSave: (member: MemberModalSaveData) => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState<'parent' | 'child' | 'guest'>(member?.role || 'child');
  const [color, setColor] = useState(member?.color || colorOptions[0] || '#3B82F6');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member?.avatarUrl || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
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
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setPinError('PIN must be 4–6 digits');
      return;
    }
    setPinError(null);
    onSave({
      name: name.trim(),
      role,
      color,
      avatarUrl: avatarFile ? null : avatarUrl,
      avatarFile,
      pin: pin || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {member ? 'Edit Member' : 'Add Family Member'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

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

          {!member && (
            <div>
              <label className="text-sm font-medium">PIN <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(null); }}
                placeholder="4–6 digits"
                className="mt-1"
              />
              {pinError && <p className="text-sm text-destructive mt-1">{pinError}</p>}
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
      </div>
    </div>
  );
}
