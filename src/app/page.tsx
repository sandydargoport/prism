import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';
import { db } from '@/lib/db/client';
import { currentDisplay } from '@/lib/auth/displayIdentity';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { screenDashboardAt } from '@/lib/displays/screenSchedule';

/**
 * A named screen with its own dashboard set (#690) opens on that one instead
 * of the household default, or on the one its schedule shows right now
 * (#692). Null when it has none, or it no longer exists.
 */
async function screenDashboardSlug(): Promise<string | null> {
  try {
    const screen = await currentDisplay();
    if (!screen) return null;
    const all = await db.query.layouts.findMany({ columns: { id: true, slug: true, isDefault: true } });
    const id = screenDashboardAt(screen, Date.now(), await getHouseholdTimezone(), (d) => all.some((l) => l.id === d));
    const layout = all.find((l) => l.id === id);
    return layout && !layout.isDefault ? layout.slug : null;
  } catch {
    return null;
  }
}

export const metadata = {
  title: 'Dashboard',
  description: 'Your family dashboard - view calendars, tasks, weather, and more.',
};
// Render per request: nothing else here marks the page dynamic, so it was
// prerendered at build time (no database, fontScale 100) and never updated.
export const dynamic = 'force-dynamic';

// Named dashboards at /d/[slug] wrap their content in a zoom container driven
// by `layouts.fontScale`. The default dashboard at `/` was missing the same
// wrapper, so the Display Settings slider had no effect on the main
// dashboard — fix is to fetch the default layout's fontScale here and apply
// the same zoom wrapper.
export default async function HomePage() {
  const slug = await screenDashboardSlug();
  if (slug) redirect(`/d/${slug}`);

  let fontScale = 100;
  try {
    const layout = await db.query.layouts.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.isDefault, true),
      columns: { fontScale: true },
    });
    fontScale = layout?.fontScale ?? 100;
  } catch {
    // DB unavailable — keep default scale.
  }

  return (
    <main className="min-h-screen bg-background">
      <div id="ssr-placeholder" className="h-screen flex items-center justify-center" aria-hidden="true">
        <h1 className="text-4xl font-bold text-muted-foreground/20">Prism</h1>
      </div>
      {/* `--app-vh` is a viewport height expressed in this subtree's own units.
          `vh` is relative to the root viewport and `zoom` does not divide it, so
          every `min-h-screen` inside here would otherwise be one full viewport
          TALL AND THEN MAGNIFIED, running the dashboard off the bottom of the
          screen. Children read the variable and fall back to 100vh where it is
          not set, so unscaled displays and every other page are unaffected. */}
      <div
        style={
          fontScale !== 100
            ? ({ zoom: fontScale / 100, '--app-vh': `${10000 / fontScale}vh` } as React.CSSProperties)
            : undefined
        }
      >
        <DashboardClient />
      </div>
    </main>
  );
}
