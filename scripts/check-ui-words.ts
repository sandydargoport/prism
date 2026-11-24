/**
 * Fails when a retired UI word (#1337) is added to UI text, Help or the docs.
 * The words and what to write instead are in src/lib/uiWords.ts; the logic
 * is in scripts/ui-words/check.ts. Jest runs the same check in CI
 * (src/lib/__tests__/uiWords.test.ts).
 *
 *   npm run check:ui-words                                 # exit 1 if any count changed
 *   npm run check:ui-words -- --update                     # rewrite the baseline, lower only
 *   npm run check:ui-words -- --update --allow-increase    # also accept a rise
 */
import fs from 'fs';
import { BASELINE_PATH, compare, countHits, formatBaseline, readBaseline, report, scan } from './ui-words/check';

const args = process.argv.slice(2);
const update = args.includes('--update');
const allowIncrease = args.includes('--allow-increase');

const hits = scan();
const now = countHits(hits);
const changes = compare(readBaseline(), now);
const text = report(changes, hits);

if (update) {
  if (changes.increases.length && !allowIncrease) {
    console.error(text);
    console.error('\nRefusing to raise the baseline. Remove the new words, or pass --allow-increase.');
    process.exit(1);
  }
  fs.writeFileSync(BASELINE_PATH, formatBaseline(now));
  console.log(`Wrote ${BASELINE_PATH} (${hits.length} retired words).`);
  process.exit(0);
}

if (text) {
  console.error(text);
  process.exit(1);
}
console.log(`Retired UI words match the baseline (${hits.length}).`);
