import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';
import { db } from '@/lib/db/client';
import { currentDisplay } from '@/lib/auth/displayIdentity';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { timelineDashboardAt } from '@/lib/timeline';
import { timelineOf } from '@/lib/services/timelines';
import { pageZoomVars } from '@/lib/utils/zoomVars';

/**
 * The dashboard the home page opens on (#1266): what this screen's timeline
 * shows right now, or the first timeline's on a device nobody named. Its slug,
 * or null when that is the default.
 */
async function timelineDashboardSlug(): Promise<{ named: boolean; slug: string | null }> {
  let named = false;
  try {
    const screen = await currentDisplay();
    named = screen !== null;
    const timeline = await timelineOf(screen);
    if (!timeline) return { named, slug: null };
    const all = await db.query.layouts.findMany({ columns: { id: true, slug: true, isDefault: true } });
    const id = timelineDashboardAt(
      timeline, Date.now(), await getHouseholdTimezone(),
      (d) => all.some((l) => l.id === d),
    );
    const layout = all.find((l) => l.id === id);
    return { named, slug: layout && !layout.isDefault ? layout.slug : null };
  } catch {
    return { named, slug: null };
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
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // A phone editing another screen opens that screen's dashboard here with
  // ?screen= (#1153); it chose the dashboard already, so this browser's own
  // screen must not redirect it.
  const { screen, edit } = await searchParams;
  // Opened to edit a dashboard, the page shows that one.
  const now = screen || edit ? { named: false, slug: null } : await timelineDashboardSlug();
  // A named screen follows its timeline at any address, so it can go to the
  // dashboard's own. A device nobody named follows it only here, so it stays
  // at this address and opens on that dashboard in place.
  if (now.named && now.slug) redirect(`/d/${now.slug}`);
  const startSlug = now.named ? undefined : now.slug ?? undefined;

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
    <main className="min-h-fill bg-background">
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
            ? ({ zoom: fontScale / 100, '--app-vh': `${10000 / fontScale}vh`, ...pageZoomVars(fontScale) } as React.CSSProperties)
            : undefined
        }
      >
        <DashboardClient startSlug={startSlug} />
      </div>
    </main>
  );
}
