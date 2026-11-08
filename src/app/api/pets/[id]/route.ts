/**
 * /api/pets/[id] (#996)
 * - PATCH:  rename a pet, or change its kind or colour (a parent).
 * - DELETE: remove a pet (a parent). Its chores stay, no longer for anyone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { pets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateRequest } from '@/lib/validations';
import { updatePetSchema } from '@/lib/validations/pets';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const validation = validateRequest(updatePetSchema, await request.json().catch(() => ({})));
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }
    try {
      const [pet] = await db
        .update(pets)
        .set(validation.data)
        .where(eq(pets.id, id))
        .returning({ id: pets.id, name: pets.name, kind: pets.kind, color: pets.color });
      if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      // Chores show their pet's name and colour.
      await invalidateEntity('chores');
      return NextResponse.json(pet);
    } catch (error) {
      logError('Error updating pet:', error);
      return NextResponse.json({ error: 'Failed to update pet' }, { status: 500 });
    }
  }, { permission: 'canManageChores' });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    try {
      // The foreign key clears pet_id on this pet's chores; the chores stay.
      const [gone] = await db.delete(pets).where(eq(pets.id, id)).returning({ id: pets.id });
      if (!gone) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      await invalidateEntity('chores');
      return NextResponse.json({ ok: true });
    } catch (error) {
      logError('Error removing pet:', error);
      return NextResponse.json({ error: 'Failed to remove pet' }, { status: 500 });
    }
  }, { permission: 'canManageChores' });
}
