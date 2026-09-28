/**
 * ENDPOINT: /api/travel/pins
 * - GET:  List all travel pins (roots and children)
 * - POST: Create a new travel pin
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelPins, users } from '@/lib/db/schema';
import { eq, desc, asc, getTableColumns } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { yearOfDate } from '@/lib/utils/zonedDate';
import { z } from 'zod';

const createPinSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeName: z.string().max(255).nullable().optional(),
  status: z.enum(['want_to_go', 'been_there']).default('want_to_go'),
  isBucketList: z.boolean().default(false),
  tripLabel: z.string().max(255).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  visitedDate: z.string().nullable().optional(),
  visitedEndDate: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  tags: z.array(z.string()).optional(),
  stops: z.array(z.string()).optional(),
  nationalParks: z.array(z.string()).optional(),
  parentId: z.string().uuid().nullable().optional(),
  tripId: z.string().uuid().nullable().optional(),
  isHub: z.boolean().default(false),
  pinType: z.enum(['location', 'stop', 'national_park']).default('location'),
  photoRadiusKm: z.number().min(0).max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

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

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ pins: [] });

  try {
    const data = await getCached('travel:pins', async () => {
      const rows = await db
        .select({
          ...getTableColumns(travelPins),
          createdByName: users.name,
          createdByColor: users.color,
        })
        .from(travelPins)
        .leftJoin(users, eq(travelPins.createdBy, users.id))
        .orderBy(asc(travelPins.sortOrder), desc(travelPins.createdAt));

      return { pins: rows.map(formatPin) };
    }, 300);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching travel pins:', error);
    return NextResponse.json({ error: 'Failed to fetch travel pins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createPinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const year = d.year ?? yearOfDate(d.visitedDate);

    const rows = await db
      .insert(travelPins)
      .values({
        name: d.name,
        description: d.description || null,
        latitude: d.latitude.toString(),
        longitude: d.longitude.toString(),
        placeName: d.placeName || null,
        status: d.status,
        isBucketList: d.isBucketList,
        tripLabel: d.tripLabel || null,
        color: d.color || null,
        visitedDate: d.visitedDate || null,
        visitedEndDate: d.visitedEndDate || null,
        year,
        tags: d.tags || [],
        stops: d.stops || [],
        nationalParks: d.nationalParks || [],
        parentId: d.parentId || null,
        tripId: d.tripId || null,
        isHub: d.isHub ?? false,
        pinType: d.pinType,
        photoRadiusKm: d.photoRadiusKm?.toString() || '50',
        sortOrder: d.sortOrder ?? 0,
        createdBy: auth.userId,
      })
      .returning();

    const newPin = rows[0];
    if (!newPin) return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 });

    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'travel_pin',
      entityId: newPin.id,
      summary: `Added travel pin: ${d.name}`,
    });

    // Re-query with user join so createdBy is a proper { id, name, color } object
    const [withUser] = await db
      .select({ ...getTableColumns(travelPins), createdByName: users.name, createdByColor: users.color })
      .from(travelPins)
      .leftJoin(users, eq(travelPins.createdBy, users.id))
      .where(eq(travelPins.id, newPin.id));

    return NextResponse.json(
      withUser ? formatPin(withUser) : formatPin({ ...newPin, createdByName: null, createdByColor: null }),
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating travel pin:', error);
    return NextResponse.json({ error: 'Failed to create travel pin' }, { status: 500 });
  }
}
