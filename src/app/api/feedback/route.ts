/**
 * /api/feedback: one-tap votes on a question, from the Feedback card in More (#1311).
 *
 * GET:  this install's answer to the current question, and whether a vote can
 *       be sent (FeedbackState).
 * POST: { referendumId, answer } casts or changes this install's answer.
 *
 * Anyone who can see the More panel may vote, the signed-out wall included,
 * so both go through getDisplayAuth. One answer per install: a second vote
 * replaces the first, here and at the counter.
 *
 * RESPONSE (POST):
 * - 200: FeedbackState. With anonymous stats off or no collector, canSend is
 *        false and nothing was sent or stored.
 * - 400: Unknown question or answer
 * - 401: No display identity
 * - 410: The question has closed
 * - 429: Too many votes this minute
 * - 502: The counter did not take the vote; nothing stored
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { castVote, getFeedbackState } from '@/lib/feedback/vote';
import { logError } from '@/lib/utils/logError';

/** Votes per minute for the whole install: enough to change a mind, not to hammer the counter. */
const FEEDBACK_RATE_LIMIT = { limit: 10, windowSeconds: 60 } as const;

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await getFeedbackState());
  } catch (error) {
    logError('Error reading feedback state:', error);
    return NextResponse.json({ error: 'Failed to read feedback' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await rateLimitGuard(
    'install',
    'feedback',
    FEEDBACK_RATE_LIMIT.limit,
    FEEDBACK_RATE_LIMIT.windowSeconds,
  );
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => null);
    const result = await castVote(body?.referendumId, body?.answer);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.state);
  } catch (error) {
    logError('Error casting feedback vote:', error);
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
  }
}
