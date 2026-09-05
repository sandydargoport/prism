import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params;

  let fontScale = 100;
  try {
    const layout = await db.query.layouts.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.slug, slug),
      columns: { fontScale: true },
    });
    fontScale = layout?.fontScale ?? 100;
  } catch {
    // DB unavailable — use default scale
  }

  // `--app-vh` is a viewport height expressed in this subtree's own units. `vh`
  // is relative to the root viewport and `zoom` does not divide it, so every
  // `min-h-screen` inside here would otherwise be one full viewport tall and
  // then magnified, running the dashboard off the bottom of the screen.
  // Children read the variable and fall back to 100vh where it is not set, so
  // unscaled displays and every other page are unaffected.
  return (
    <div
      style={
        fontScale !== 100
          ? ({ zoom: fontScale / 100, '--app-vh': `${10000 / fontScale}vh` } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
