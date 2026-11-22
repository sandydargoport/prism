import { execFileSync } from 'child_process';
import { e2eTeardownPlan } from '../src/lib/testing/e2eTeardown';

/**
 * Global teardown: sweep any leftover E2E test data from the TEST database,
 * catching anything per-test cleanup missed. Only with E2E_HAS_TEST_DB=1 and
 * DATABASE_URL set; see src/lib/testing/e2eTeardown.ts (#1212).
 */
export default function globalTeardown() {
  const plan = e2eTeardownPlan(process.env);
  if (!plan.run) {
    console.warn(`[global-teardown] Skipped: ${plan.reason}.`);
    return;
  }
  try {
    // The URL and SQL go to psql as arguments, never through a command line.
    execFileSync(plan.command, plan.args, { stdio: 'pipe' });
  } catch (err) {
    console.warn('[global-teardown] Could not clean up E2E data:', err instanceof Error ? err.message : err);
  }
}
