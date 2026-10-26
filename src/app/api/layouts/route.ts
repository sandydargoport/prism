import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { createLayoutSchema, validateRequest } from '@/lib/validations';
import { logError } from '@/lib/utils/logError';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

async function uniqueSlug(baseName: string, excludeId?: string): Promise<string> {
  const base = slugify(baseName);
  if (!base) return 'dashboard';
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.slug, slug));
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ layouts: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get('slug');

    let results;
    if (slugParam) {
      results = await db
        .select()
        .from(layouts)
        .where(eq(layouts.slug, slugParam));
    } else {
      results = await db
        .select()
        .from(layouts)
        .orderBy(desc(layouts.createdAt));
    }

    // Auto-migrate: generate slugs for any layouts that don't have one
    const needsSlugs = results.filter(l => !l.slug);
    if (needsSlugs.length > 0) {
      for (const layout of needsSlugs) {
        const slug = await uniqueSlug(layout.name, layout.id);
        await db.update(layouts).set({ slug, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
        (layout as Record<string, unknown>).slug = slug;
      }
    }

    // If slug query returned empty, also check for unmigrated layouts
    if (slugParam && results.length === 0) {
      const allLayouts = await db.select().from(layouts).where(isNull(layouts.slug));
      for (const layout of allLayouts) {
        const slug = await uniqueSlug(layout.name, layout.id);
        await db.update(layouts).set({ slug, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
        if (slug === slugParam) {
          (layout as Record<string, unknown>).slug = slug;
          results = [layout];
        }
      }
    }

    return NextResponse.json({ layouts: results });
  } catch (error) {
    logError('Error fetching layouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layouts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const validation = validateRequest(createLayoutSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, slug: requestedSlug, isDefault, widgets, screensaverWidgets, screensaverMode, orientation, createdBy } = validation.data;

    const newLayout = await db.transaction(async (tx) => {
      if (isDefault) {
        await tx
          .update(layouts)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(layouts.isDefault, true));
      }

      // Generate unique slug
      const slug = requestedSlug || await uniqueSlug(name);

      const [layout] = await tx
        .insert(layouts)
        .values({
          name,
          slug,
          isDefault: isDefault || false,
          widgets,
          screensaverWidgets: screensaverWidgets || null,
          ...(screensaverMode ? { screensaverMode } : {}),
          orientation: orientation || 'landscape',
          createdBy: createdBy || null,
        })
        .returning();

      if (!layout) throw new Error('Failed to create layout');
      return layout;
    });

    return NextResponse.json(newLayout, { status: 201 });
  } catch (error) {
    logError('Error creating layout:', error);
    return NextResponse.json(
      { error: 'Failed to create layout' },
      { status: 500 }
    );
  }
}
