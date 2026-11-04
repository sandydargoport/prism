import { NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { weekendPlaces, users } from '@/lib/db/schema';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  placeName: z.string().max(255).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  url: z.string().max(1000).regex(/^https?:\/\//i, 'URL must start with http:// or https://').nullable().optional(),
  status: z.enum(['backlog', 'visited']).default('backlog'),
  isFavorite: z.boolean().default(false),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).max(100).default([]),
  sourceProvider: z.enum(['mapbox', 'nominatim', 'manual']).nullable().optional(),
  sourceId: z.string().max(100).nullable().optional(),
});

function formatPlace(row: typeof weekendPlaces.$inferSelect & {
  createdByName: string | null;
  createdByColor: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude ? parseFloat(row.latitude as unknown as string) : null,
    longitude: row.longitude ? parseFloat(row.longitude as unknown as string) : null,
    placeName: row.placeName,
    address: row.address,
    url: row.url,
    status: row.status,
    isFavorite: row.isFavorite,
    rating: row.rating,
    notes: row.notes,
    tags: (row.tags as string[]) || [],
    sourceProvider: row.sourceProvider,
    sourceId: row.sourceId,
    lastVisitedDate: row.lastVisitedDate,
    visitCount: row.visitCount,
    createdBy: row.createdBy ? { id: row.createdBy, name: row.createdByName, color: row.createdByColor } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ places: [] });

  try {
    const data = await getCached('weekend:places', async () => {
      const rows = await db
        .select({ ...getTableColumns(weekendPlaces), createdByName: users.name, createdByColor: users.color })
        .from(weekendPlaces)
        .leftJoin(users, eq(weekendPlaces.createdBy, users.id))
        .orderBy(desc(weekendPlaces.updatedAt));
      return rows.map(formatPlace);
    }, 300);
    return NextResponse.json({ places: data });
  } catch (err) {
    logError('GET /api/weekend/places', err);
    return NextResponse.json({ error: 'Failed to load places' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = createSchema.parse(await req.json());
    const [place] = await db.insert(weekendPlaces).values({
      name: body.name,
      description: body.description ?? null,
      latitude: body.latitude != null ? String(body.latitude) : null,
      longitude: body.longitude != null ? String(body.longitude) : null,
      placeName: body.placeName ?? null,
      address: body.address ?? null,
      url: body.url ?? null,
      status: body.status,
      isFavorite: body.isFavorite,
      rating: body.rating ?? null,
      notes: body.notes ?? null,
      tags: body.tags,
      sourceProvider: body.sourceProvider ?? null,
      sourceId: body.sourceId ?? null,
      createdBy: auth.userId,
    }).returning();

    await invalidateEntity('weekend');

    const [withUser] = await db
      .select({ ...getTableColumns(weekendPlaces), createdByName: users.name, createdByColor: users.color })
      .from(weekendPlaces)
      .leftJoin(users, eq(weekendPlaces.createdBy, users.id))
      .where(eq(weekendPlaces.id, place!.id))
      .limit(1);

    return NextResponse.json(
      formatPlace(withUser ?? { ...place!, createdByName: null, createdByColor: null }),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    logError('POST /api/weekend/places', err);
    return NextResponse.json({ error: 'Failed to create place' }, { status: 500 });
  }
}
