/**
 * ============================================================================
 * PRISM - Individual Message API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Handles HTTP requests for a specific family message by ID.
 *
 * ENDPOINT: /api/messages/[id]
 * - GET:    Get a specific message
 * - PATCH:  Update a message (pin, mark important, edit text)
 * - DELETE: Delete a message
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { familyMessages, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';


interface RouteParams {
  params: Promise<{ id: string }>;
}


/**
 * GET /api/messages/[id]
 * ============================================================================
 * Retrieves a single message by ID.
 * ============================================================================
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const [messageWithAuthor] = await db
      .select({
        id: familyMessages.id,
        message: familyMessages.message,
        pinned: familyMessages.pinned,
        important: familyMessages.important,
        expiresAt: familyMessages.expiresAt,
        createdAt: familyMessages.createdAt,
        authorId: users.id,
        authorName: users.name,
        authorColor: users.color,
        authorAvatar: users.avatarUrl,
      })
      .from(familyMessages)
      .innerJoin(users, eq(familyMessages.authorId, users.id))
      .where(eq(familyMessages.id, id));

    if (!messageWithAuthor) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: messageWithAuthor.id,
      message: messageWithAuthor.message,
      pinned: messageWithAuthor.pinned,
      important: messageWithAuthor.important,
      expiresAt: messageWithAuthor.expiresAt?.toISOString() || null,
      createdAt: messageWithAuthor.createdAt.toISOString(),
      author: {
        id: messageWithAuthor.authorId,
        name: messageWithAuthor.authorName,
        color: messageWithAuthor.authorColor,
        avatarUrl: messageWithAuthor.authorAvatar,
      },
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/messages/[id]
 * ============================================================================
 * Updates a specific message.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   message?: string    - Update message content
 *   pinned?: boolean    - Pin/unpin the message
 *   important?: boolean - Mark/unmark as important
 *   expiresAt?: string | null - Update or clear expiration
 * }
 *
 * NOTE: Only the message author or parents can edit messages.
 * This authorization check should be added when auth is implemented.
 * ============================================================================
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if message exists
    const [existingMessage] = await db
      .select({ id: familyMessages.id })
      .from(familyMessages)
      .where(eq(familyMessages.id, id));

    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if ('message' in body) {
      if (typeof body.message !== 'string' || body.message.trim().length === 0) {
        return NextResponse.json(
          { error: 'Message content must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.message = body.message.trim();
    }

    if ('pinned' in body) {
      updateData.pinned = Boolean(body.pinned);
    }

    if ('important' in body) {
      updateData.important = Boolean(body.important);
    }

    if ('expiresAt' in body) {
      if (body.expiresAt === null) {
        updateData.expiresAt = null;
      } else if (body.expiresAt) {
        const date = new Date(body.expiresAt);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expiresAt format' },
            { status: 400 }
          );
        }
        updateData.expiresAt = date;
      }
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Execute update
    await db
      .update(familyMessages)
      .set(updateData)
      .where(eq(familyMessages.id, id));

    // Fetch and return updated message
    const [updatedMessage] = await db
      .select({
        id: familyMessages.id,
        message: familyMessages.message,
        pinned: familyMessages.pinned,
        important: familyMessages.important,
        expiresAt: familyMessages.expiresAt,
        createdAt: familyMessages.createdAt,
        authorId: users.id,
        authorName: users.name,
        authorColor: users.color,
        authorAvatar: users.avatarUrl,
      })
      .from(familyMessages)
      .innerJoin(users, eq(familyMessages.authorId, users.id))
      .where(eq(familyMessages.id, id));

    if (!updatedMessage) {
      return NextResponse.json(
        { error: 'Message not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedMessage.id,
      message: updatedMessage.message,
      pinned: updatedMessage.pinned,
      important: updatedMessage.important,
      expiresAt: updatedMessage.expiresAt?.toISOString() || null,
      createdAt: updatedMessage.createdAt.toISOString(),
      author: {
        id: updatedMessage.authorId,
        name: updatedMessage.authorName,
        color: updatedMessage.authorColor,
        avatarUrl: updatedMessage.authorAvatar,
      },
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/messages/[id]
 * ============================================================================
 * Deletes a specific message.
 *
 * AUTHORIZATION:
 * - Parents can delete any message
 * - Children can only delete their own messages (messages they authored)
 *
 * RESPONSE:
 * - 200: Message deleted successfully
 * - 401: Not authenticated
 * - 403: Not authorized to delete this message
 * - 404: Message not found
 * - 500: Server error
 * ============================================================================
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // ========================================================================
    // AUTHENTICATION CHECK
    // ========================================================================
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;
    const userId = cookieStore.get('prism_user')?.value;

    if (!sessionToken || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate session token
    const sessionData = await validateSession(sessionToken);
    if (!sessionData || sessionData.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Fetch the current user to check their role
    const [currentUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // ========================================================================
    // CHECK IF MESSAGE EXISTS AND GET OWNERSHIP INFO
    // ========================================================================
    const [existingMessage] = await db
      .select({
        id: familyMessages.id,
        message: familyMessages.message,
        authorId: familyMessages.authorId,
      })
      .from(familyMessages)
      .where(eq(familyMessages.id, id));

    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // AUTHORIZATION CHECK
    // ========================================================================
    const isParent = currentUser.role === 'parent';
    const isAuthor = existingMessage.authorId === userId;

    if (!isParent && !isAuthor) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this message' },
        { status: 403 }
      );
    }

    // Delete the message
    await db
      .delete(familyMessages)
      .where(eq(familyMessages.id, id));

    return NextResponse.json({
      message: 'Message deleted successfully',
      deletedMessage: {
        id: existingMessage.id,
        preview: existingMessage.message.substring(0, 50) +
          (existingMessage.message.length > 50 ? '...' : ''),
      },
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
