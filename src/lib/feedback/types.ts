import type { TelemetryOffReason } from '@/lib/telemetry/constants';

/** What GET and POST /api/feedback answer with (#1311). */
export type FeedbackState = {
  /** The question's id (REFERENDUM.id). */
  referendum: string;
  /** False once the question's openUntil has passed. */
  open: boolean;
  /** This install's current answer id, or null if it has none yet. */
  answer: string | null;
  /** Whether a vote can reach the counter: anonymous stats on and a collector set. */
  canSend: boolean;
  /** Why a vote cannot be sent, when canSend is false. */
  offReason: TelemetryOffReason | null;
  /** Running as the Home Assistant add-on, where the off switch is in its Configuration tab. */
  ha: boolean;
};
