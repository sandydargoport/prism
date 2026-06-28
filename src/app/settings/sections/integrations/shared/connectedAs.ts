/**
 * Formats the "Connected as <email>" label shown on the Integrations provider
 * cards (#100). For split-account setups (the same provider authorized with
 * more than one account) it appends "+N more" so the extra accounts aren't
 * silently hidden.
 *
 * Returns null when there's no known email — the card then falls back to its
 * generic "Connected" wording (e.g. sources that predate the email-capture
 * migration, until the user re-authenticates).
 */
export function connectedAsLabel(
  primary: string | null,
  all: string[] = [],
): string | null {
  if (!primary) return null;
  const extra = all.filter((e) => e !== primary).length;
  return extra > 0 ? `Connected as ${primary} · +${extra} more` : `Connected as ${primary}`;
}
