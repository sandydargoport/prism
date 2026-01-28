/**
 * ============================================================================
 * PRISM - Birthdays API Route
 * ============================================================================
 *
 * ENDPOINT: /api/birthdays
 * - GET:  List birthdays
 * - POST: Create a new birthday
 *
 * QUERY PARAMETERS (GET):
 * - upcoming: "true" to show birthdays coming up in the next 30 days
 *
 * EXAMPLE:
 * GET /api/birthdays?upcoming=true
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { birthdays, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { createBirthdaySchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/birthdays
 * ============================================================================
 * Lists birthdays with optional filtering.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const upcomingOnly = searchParams.get('upcoming') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    // Build query
    const query = db
      .select({
        id: birthdays.id,
        name: birthdays.name,
        birthDate: birthdays.birthDate,
        eventType: birthdays.eventType,
        giftIdeas: birthdays.giftIdeas,
        sendCardDaysBefore: birthdays.sendCardDaysBefore,
        createdAt: birthdays.createdAt,
        userId: users.id,
        userName: users.name,
        userColor: users.color,
      })
      .from(birthdays)
      .leftJoin(users, eq(birthdays.userId, users.id))
      .orderBy(asc(birthdays.birthDate));

    const results = await query;

    // Calculate age and days until for each birthday
    const today = new Date();
    const currentYear = today.getFullYear();

    let formattedBirthdays = results.map(birthday => {
      const birthDate = new Date(birthday.birthDate);
      const birthYear = birthDate.getFullYear();

      // Only calculate age if a real year is present (not a placeholder/sentinel)
      // Synced events without a known year use 1904; manually created ones may have real years
      const hasYear = birthYear >= 1910 && birthYear <= currentYear;
      const eventType = (birthday.eventType || 'birthday') as 'birthday' | 'anniversary' | 'milestone';

      // Calculate next occurrence
      const nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      if (nextBirthday < today) {
        nextBirthday.setFullYear(currentYear + 1);
      }

      const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // For birthdays: turning age. For anniversaries/milestones: number of years.
      let age: number | null = null;
      if (hasYear) {
        const nextYear = nextBirthday.getFullYear();
        age = nextYear - birthYear;
      }

      return {
        id: birthday.id,
        name: birthday.name,
        birthDate: birthday.birthDate,
        eventType,
        age,
        daysUntil,
        nextBirthday: nextBirthday.toISOString().split('T')[0],
        giftIdeas: birthday.giftIdeas,
        sendCardDaysBefore: birthday.sendCardDaysBefore,
        createdAt: birthday.createdAt.toISOString(),
        user: birthday.userId ? {
          id: birthday.userId,
          name: birthday.userName,
          color: birthday.userColor,
        } : null,
      };
    });

    // Filter for upcoming if requested
    if (upcomingOnly) {
      formattedBirthdays = formattedBirthdays.filter(b => b.daysUntil <= 30);
    }

    // Sort by days until birthday
    formattedBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

    // Apply limit
    if (limit && limit > 0) {
      formattedBirthdays = formattedBirthdays.slice(0, limit);
    }

    return NextResponse.json({ birthdays: formattedBirthdays });
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch birthdays' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/birthdays
 * ============================================================================
 * Creates a new birthday.
 *
 * REQUEST BODY:
 * {
 *   name: string (required, e.g., "Grandma Helen")
 *   birthDate: string (required, YYYY-MM-DD format)
 *   userId?: string (optional link to family member)
 *   giftIdeas?: string
 *   sendCardDaysBefore?: number (default: 7)
 * }
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createBirthdaySchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      birthDate,
      userId,
      giftIdeas,
      sendCardDaysBefore,
    } = validation.data;

    // Insert the birthday
    const [newBirthday] = await db
      .insert(birthdays)
      .values({
        name,
        birthDate,
        userId: userId || null,
        giftIdeas: giftIdeas || null,
        sendCardDaysBefore: sendCardDaysBefore || 7,
      })
      .returning();

    if (!newBirthday) {
      return NextResponse.json(
        { error: 'Failed to create birthday' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newBirthday.id,
      name: newBirthday.name,
      birthDate: newBirthday.birthDate,
      giftIdeas: newBirthday.giftIdeas,
      sendCardDaysBefore: newBirthday.sendCardDaysBefore,
      createdAt: newBirthday.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating birthday:', error);
    return NextResponse.json(
      { error: 'Failed to create birthday' },
      { status: 500 }
    );
  }
}
