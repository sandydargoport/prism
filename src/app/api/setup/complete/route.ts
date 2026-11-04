import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { layouts, settings, users } from '@/lib/db/schema';
import { FIRST_SCREEN_TEMPLATE, NEW_INSTALL_HIDDEN_PAGES } from '@/lib/constants/layoutTemplates';
import { SCENERY_SETTING_KEY } from '@/lib/scenery';
import {
  DEFAULT_LOOK, DEFAULT_MODE_SETTING_KEY, FIRST_LOOK_SETTING_KEY, LOOKS, firstScreenWidgets, isLookId, type LookId,
} from '@/lib/looks';
import { memberOrder } from '@/lib/db/memberOrder';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Guard: setup cannot be "finished" with no family members. A completed
    // marker with zero users bricks the install — login has nobody to select,
    // so the PIN pad never appears and there's no way back into the wizard.
    // This is the server-side backstop for the client's own check; it makes
    // the locked-out state impossible regardless of how /complete is called.
    const memberRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .orderBy(...memberOrder);
    if (memberRows.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one family member before finishing setup.' },
        { status: 400 }
      );
    }

    // Default the logged-out wall dashboard to show the primary parent's view.
    // Without this, a brand-new install has no `displayUserId`, so an
    // unauthenticated dashboard renders an EMPTY calendar even after the family
    // synced one — they set everything up and see nothing until someone PINs in
    // or digs into Settings. Pick the first parent (falling back to the first
    // member), and only when the user hasn't already chosen one, so re-running
    // setup or an explicit "None" choice is never clobbered.
    const [displaySetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'displayUserId'));
    const primary = memberRows.find((m) => m.role === 'parent') ?? memberRows[0]!;
    if (!displaySetting) {
      await db.insert(settings).values({ key: 'displayUserId', value: primary.id });
    }

    const existing = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    if (existing.length === 0) {
      // First time setup finishes: give the new install its first screen.
      // Re-running setup later (or an install from before this existed) has
      // a setupComplete row already and is left exactly as it is.
      await writeFirstScreen(primary.id);
    }
    if (existing.length > 0) {
      await db.update(settings)
        .set({ value: { completedAt: new Date().toISOString() } })
        .where(eq(settings.key, 'setupComplete'));
    } else {
      await db.insert(settings).values({
        key: 'setupComplete',
        value: { completedAt: new Date().toISOString() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/complete]', error);
    return NextResponse.json({ error: 'Failed to mark setup complete' }, { status: 500 });
  }
}

/**
 * The first screen of a brand-new install (#808): a calendar-first layout,
 * three pages hidden, and the look picked in the wizard (Photo if none): its
 * palette, card fill, scenery and default light or dark mode. Each part is
 * written only when nothing is there yet, so a layout, page choice or palette
 * chosen before setup finished is never replaced.
 */
async function writeFirstScreen(createdBy: string) {
  const look = LOOKS[await readLookId()];
  const read = async (key: string) => (await db.select().from(settings).where(eq(settings.key, key)))[0];

  const [anyLayout] = await db.select({ id: layouts.id }).from(layouts).limit(1);
  if (!anyLayout) {
    await db.insert(layouts).values({
      name: FIRST_SCREEN_TEMPLATE.name,
      slug: 'home',
      isDefault: true,
      orientation: FIRST_SCREEN_TEMPLATE.orientation,
      widgets: firstScreenWidgets(look),
      createdBy,
    });
  }
  if (!(await read('hiddenPages'))) {
    await db.insert(settings).values({ key: 'hiddenPages', value: [...NEW_INSTALL_HIDDEN_PAGES] });
  }
  // Bundled scenery behind the dashboard until the household adds photos.
  if (!(await read(SCENERY_SETTING_KEY))) {
    await db.insert(settings).values({ key: SCENERY_SETTING_KEY, value: look.scenery });
  }
  // The palette, unless one was already picked. An old row may hold only
  // `{ mode }`; that is kept beside the new palette.
  const theme = await read('theme');
  const themeValue = (theme?.value ?? null) as Record<string, unknown> | null;
  if (!theme) {
    await db.insert(settings).values({ key: 'theme', value: { paletteId: look.paletteId } });
  } else if (typeof themeValue?.paletteId !== 'string') {
    await db.update(settings).set({ value: { ...themeValue, paletteId: look.paletteId } }).where(eq(settings.key, 'theme'));
  }
  if (look.mode && !(await read(DEFAULT_MODE_SETTING_KEY))) {
    await db.insert(settings).values({ key: DEFAULT_MODE_SETTING_KEY, value: look.mode });
  }
}

async function readLookId(): Promise<LookId> {
  const [row] = await db.select().from(settings).where(eq(settings.key, FIRST_LOOK_SETTING_KEY));
  return isLookId(row?.value) ? row.value : DEFAULT_LOOK;
}
