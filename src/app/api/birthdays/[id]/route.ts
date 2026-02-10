/**
 *
 * ENDPOINT: /api/birthdays/[id]
 * - GET:    Get a specific birthday by ID
 * - PATCH:  Update a specific birthday
 * - DELETE: Delete a specific birthday
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { birthdays, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createBirthdaySchema, validateRequest } from '@/lib/validations';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/birthdays/[id]
 * Retrieves a single birthday by its ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [birthdayWithUser] = await db
      .select({
        id: birthdays.id,
        name: birthdays.name,
        birthDate: birthdays.birthDate,
        giftIdeas: birthdays.giftIdeas,
        sendCardDaysBefore: birthdays.sendCardDaysBefore,
        createdAt: birthdays.createdAt,
        userId: users.id,
        userName: users.name,
        userColor: users.color,
      })
      .from(birthdays)
      .leftJoin(users, eq(birthdays.userId, users.id))
      .where(eq(birthdays.id, id));

    if (!birthdayWithUser) {
      return NextResponse.json(
        { error: 'Birthday not found' },
        { status: 404 }
      );
    }

    // Calculate age and days until
    const birthDate = new Date(birthdayWithUser.birthDate);
    const today = new Date();
    const currentYear = today.getFullYear();
    const age = currentYear - birthDate.getFullYear();

    const nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
    if (nextBirthday < today) {
      nextBirthday.setFullYear(currentYear + 1);
    }
    const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      id: birthdayWithUser.id,
      name: birthdayWithUser.name,
      birthDate: birthdayWithUser.birthDate,
      age,
      daysUntil,
      nextBirthday: nextBirthday.toISOString().split('T')[0],
      giftIdeas: birthdayWithUser.giftIdeas,
      sendCardDaysBefore: birthdayWithUser.sendCardDaysBefore,
      createdAt: birthdayWithUser.createdAt.toISOString(),
      user: birthdayWithUser.userId ? {
        id: birthdayWithUser.userId,
        name: birthdayWithUser.userName,
        color: birthdayWithUser.userColor,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching birthday:', error);
    return NextResponse.json(
      { error: 'Failed to fetch birthday' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/birthdays/[id]
 * Updates a specific birthday.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   name?: string
 *   birthDate?: string (YYYY-MM-DD)
 *   userId?: string | null
 *   giftIdeas?: string | null
 *   sendCardDaysBefore?: number
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if birthday exists
    const [existingBirthday] = await db
      .select({ id: birthdays.id })
      .from(birthdays)
      .where(eq(birthdays.id, id));

    if (!existingBirthday) {
      return NextResponse.json(
        { error: 'Birthday not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const validation = validateRequest(createBirthdaySchema.partial(), body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if ('name' in validation.data) updateData.name = validation.data.name;
    if ('birthDate' in validation.data) updateData.birthDate = validation.data.birthDate;
    if ('userId' in validation.data) updateData.userId = validation.data.userId || null;
    if ('giftIdeas' in validation.data) updateData.giftIdeas = validation.data.giftIdeas || null;
    if ('sendCardDaysBefore' in validation.data) updateData.sendCardDaysBefore = validation.data.sendCardDaysBefore;

    // Execute update
    await db
      .update(birthdays)
      .set(updateData)
      .where(eq(birthdays.id, id));

    // Fetch and return updated birthday
    const [updatedBirthdayWithUser] = await db
      .select({
        id: birthdays.id,
        name: birthdays.name,
        birthDate: birthdays.birthDate,
        giftIdeas: birthdays.giftIdeas,
        sendCardDaysBefore: birthdays.sendCardDaysBefore,
        createdAt: birthdays.createdAt,
        userId: users.id,
        userName: users.name,
        userColor: users.color,
      })
      .from(birthdays)
      .leftJoin(users, eq(birthdays.userId, users.id))
      .where(eq(birthdays.id, id));

    if (!updatedBirthdayWithUser) {
      return NextResponse.json(
        { error: 'Birthday not found after update' },
        { status: 404 }
      );
    }

    // Calculate age and days until
    const birthDate = new Date(updatedBirthdayWithUser.birthDate);
    const today = new Date();
    const currentYear = today.getFullYear();
    const age = currentYear - birthDate.getFullYear();

    const nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
    if (nextBirthday < today) {
      nextBirthday.setFullYear(currentYear + 1);
    }
    const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      id: updatedBirthdayWithUser.id,
      name: updatedBirthdayWithUser.name,
      birthDate: updatedBirthdayWithUser.birthDate,
      age,
      daysUntil,
      nextBirthday: nextBirthday.toISOString().split('T')[0],
      giftIdeas: updatedBirthdayWithUser.giftIdeas,
      sendCardDaysBefore: updatedBirthdayWithUser.sendCardDaysBefore,
      createdAt: updatedBirthdayWithUser.createdAt.toISOString(),
      user: updatedBirthdayWithUser.userId ? {
        id: updatedBirthdayWithUser.userId,
        name: updatedBirthdayWithUser.userName,
        color: updatedBirthdayWithUser.userColor,
      } : null,
    });
  } catch (error) {
    console.error('Error updating birthday:', error);
    return NextResponse.json(
      { error: 'Failed to update birthday' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/birthdays/[id]
 * Deletes a specific birthday.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Check if birthday exists
    const [existingBirthday] = await db
      .select({ id: birthdays.id, name: birthdays.name })
      .from(birthdays)
      .where(eq(birthdays.id, id));

    if (!existingBirthday) {
      return NextResponse.json(
        { error: 'Birthday not found' },
        { status: 404 }
      );
    }

    // Delete the birthday
    await db
      .delete(birthdays)
      .where(eq(birthdays.id, id));

    return NextResponse.json({
      message: 'Birthday deleted successfully',
      deletedBirthday: {
        id: existingBirthday.id,
        name: existingBirthday.name,
      },
    });
  } catch (error) {
    console.error('Error deleting birthday:', error);
    return NextResponse.json(
      { error: 'Failed to delete birthday' },
      { status: 500 }
    );
  }
}
