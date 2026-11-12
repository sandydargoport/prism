import { NextResponse, NextRequest } from 'next/server';
import { asc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { busRoutes } from '@/lib/db/schema';
import { validateRequest, createBusRouteSchema } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const routes = await db.select().from(busRoutes)
      .orderBy(asc(busRoutes.sortOrder), asc(busRoutes.label));
    return NextResponse.json(routes);
  } catch (error) {
    logError('Failed to fetch bus routes:', error);
    return NextResponse.json({ error: 'Failed to fetch bus routes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const validation = validateRequest(createBusRouteSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const [route] = await db.insert(busRoutes).values({
        studentName: validation.data.studentName,
        userId: validation.data.userId,
        tripId: validation.data.tripId,
        direction: validation.data.direction,
        label: validation.data.label,
        scheduledTime: validation.data.scheduledTime,
        activeDays: validation.data.activeDays,
        checkpoints: validation.data.checkpoints,
        stopName: validation.data.stopName,
        schoolName: validation.data.schoolName,
        walkMinutes: validation.data.walkMinutes,
        enabled: validation.data.enabled,
        sortOrder: validation.data.sortOrder,
      }).returning();

      await invalidateEntity('bus');
      return NextResponse.json(route, { status: 201 });
    } catch (error) {
      logError('Failed to create bus route:', error);
      return NextResponse.json({ error: 'Failed to create bus route' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
