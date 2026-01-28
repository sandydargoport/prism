/**
 * ============================================================================
 * PRISM - Family Messages API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Handles HTTP requests for family message board operations.
 * Messages are short notes that family members can post for everyone to see.
 *
 * ENDPOINT: /api/messages
 * - GET:  List all messages (with optional filters)
 * - POST: Create a new message
 *
 * USE CASES:
 * - "Dad at gym, back at 9am"
 * - "Swim practice canceled today"
 * - "Dinner is in the fridge"
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { familyMessages, users } from '@/lib/db/schema';
import { eq, desc, asc, and, gt, isNull, or } from 'drizzle-orm';


/**
 * MESSAGE RESPONSE TYPE
 * ============================================================================
 * The shape of message data returned by the API.
 * Includes the author's user information.
 * ============================================================================
 */
interface MessageResponse {
  id: string;
  message: string;
  pinned: boolean;
  important: boolean;
  expiresAt: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    color: string;
    avatarUrl: string | null;
  };
}


/**
 * GET /api/messages
 * ============================================================================
 * Lists all family messages.
 *
 * QUERY PARAMETERS:
 * - authorId:     Filter by author user ID
 * - pinned:       Filter by pinned status ("true" or "false")
 * - important:    Filter by important status ("true" or "false")
 * - includeExpired: Include expired messages ("true", default: "false")
 * - limit:        Maximum messages to return (default: 20)
 * - offset:       Pagination offset
 *
 * SORTING:
 * Messages are sorted by:
 * 1. Pinned messages first
 * 2. Then by creation date (newest first)
 *
 * RESPONSE:
 * {
 *   messages: MessageResponse[],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorId = searchParams.get('authorId');
    const pinned = searchParams.get('pinned');
    const important = searchParams.get('important');
    const includeExpired = searchParams.get('includeExpired') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filter conditions
    const conditions = [];

    if (authorId) {
      conditions.push(eq(familyMessages.authorId, authorId));
    }

    if (pinned !== null) {
      conditions.push(eq(familyMessages.pinned, pinned === 'true'));
    }

    if (important !== null) {
      conditions.push(eq(familyMessages.important, important === 'true'));
    }

    // By default, exclude expired messages
    // A message is not expired if: expiresAt is null OR expiresAt > now
    if (!includeExpired) {
      conditions.push(
        or(
          isNull(familyMessages.expiresAt),
          gt(familyMessages.expiresAt, new Date())
        )
      );
    }

    // Execute query with joins
    // Sort by pinned (desc so true comes first), then by createdAt (desc)
    const results = await db
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(familyMessages.pinned), desc(familyMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response
    const formattedMessages: MessageResponse[] = results.map((row) => ({
      id: row.id,
      message: row.message,
      pinned: row.pinned,
      important: row.important,
      expiresAt: row.expiresAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      author: {
        id: row.authorId,
        name: row.authorName,
        color: row.authorColor,
        avatarUrl: row.authorAvatar,
      },
    }));

    // Get total count
    const allMessages = await db
      .select({ id: familyMessages.id })
      .from(familyMessages)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      messages: formattedMessages,
      total: allMessages.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}


/**
 * POST /api/messages
 * ============================================================================
 * Creates a new family message.
 *
 * REQUEST BODY:
 * {
 *   message: string (required) - The message content
 *   authorId: string (required) - User ID of the author
 *   pinned?: boolean (default: false) - Pin to top of board
 *   important?: boolean (default: false) - Mark as important/urgent
 *   expiresAt?: string - ISO date when message should auto-delete
 * }
 *
 * RESPONSE:
 * - 201: Message created successfully
 * - 400: Invalid request body
 * - 500: Server error
 *
 * EXAMPLE:
 * POST /api/messages
 * {
 *   "message": "Swim practice canceled today",
 *   "authorId": "user-uuid",
 *   "important": true
 * }
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!body.authorId || typeof body.authorId !== 'string') {
      return NextResponse.json(
        { error: 'Author ID is required' },
        { status: 400 }
      );
    }

    // Verify author exists
    const [author] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.authorId));

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 400 }
      );
    }

    // Validate expiresAt if provided
    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiresAt format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
      // Ensure expiration is in the future
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'expiresAt must be in the future' },
          { status: 400 }
        );
      }
    }

    // Insert the new message
    const [newMessage] = await db
      .insert(familyMessages)
      .values({
        message: body.message.trim(),
        authorId: body.authorId,
        pinned: Boolean(body.pinned),
        important: Boolean(body.important),
        expiresAt: expiresAt,
      })
      .returning();

    if (!newMessage) {
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Fetch with author data
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
      .where(eq(familyMessages.id, newMessage.id));

    if (!messageWithAuthor) {
      return NextResponse.json(
        { error: 'Message created but could not be retrieved' },
        { status: 500 }
      );
    }

    const response: MessageResponse = {
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
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
