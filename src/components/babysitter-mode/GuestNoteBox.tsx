'use client';

/**
 * A box on the Babysitter Mode overlay where the sitter leaves a note for the
 * family (#497). The overlay covers every page while the mode is on, so this
 * is also what a sitter sees on /babysitter. It posts to /api/guest-notes,
 * which only accepts notes while the mode is on, and the note lands on the
 * Messages board. The sitter cannot read anything back: the board stays
 * family-only.
 */

import { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GUEST_NAME_MAX_LENGTH, GUEST_NOTE_MAX_LENGTH } from '@/lib/messages/guestNotes';
import { cn } from '@/lib/utils';

type GuestNoteBoxProps = {
  className?: string;
};

export function GuestNoteBox({ className }: GuestNoteBoxProps) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = message.trim();

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/guest-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'The note could not be sent. Try again.');
        return;
      }
      setMessage('');
      setSent(true);
    } catch {
      setError('The note could not be sent. Check the connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const fieldClass = 'bg-white/10 border-white/30 text-white placeholder:text-white/50';

  return (
    <div
      className={cn(
        'bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/20 text-white',
        className
      )}
      // The overlay opens its unlock dialog on any click; typing here must not.
      onClick={(e) => e.stopPropagation()}
      // The overlay is above the on-screen keyboard's usual layer, and Send is
      // below the note, so the keyboard lifts the whole box.
      data-keyboard-above-overlays
      data-keyboard-reveal
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-1">
        <MessageSquare className="h-5 w-5" />
        Leave a note for the family
      </h2>
      <p className="text-sm mb-3 text-white/70">
        It goes on the family&apos;s Messages board.
      </p>

      {sent ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm" role="status">
            <Check className="h-4 w-4" />
            Sent. The family will see it on the Messages board.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSent(false)}
          >
            Write another
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            aria-label="Note for the family"
            placeholder="e.g. Everyone ate dinner, bedtime went fine."
            value={message}
            maxLength={GUEST_NOTE_MAX_LENGTH}
            onChange={(e) => setMessage(e.target.value)}
            className={fieldClass}
          />
          <div className="flex items-center gap-3">
            <Input
              aria-label="Your name (optional)"
              placeholder="Your name (optional)"
              value={name}
              maxLength={GUEST_NAME_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              className={cn('flex-1', fieldClass)}
            />
            <span className="text-xs tabular-nums text-white/60">
              {message.length}/{GUEST_NOTE_MAX_LENGTH}
            </span>
            <Button
              onClick={send}
              disabled={!trimmed || sending}
              // Keep focus in the note. Taking it would close the on-screen
              // keyboard and drop the room it made, moving this button out
              // from under the tap before the click lands.
              onMouseDown={(e) => e.preventDefault()}
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-200" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
