/**
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { birthdays, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { createBirthdaySchema, validateRequest } from '@/lib/validations';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { birthdayOccurrence } from '@/lib/utils/birthdayOccurrence';

/**
 * GET /api/birthdays
 * Lists birthdays with optional filtering.
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ birthdays: [] });
  }

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

    // "Today" is the household's calendar date, not the server's.
    const today = todayKey(await getHouseholdTimezone());

    let formattedBirthdays = results.flatMap(birthday => {
      const occurrence = birthdayOccurrence(birthday.birthDate, today);
      if (!occurrence) return [];
      const eventType = (birthday.eventType || 'birthday') as 'birthday' | 'anniversary' | 'milestone';

      return [{
        id: birthday.id,
        name: birthday.name,
        birthDate: birthday.birthDate,
        eventType,
        ...occurrence,
        giftIdeas: birthday.giftIdeas,
        sendCardDaysBefore: birthday.sendCardDaysBefore,
        createdAt: birthday.createdAt.toISOString(),
        user: birthday.userId ? {
          id: birthday.userId,
          name: birthday.userName,
          color: birthday.userColor,
        } : null,
      }];
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
    logError('Error fetching birthdays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch birthdays' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/birthdays
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
 */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
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
      logError('Error creating birthday:', error);
      return NextResponse.json(
        { error: 'Failed to create birthday' },
        { status: 500 }
      );
    }
  });
}
