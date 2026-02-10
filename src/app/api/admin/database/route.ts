import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { truncateAllData, seedDatabase } from '@/lib/utils/backup';
import { invalidateCache } from '@/lib/cache/redis';

/**
 * POST /api/admin/database - Database operations
 * Body: { action: 'truncate' | 'seed' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const body = await request.json();
    const { action } = body;

    if (action === 'truncate') {
      const result = await truncateAllData();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to clear database' },
          { status: 500 }
        );
      }

      // Invalidate all caches
      await invalidateCache('*');

      return NextResponse.json({
        success: true,
        message: 'All data has been cleared from the database',
      });
    }

    if (action === 'seed') {
      const result = await seedDatabase();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to seed database' },
          { status: 500 }
        );
      }

      // Invalidate all caches
      await invalidateCache('*');

      return NextResponse.json({
        success: true,
        message: 'Database has been seeded with demo data',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "truncate" or "seed".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in database operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform database operation' },
      { status: 500 }
    );
  }
}
