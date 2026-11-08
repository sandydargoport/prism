/**
 * /api/pets (#996)
 * - GET:  the household's pets, in order. Shown on the wall, so display auth.
 * - POST: add a pet (a parent).
 *
 * A pet is a name, a kind and a colour: not a household member, so no
 * account, PIN or points. A chore or reminder can be for a pet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { pets } from '@/lib/db/schema';
import { asc, max } from 'drizzle-orm';
import { validateRequest } from '@/lib/validations';
import { createPetSchema } from '@/lib/validations/pets';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ pets: [] });
  try {
    const rows = await db
      .select({ id: pets.id, name: pets.name, kind: pets.kind, color: pets.color })
      .from(pets)
      .orderBy(asc(pets.sortOrder), asc(pets.createdAt));
    return NextResponse.json({ pets: rows });
  } catch (error) {
    logError('Error fetching pets:', error);
    return NextResponse.json({ error: 'Failed to fetch pets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const validation = validateRequest(createPetSchema, await request.json().catch(() => ({})));
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }
    try {
      const [last] = await db.select({ n: max(pets.sortOrder) }).from(pets);
      const [pet] = await db
        .insert(pets)
        .values({ ...validation.data, sortOrder: (last?.n ?? -1) + 1 })
        .returning({ id: pets.id, name: pets.name, kind: pets.kind, color: pets.color });
      return NextResponse.json(pet, { status: 201 });
    } catch (error) {
      logError('Error creating pet:', error);
      return NextResponse.json({ error: 'Failed to add pet' }, { status: 500 });
    }
  }, { permission: 'canManageChores', rateLimit: { feature: 'pets', limit: 30, windowSeconds: 60 } });
}
