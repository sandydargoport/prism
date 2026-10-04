/**
 * Demo data left by the database init seed (#605).
 *
 *   GET    → { present, members, counts }: whether seeded rows are still in
 *            the database, and what a purge would delete.
 *   DELETE → purge every seeded row, members included. Returns { deleted }.
 *
 * Parents only. See src/lib/services/demoData.ts for how seeded rows are told
 * apart from rows created through the app.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { findDemoData, purgeDemoData } from '@/lib/services/demoData';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  return withAuth(async () => {
    try {
      return NextResponse.json(await findDemoData());
    } catch (error) {
      logError('Error checking for demo data:', error);
      return NextResponse.json({ error: 'Failed to check for demo data' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}

export async function DELETE() {
  return withAuth(async () => {
    try {
      return NextResponse.json({ deleted: await purgeDemoData() });
    } catch (error) {
      logError('Error purging demo data:', error);
      return NextResponse.json({ error: 'Failed to purge demo data' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
