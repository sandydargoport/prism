/**
 * Top-of-page banner shown only when NEXT_PUBLIC_DEMO_MODE === 'true'.
 *
 * Two purposes:
 *   1. Tell visitors they're on the demo, not a live install.
 *   2. Set expectations about read-only and the daily reset.
 *
 * Renders as a thin band above all page content. The dashboard wraps
 * the rest of the page in CSS that respects this band, so it doesn't
 * overlap interactive UI.
 */

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function DemoBanner() {
  if (!isDemoMode) return null;

  return (
    <div
      role="banner"
      aria-label="Demo mode notice"
      className="sticky top-0 z-[10000] flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground"
    >
      <span aria-hidden="true">★</span>
      <span>
        Prism Demo &middot; Read-only &middot; Resets daily at midnight UTC
      </span>
      <a
        href="https://github.com/sandydargoport/prism"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:no-underline"
      >
        Self-host the real thing
      </a>
    </div>
  );
}
