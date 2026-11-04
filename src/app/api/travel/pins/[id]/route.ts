/**
 * ENDPOINT: /api/travel/pins/[id]
 * - PATCH:  Update a travel pin
 * - DELETE: Delete a travel pin
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelPins, users } from '@/lib/db/schema';
import { eq, getTableColumns } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { z } from 'zod';

// Shared formatter — keeps PATCH response shape identical to GET
function formatPin(row: typeof travelPins.$inferSelect & {
  createdByName: string | null;
  createdByColor: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: parseFloat(row.latitude as unknown as string),
    longitude: parseFloat(row.longitude as unknown as string),
    placeName: row.placeName,
    status: row.status,
    isBucketList: row.isBucketList,
    tripLabel: row.tripLabel,
    color: row.color,
    visitedDate: row.visitedDate,
    visitedEndDate: row.visitedEndDate,
    year: row.year,
    tags: (row.tags as string[]) || [],
    stops: (row.stops as string[]) || [],
    nationalParks: (row.nationalParks as string[]) || [],
    parentId: row.parentId,
    tripId: row.tripId,
    isHub: row.isHub,
    pinType: row.pinType,
    photoRadiusKm: row.photoRadiusKm ? parseFloat(row.photoRadiusKm as unknown as string) : 50,
    createdBy: row.createdBy ? { id: row.createdBy, name: row.createdByName, color: row.createdByColor } : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const updatePinSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeName: z.string().max(255).nullable().optional(),
  status: z.enum(['want_to_go', 'been_there']).optional(),
  isBucketList: z.boolean().optional(),
  tripLabel: z.string().max(255).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  visitedDate: z.string().nullable().optional(),
  visitedEndDate: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  tags: z.array(z.string()).max(100).optional(),
  stops: z.array(z.string()).max(500).optional(),
  nationalParks: z.array(z.string()).max(500).optional(),
  pinType: z.enum(['location', 'stop', 'national_park']).optional(),
  photoRadiusKm: z.number().min(0).max(500).optional(),
  tripId: z.guid().nullable().optional(),
  isHub: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updatePinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const updates: Partial<typeof travelPins.$inferInsert> = {};

    if (d.name !== undefined) updates.name = d.name;
    if (d.description !== undefined) updates.description = d.description;
    if (d.latitude !== undefined) updates.latitude = d.latitude.toString();
    if (d.longitude !== undefined) updates.longitude = d.longitude.toString();
    if (d.placeName !== undefined) updates.placeName = d.placeName;
    if (d.status !== undefined) updates.status = d.status;
    if (d.isBucketList !== undefined) updates.isBucketList = d.isBucketList;
    if (d.tripLabel !== undefined) updates.tripLabel = d.tripLabel;
    if (d.color !== undefined) updates.color = d.color;
    if (d.visitedDate !== undefined) updates.visitedDate = d.visitedDate;
    if (d.visitedEndDate !== undefined) updates.visitedEndDate = d.visitedEndDate;
    if (d.year !== undefined) updates.year = d.year;
    if (d.tags !== undefined) updates.tags = d.tags;
    if (d.stops !== undefined) updates.stops = d.stops;
    if (d.nationalParks !== undefined) updates.nationalParks = d.nationalParks;
    if (d.pinType !== undefined) updates.pinType = d.pinType;
    if (d.photoRadiusKm !== undefined) updates.photoRadiusKm = d.photoRadiusKm.toString();
    if (d.tripId !== undefined) updates.tripId = d.tripId;
    if (d.isHub !== undefined) updates.isHub = d.isHub;
    if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(travelPins)
      .set(updates)
      .where(eq(travelPins.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await invalidateEntity('travel');

    // Re-query with user join so the response shape matches GET (lat/lng as numbers, createdBy as object)
    const [withUser] = await db
      .select({ ...getTableColumns(travelPins), createdByName: users.name, createdByColor: users.color })
      .from(travelPins)
      .leftJoin(users, eq(travelPins.createdBy, users.id))
      .where(eq(travelPins.id, id));

    return NextResponse.json(withUser ? formatPin(withUser) : formatPin({ ...updated, createdByName: null, createdByColor: null }));
  } catch (error) {
    logError('Error updating travel pin:', error);
    return NextResponse.json({ error: 'Failed to update travel pin' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const [deleted] = await db
      .delete(travelPins)
      .where(eq(travelPins.id, id))
      .returning();

    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'travel_pin',
      entityId: id,
      summary: `Deleted travel pin: ${deleted.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting travel pin:', error);
    return NextResponse.json({ error: 'Failed to delete travel pin' }, { status: 500 });
  }
}
