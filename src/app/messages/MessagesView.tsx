/**
 * ============================================================================
 * PRISM - Messages View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive messages view with all family messages.
 *
 * FEATURES:
 * - Display all messages in a list/card format
 * - Show message author, content, timestamp
 * - Mark messages as pinned/important
 * - Delete messages
 * - Add new message button
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import {
  MessageSquare,
  Plus,
  Home,
  Pin,
  AlertTriangle,
  Trash2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { useMessages } from '@/lib/hooks';
import { useAuth } from '@/components/providers';
import { AddMessageModal } from '@/components/modals/AddMessageModal';
import type { FamilyMessage } from '@/components/widgets/MessagesWidget';


/**
 * FAMILY MEMBER TYPE
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
}


/**
 * MESSAGES VIEW COMPONENT
 */
export function MessagesView() {
  const router = useRouter();
  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  // State
  const { messages, loading, error, refresh, deleteMessage } = useMessages();
  const [filterAuthor, setFilterAuthor] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get unique authors
  const authors = useMemo(() => {
    const authorMap = new Map<string, FamilyMember>();
    messages.forEach((msg) => {
      if (!authorMap.has(msg.author.id)) {
        authorMap.set(msg.author.id, {
          id: msg.author.id,
          name: msg.author.name,
          color: msg.author.color,
        });
      }
    });
    return Array.from(authorMap.values());
  }, [messages]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    // Apply author filter
    if (filterAuthor) {
      result = result.filter((msg) => msg.author.id === filterAuthor);
    }

    // Sort: pinned first, then by date (newest first)
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return result;
  }, [messages, filterAuthor]);

  // Handle delete - requires auth and ownership check
  const handleDelete = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const user = await requireAuth("Who's deleting this message?");
    if (!user) return;

    // Check ownership - parents can delete any message, others can only delete their own
    const isParent = user.role === 'parent';
    const isOwnMessage = message.author.id === user.id;

    if (!isParent && !isOwnMessage) {
      alert(`This message was posted by ${message.author.name}. Only they or a parent can delete it.`);
      return;
    }

    if (confirm('Delete this message?')) {
      await deleteMessage(messageId);
    }
  };

  // Message counts
  const pinnedCount = messages.filter((m) => m.pinned).length;
  const importantCount = messages.filter((m) => m.important).length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back and title */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>

              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Messages</h1>
                <Badge variant="secondary">{messages.length}</Badge>
                {pinnedCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Pin className="h-3 w-3" />
                    {pinnedCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: Add button, user avatar, settings */}
            <div className="flex items-center gap-2">
              <Button onClick={async () => {
                const user = await requireAuth("Who's posting?");
                if (user) setShowAddModal(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Message
              </Button>

              {/* User avatar */}
              <button
                onClick={activeUser ? clearActiveUser : () => requireAuth()}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-accent transition-colors"
                aria-label={activeUser ? 'Log out' : 'Log in'}
              >
                {activeUser ? (
                  <UserAvatar
                    name={activeUser.name}
                    color={activeUser.color}
                    size="sm"
                    className="h-8 w-8"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Settings */}
              <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* ================================================================== */}
        {/* FILTERS */}
        {/* ================================================================== */}
        {authors.length > 1 && (
          <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-2">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Filter by author */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Author:</span>
                <div className="flex gap-1">
                  <Button
                    variant={filterAuthor === null ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterAuthor(null)}
                  >
                    All
                  </Button>
                  {authors.map((author) => (
                    <Button
                      key={author.id}
                      variant={filterAuthor === author.id ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setFilterAuthor(author.id)}
                      className="gap-1"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: author.color }}
                      />
                      {author.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MESSAGE LIST */}
        {/* ================================================================== */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50 mx-auto" />
                <p>Loading messages...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mb-4 opacity-50 mx-auto" />
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={refresh}
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>No messages found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                Add your first message
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl mx-auto">
              {filteredMessages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onDelete={() => handleDelete(message.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Message Modal */}
        <AddMessageModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          currentUser={activeUser ? {
            id: activeUser.id,
            name: activeUser.name,
            color: activeUser.color,
            avatarUrl: activeUser.avatarUrl,
          } : undefined}
          onMessageCreated={() => {
            refresh();
            setShowAddModal(false);
          }}
        />
      </div>
    </PageWrapper>
  );
}


/**
 * MESSAGE CARD COMPONENT
 */
function MessageCard({
  message,
  onDelete,
}: {
  message: FamilyMessage;
  onDelete: () => void;
}) {
  const timeAgo = formatDistanceToNow(message.createdAt, { addSuffix: true });
  const fullDate = format(message.createdAt, 'PPp');

  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-border',
        'hover:bg-accent/30 transition-colors',
        'group',
        message.important && 'bg-destructive/10 border-destructive/20'
      )}
    >
      {/* Header: Author and badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={message.author.name}
            color={message.author.color}
            imageUrl={message.author.avatarUrl}
            size="md"
            className="h-8 w-8 text-sm"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className="font-medium"
                style={{ color: message.author.color }}
              >
                {message.author.name}
              </span>
              {message.pinned && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              {message.important && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Important
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground" title={fullDate}>
              {timeAgo}
            </span>
          </div>
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive"
          title="Delete message"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Message content */}
      <p className="text-sm text-foreground whitespace-pre-wrap pl-10">
        {message.message}
      </p>
    </div>
  );
}
