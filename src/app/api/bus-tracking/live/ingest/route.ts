import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { validateRequest } from '@/lib/validations';
import { liveVehiclePayloadSchema } from '@/lib/validations/liveVehicle';
import { ingestLivePayload } from '@/lib/services/bus-live-ingest';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/bus-tracking/live/ingest
 *
 * Where a live position provider pushes tracks, fixes and stop events (the
 * contract is src/lib/validations/liveVehicle.ts). Machine-to-machine only:
 * an API token with the `bus:ingest` scope, never a browser session.
 */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = validateRequest(liveVehiclePayloadSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.issues },
        { status: 400 },
      );
    }

    try {
      const result = await ingestLivePayload(validation.data);
      return NextResponse.json(result);
    } catch (error) {
      logError('Live bus ingest failed:', error);
      return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
    }
  }, {
    tokenScope: 'bus:ingest',
    rateLimit: { feature: 'bus-live-ingest', limit: 600, windowSeconds: 60 },
  });
}
