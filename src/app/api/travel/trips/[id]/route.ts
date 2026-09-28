import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelTrips, travelPins, users } from '@/lib/db/schema';
import { eq, getTableColumns } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { yearOfDate } from '@/lib/utils/zonedDate';
import { z } from 'zod';

const patchTripSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  tripStyle: z.enum(['route', 'loop', 'hub']).optional(),
  status: z.enum(['want_to_go', 'been_there']).optional(),
  isBucketList: z.boolean().optional(),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const [row] = await db
      .select({ ...getTableColumns(travelTrips), createdByName: users.name, createdByColor: users.color })
      .from(travelTrips)
      .leftJoin(users, eq(travelTrips.createdBy, users.id))
      .where(eq(travelTrips.id, id));

    if (!row) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const stops = await db.select().from(travelPins).where(eq(travelPins.tripId, id))
      .orderBy(travelPins.sortOrder);

    return NextResponse.json({ ...formatTrip(row), stops });
  } catch (error) {
    logError('Error fetching travel trip:', error);
    return NextResponse.json({ error: 'Failed to fetch travel trip' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const d = parsed.data;
    const year = d.year !== undefined ? d.year
      : d.visitedDate ? yearOfDate(d.visitedDate)
      : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) updates.name = d.name;
    if (d.description !== undefined) updates.description = d.description;
    if (d.tripStyle !== undefined) updates.tripStyle = d.tripStyle;
    if (d.status !== undefined) updates.status = d.status;
    if (d.isBucketList !== undefined) updates.isBucketList = d.isBucketList;
    if (d.color !== undefined) updates.color = d.color;
    if (d.emoji !== undefined) updates.emoji = d.emoji;
    if (d.visitedDate !== undefined) updates.visitedDate = d.visitedDate;
    if (d.visitedEndDate !== undefined) updates.visitedEndDate = d.visitedEndDate;
    if (year !== undefined) updates.year = year;
    if (d.memberIds !== undefined) updates.memberIds = d.memberIds;
    if (d.tags !== undefined) updates.tags = d.tags;
    if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;

    const [updated] = await db.update(travelTrips).set(updates).where(eq(travelTrips.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    await invalidateEntity('travel');
    return NextResponse.json(formatTrip({ ...updated, createdByName: null, createdByColor: null }));
  } catch (error) {
    logError('Error updating travel trip:', error);
    return NextResponse.json({ error: 'Failed to update travel trip' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await db.delete(travelTrips).where(eq(travelTrips.id, id));
    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'travel_trip',
      entityId: id,
      summary: 'Deleted travel trip',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError('Error deleting travel trip:', error);
    return NextResponse.json({ error: 'Failed to delete travel trip' }, { status: 500 });
  }
}
