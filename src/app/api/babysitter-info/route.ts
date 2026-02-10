import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { babysitterInfo } from '@/lib/db/schema';
import { asc, max } from 'drizzle-orm';
import { getCached, invalidateCache } from '@/lib/cache/redis';
import { rateLimitGuard } from '@/lib/cache/rateLimit';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeSensitive = searchParams.get('includeSensitive') === 'true';

  try {
    const items = await getCached(
      `babysitter-info:${includeSensitive ? 'all' : 'public'}`,
      async () => {
        const rows = await db
          .select()
          .from(babysitterInfo)
          .orderBy(asc(babysitterInfo.section), asc(babysitterInfo.sortOrder));

        return rows.map((row) => ({
          id: row.id,
          section: row.section,
          sortOrder: row.sortOrder,
          content: includeSensitive || !row.isSensitive ? row.content : null,
          isSensitive: row.isSensitive,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      },
      300
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching babysitter info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch babysitter info' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const rateLimited = await rateLimitGuard(auth.userId, 'babysitter-info:create', 30, 60);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();

    if (!body.section || !body.content) {
      return NextResponse.json(
        { error: 'section and content are required' },
        { status: 400 }
      );
    }

    const validSections = ['emergency_contact', 'house_info', 'child_info', 'house_rule'];
    if (!validSections.includes(body.section)) {
      return NextResponse.json(
        { error: `Invalid section. Must be one of: ${validSections.join(', ')}` },
        { status: 400 }
      );
    }

    // Get next sort order for this section
    const [maxRow] = await db
      .select({ maxOrder: max(babysitterInfo.sortOrder) })
      .from(babysitterInfo);
    const sortOrder = body.sortOrder ?? (Number(maxRow?.maxOrder) || 0) + 1;

    const [item] = await db
      .insert(babysitterInfo)
      .values({
        section: body.section,
        sortOrder,
        content: body.content,
        isSensitive: body.isSensitive || false,
      })
      .returning();

    await invalidateCache('babysitter-info:*');

    return NextResponse.json(
      {
        item: {
          id: item!.id,
          section: item!.section,
          sortOrder: item!.sortOrder,
          content: item!.content,
          isSensitive: item!.isSensitive,
          createdAt: item!.createdAt.toISOString(),
          updatedAt: item!.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating babysitter info:', error);
    return NextResponse.json(
      { error: 'Failed to create babysitter info' },
      { status: 500 }
    );
  }
}
