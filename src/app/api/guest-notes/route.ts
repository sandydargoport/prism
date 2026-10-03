/**
 * POST /api/guest-notes
 *
 * A note for the Messages board from someone without an account (#497).
 * Today that is the babysitter, and only while a parent has Babysitter Mode
 * on: the mode is the permission, so there is no login or PIN. Anyone who can
 * reach the babysitter page can post during that window, which is why notes
 * are short, plain text, and capped per household rather than per caller.
 *
 * REQUEST BODY:
 * {
 *   message: string (required, 1 to 500 characters)
 *   name?: string   (optional, up to 40 characters, e.g. "Sam")
 * }
 *
 * RESPONSE:
 * - 201: Note posted
 * - 400: Missing or too-long text
 * - 403: Babysitter Mode is off
 * - 429: Too many notes this hour
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { familyMessages } from '@/lib/db/schema';
import { getBabysitterModeState } from '@/lib/services/babysitterMode';
import {
  GUEST_NAME_MAX_LENGTH,
  GUEST_NOTE_MAX_LENGTH,
  GUEST_NOTE_RATE_LIMIT,
} from '@/lib/messages/guestNotes';
import { formatMessageRow } from '@/lib/utils/formatters';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

export async function POST(request: NextRequest) {
  try {
    const mode = await getBabysitterModeState();
    if (!mode.enabled) {
      return NextResponse.json(
        { error: 'Babysitter Mode is off, so notes cannot be left right now.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Write a note first.' }, { status: 400 });
    }
    if (message.length > GUEST_NOTE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Notes can be up to ${GUEST_NOTE_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length > GUEST_NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Names can be up to ${GUEST_NAME_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Counted only for notes that would be accepted, so a closed door or a
    // typo does not use up the hour's allowance.
    const limited = await rateLimitGuard(
      'household',
      'guest-notes',
      GUEST_NOTE_RATE_LIMIT.limit,
      GUEST_NOTE_RATE_LIMIT.windowSeconds
    );
    if (limited) return limited;

    const [note] = await db
      .insert(familyMessages)
      .values({
        message,
        authorId: null,
        guestKind: 'babysitter',
        guestName: name || null,
      })
      .returning();

    if (!note) {
      return NextResponse.json({ error: 'Failed to post note' }, { status: 500 });
    }

    await invalidateEntity('messages');

    logActivity({
      userId: null,
      action: 'create',
      entityType: 'message',
      entityId: note.id,
      summary: 'Babysitter left a note',
    });

    return NextResponse.json(
      formatMessageRow({
        ...note,
        authorName: null,
        authorColor: null,
        authorAvatar: null,
      }),
      { status: 201 }
    );
  } catch (error) {
    logError('Error posting guest note:', error);
    return NextResponse.json({ error: 'Failed to post note' }, { status: 500 });
  }
}
