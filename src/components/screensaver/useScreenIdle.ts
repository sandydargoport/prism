'use client';

import { useDisplayIdle } from '@/lib/hooks/useDisplayIdle';
import { useCalmIdle } from './calmMode';

/**
 * Whether the screen is idle right now (#1342): nobody has touched it for the
 * idle timeout, and it shows its idle screen (the photo frame, the sky, black,
 * or its own dashboard, calm). False while it is in use, and while it is being
 * edited, since then it never goes idle (useEditing).
 *
 * The Screensaver owns idleness and publishes it as two facts (an overlay is
 * up, or a calm dashboard is idle); this is the one answer to "has the screen
 * gone idle" for whatever acts on it: a dashboard picked by hand gives way to
 * the screen's own when it does (useScreenSchedule).
 */
export function useScreenIdle(): boolean {
  // Both read on every render: hooks are never skipped.
  const covered = useDisplayIdle();
  const calm = useCalmIdle();
  return covered || calm;
}
