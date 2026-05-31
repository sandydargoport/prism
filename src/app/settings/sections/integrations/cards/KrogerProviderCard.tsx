'use client';

import { KrogerConnectionCard } from '../../KrogerConnectionCard';

/**
 * Phase 1 dual-mount: Kroger's self-contained card has its own status fetch,
 * OAuth start, credential form, and location picker. Wrapping all of that
 * in ProviderCardShell now would mean a substantial refactor with no
 * IA-level benefit — the goal of the rework is "one card per provider, one
 * URL anchor per provider", which we get by mounting it in the new section.
 * Phase 2 may refactor to use the shared ProviderCardShell once the rest of
 * the IA stabilizes.
 */
export function KrogerProviderCard() {
  return (
    <div id="kroger" className="scroll-mt-20">
      <KrogerConnectionCard />
    </div>
  );
}
