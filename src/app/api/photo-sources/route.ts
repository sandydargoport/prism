import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const sources = await db
      .select({
        id: photoSources.id,
        type: photoSources.type,
        name: photoSources.name,
        onedriveFolderId: photoSources.onedriveFolderId,
        enabled: photoSources.enabled,
        lastSynced: photoSources.lastSynced,
        syncErrors: photoSources.syncErrors,
        createdAt: photoSources.createdAt,
        photoCount: sql<number>`(SELECT count(*)::int FROM photos WHERE photos.source_id = photo_sources.id)`,
      })
      .from(photoSources)
      .orderBy(photoSources.createdAt);

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching photo sources:', error);
    return NextResponse.json({ error: 'Failed to fetch photo sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { type, name, onedriveFolderId } = body;

    if (!type || !name) {
      return NextResponse.json({ error: 'type and name are required' }, { status: 400 });
    }

    const [source] = await db
      .insert(photoSources)
      .values({
        type,
        name,
        onedriveFolderId: onedriveFolderId || null,
      })
      .returning();

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('Error creating photo source:', error);
    return NextResponse.json({ error: 'Failed to create photo source' }, { status: 500 });
  }
}
