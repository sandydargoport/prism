import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelTrips, travelPins, users } from '@/lib/db/schema';
import { eq, desc, asc, getTableColumns } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { yearOfDate } from '@/lib/utils/zonedDate';
import { z } from 'zod';

const createTripSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  tripStyle: z.enum(['route', 'loop', 'hub']),
  status: z.enum(['want_to_go', 'been_there']).default('want_to_go'),
  isBucketList: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  visitedDate: z.string().nullable().optional(),
  visitedEndDate: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

function formatTrip(row: typeof travelTrips.$inferSelect & {
  createdByName: string | null;
  createdByColor: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tripStyle: row.tripStyle,
    status: row.status,
    isBucketList: row.isBucketList,
    color: row.color,
    emoji: row.emoji,
    visitedDate: row.visitedDate,
    visitedEndDate: row.visitedEndDate,
    year: row.year,
    memberIds: (row.memberIds as string[]) || [],
    tags: (row.tags as string[]) || [],
    sortOrder: row.sortOrder,
    createdBy: row.createdBy ? { id: row.createdBy, name: row.createdByName, color: row.createdByColor } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ trips: [] });

  try {
    const data = await getCached('travel:trips', async () => {
      const rows = await db
        .select({ ...getTableColumns(travelTrips), createdByName: users.name, createdByColor: users.color })
        .from(travelTrips)
        .leftJoin(users, eq(travelTrips.createdBy, users.id))
        .orderBy(asc(travelTrips.sortOrder), desc(travelTrips.createdAt));
      return { trips: rows.map(formatTrip) };
    }, 300);
    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching travel trips:', error);
    return NextResponse.json({ error: 'Failed to fetch travel trips' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const d = parsed.data;
    const year = d.year ?? yearOfDate(d.visitedDate);

    const [newTrip] = await db.insert(travelTrips).values({
      name: d.name,
      description: d.description || null,
      tripStyle: d.tripStyle,
      status: d.status,
      isBucketList: d.isBucketList,
      color: d.color || null,
      emoji: d.emoji || null,
      visitedDate: d.visitedDate || null,
      visitedEndDate: d.visitedEndDate || null,
      year,
      memberIds: d.memberIds || [],
      tags: d.tags || [],
      sortOrder: d.sortOrder ?? 0,
      createdBy: auth.userId,
    }).returning();

    if (!newTrip) return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });

    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'travel_trip',
      entityId: newTrip.id,
      summary: `Added travel trip: ${d.name}`,
    });

    const [withUser] = await db
      .select({ ...getTableColumns(travelTrips), createdByName: users.name, createdByColor: users.color })
      .from(travelTrips)
      .leftJoin(users, eq(travelTrips.createdBy, users.id))
      .where(eq(travelTrips.id, newTrip.id));

    return NextResponse.json(
      withUser ? formatTrip(withUser) : formatTrip({ ...newTrip, createdByName: null, createdByColor: null }),
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating travel trip:', error);
    return NextResponse.json({ error: 'Failed to create travel trip' }, { status: 500 });
  }
}
