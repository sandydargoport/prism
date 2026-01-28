/**
 * ============================================================================
 * PRISM - Add Message Modal
 * ============================================================================
 *
 * A modal dialog for posting new family messages.
 * Messages are short notes for the family message board.
 *
 * USAGE:
 *   <AddMessageModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onMessageCreated={(msg) => console.log('Posted:', msg)}
 *   />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Loader2, Pin, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UserAvatar,
  Checkbox,
} from '@/components/ui';

/**
 * Family member for author selection
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

/**
 * Message data returned after creation
 */
export interface CreatedMessage {
  id: string;
  message: string;
  pinned: boolean;
  important: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    color: string;
  };
}

/**
 * AddMessageModal Props
 */
export interface AddMessageModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when message is successfully created */
  onMessageCreated?: (message: CreatedMessage) => void;
  /** Current logged-in user - when provided, locks author to this user */
  currentUser?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string | null;
  } | null;
  /** @deprecated Use currentUser instead */
  defaultAuthor?: string;
}

/**
 * ADD MESSAGE MODAL COMPONENT
 */
export function AddMessageModal({
  open,
  onOpenChange,
  onMessageCreated,
  currentUser,
  defaultAuthor,
}: AddMessageModalProps) {
  // Form state - use currentUser.id if available, otherwise defaultAuthor
  const [message, setMessage] = useState('');
  const [authorId, setAuthorId] = useState<string>(currentUser?.id || defaultAuthor || '');
  const [pinned, setPinned] = useState(false);
  const [important, setImportant] = useState(false);

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Family members for dropdown (only used if no currentUser)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Determine if author is locked (currentUser provided)
  const isAuthorLocked = !!currentUser;

  // Fetch family members when modal opens (only if not locked)
  useEffect(() => {
    if (open && !isAuthorLocked) {
      fetchFamilyMembers();
    } else if (open && isAuthorLocked) {
      setLoadingMembers(false);
    }
  }, [open, isAuthorLocked]);

  // Reset form when modal closes or currentUser changes
  useEffect(() => {
    if (!open) {
      setMessage('');
      setAuthorId(currentUser?.id || defaultAuthor || '');
      setPinned(false);
      setImportant(false);
      setError(null);
    }
  }, [open, currentUser, defaultAuthor]);

  // Update authorId when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setAuthorId(currentUser.id);
    }
  }, [currentUser]);

  async function fetchFamilyMembers() {
    try {
      setLoadingMembers(true);
      const response = await fetch('/api/family');
      if (response.ok) {
        const data = await response.json();
        const members = data.members.map((m: { id: string; name: string; color: string; avatarUrl?: string | null }) => ({
          id: m.id,
          name: m.name,
          color: m.color,
          avatarUrl: m.avatarUrl,
        }));
        setFamilyMembers(members);
        // Auto-select first member if none selected
        if (!authorId && members.length > 0) {
          setAuthorId(members[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch family members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate
    if (!message.trim()) {
      setError('Message is required');
      return;
    }

    if (!authorId) {
      setError('Please select who is posting this message');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          authorId,
          pinned,
          important,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to post message');
      }

      const createdMessage = await response.json();

      // Notify parent
      onMessageCreated?.(createdMessage);

      // Close modal
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post message');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Get selected author for preview
  const selectedAuthor = currentUser || familyMembers.find(m => m.id === authorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Post Message</DialogTitle>
          <DialogDescription>
            Leave a message for your family.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Author - locked to current user or dropdown */}
          <div className="space-y-2">
            <Label htmlFor="author">Posting As</Label>
            {isAuthorLocked && currentUser ? (
              // Show locked user (cannot change)
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                <UserAvatar
                  name={currentUser.name}
                  color={currentUser.color}
                  imageUrl={currentUser.avatarUrl || undefined}
                  size="sm"
                  className="h-6 w-6 text-[10px]"
                />
                <span className="font-medium">{currentUser.name}</span>
              </div>
            ) : (
              // Show dropdown for author selection
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger id="author">
                  <SelectValue placeholder={loadingMembers ? 'Loading...' : 'Select person'} />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={member.name}
                          color={member.color}
                          imageUrl={member.avatarUrl || undefined}
                          size="sm"
                          className="h-5 w-5 text-[10px]"
                        />
                        <span>{member.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="At gym, back at 9am..."
              rows={3}
              autoFocus
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pinned"
                checked={pinned}
                onCheckedChange={(checked) => setPinned(checked === true)}
              />
              <Label htmlFor="pinned" className="flex items-center gap-1.5 cursor-pointer">
                <Pin className="h-3.5 w-3.5" />
                Pin to top
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="important"
                checked={important}
                onCheckedChange={(checked) => setImportant(checked === true)}
              />
              <Label htmlFor="important" className="flex items-center gap-1.5 cursor-pointer">
                <AlertTriangle className="h-3.5 w-3.5" />
                Mark as important
              </Label>
            </div>
          </div>

          {/* Preview */}
          {message.trim() && selectedAuthor && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-xs text-muted-foreground mb-1">Preview</div>
              <div className="flex items-start gap-2">
                <UserAvatar
                  name={selectedAuthor.name}
                  color={selectedAuthor.color}
                  imageUrl={selectedAuthor.avatarUrl || undefined}
                  size="sm"
                  className="h-6 w-6 text-[10px]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: selectedAuthor.color }}>
                      {selectedAuthor.name}
                    </span>
                    {pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                    {important && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                  </div>
                  <p className="text-sm text-foreground">{message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !authorId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post Message'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
