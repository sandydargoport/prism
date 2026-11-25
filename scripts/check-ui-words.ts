/**
 * Fails when a retired UI word (#1337) is in UI text, Help or the docs. Zero
 * tolerance (#1352): any hit fails, and there is no baseline to accept one.
 * The words and what to write instead are in src/lib/uiWords.ts; the logic
 * is in scripts/ui-words/check.ts. Jest runs the same check in CI
 * (src/lib/__tests__/uiWords.test.ts).
 *
 *   npm run check:ui-words    # exit 1 on any retired word
 */
import { report, scan } from './ui-words/check';

const hits = scan();
if (hits.length) {
  console.error(report(hits));
  process.exit(1);
}
console.log('No retired UI words.');
