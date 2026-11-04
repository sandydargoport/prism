import { NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { weekendPlaces, users } from '@/lib/db/schema';
import { eq, getTableColumns } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  placeName: z.string().max(255).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  url: z.string().max(1000).regex(/^https?:\/\//i, 'URL must start with http:// or https://').nullable().optional(),
  status: z.enum(['backlog', 'visited']).optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).max(100).optional(),
  lastVisitedDate: z.string().nullable().optional(),
  visitCount: z.number().int().min(0).optional(),
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const [row] = await db
      .select({ ...getTableColumns(weekendPlaces), createdByName: users.name, createdByColor: users.color })
      .from(weekendPlaces)
      .leftJoin(users, eq(weekendPlaces.createdBy, users.id))
      .where(eq(weekendPlaces.id, id))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(formatPlace(row));
  } catch (err) {
    logError('GET /api/weekend/places/[id]', err);
    return NextResponse.json({ error: 'Failed to load place' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.latitude !== undefined) updates.latitude = body.latitude != null ? String(body.latitude) : null;
    if (body.longitude !== undefined) updates.longitude = body.longitude != null ? String(body.longitude) : null;
    if (body.placeName !== undefined) updates.placeName = body.placeName;
    if (body.address !== undefined) updates.address = body.address;
    if (body.url !== undefined) updates.url = body.url;
    if (body.status !== undefined) updates.status = body.status;
    if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.lastVisitedDate !== undefined) updates.lastVisitedDate = body.lastVisitedDate;
    if (body.visitCount !== undefined) updates.visitCount = body.visitCount;

    const [updated] = await db
      .update(weekendPlaces)
      .set(updates)
      .where(eq(weekendPlaces.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await invalidateEntity('weekend');

    const [withUser] = await db
      .select({ ...getTableColumns(weekendPlaces), createdByName: users.name, createdByColor: users.color })
      .from(weekendPlaces)
      .leftJoin(users, eq(weekendPlaces.createdBy, users.id))
      .where(eq(weekendPlaces.id, id))
      .limit(1);

    return NextResponse.json(
      formatPlace(withUser ?? { ...updated, createdByName: null, createdByColor: null })
    );
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    logError('PATCH /api/weekend/places/[id]', err);
    return NextResponse.json({ error: 'Failed to update place' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const [deleted] = await db.delete(weekendPlaces).where(eq(weekendPlaces.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await invalidateEntity('weekend');
    return NextResponse.json({ success: true });
  } catch (err) {
    logError('DELETE /api/weekend/places/[id]', err);
    return NextResponse.json({ error: 'Failed to delete place' }, { status: 500 });
  }
}
