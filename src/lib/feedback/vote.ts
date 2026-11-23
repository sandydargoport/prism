/**
 * Feedback votes (#1311), server side: read this install's answer, and cast
 * one. A vote goes to the same collector as the weekly check-in, through the
 * same code path and the same off switches, so one switch stops both.
 *
 * Stored locally only once the counter has it, so the card never marks an
 * answer the counter did not get.
 */
import { getDeploymentChannel, isHaMode } from '@/lib/config/runtime';
import { postToCollector, telemetryOffReason } from '@/lib/telemetry/checkIn';
import {
  VOTE_SCHEMA_VERSION,
  getVoteEndpoint,
  type TelemetryOffReason,
  type VotePayload,
} from '@/lib/telemetry/constants';
import { getOrCreateInstanceId } from '@/lib/telemetry/instanceId';
import { readSetting, writeSetting } from '@/lib/telemetry/store';
import { REFERENDUM, findAnswer, isReferendumOpen, type Referendum } from './referendum';
import type { FeedbackState } from './types';

/** Settings-table key holding this install's answer to one question. */
export function voteSettingKey(referendumId: string): string {
  return `feedback.vote.${referendumId}`;
}

type StoredVote = { answer: string; at: string };

async function offReason(): Promise<TelemetryOffReason | null> {
  const off = await telemetryOffReason();
  if (off) return off;
  // An endpoint that is not a URL has nowhere to send a vote either.
  return getVoteEndpoint() ? null : 'no-endpoint';
}

async function storedAnswer(r: Referendum): Promise<string | null> {
  const stored = await readSetting<StoredVote>(voteSettingKey(r.id));
  // An answer the question no longer has counts as none.
  return findAnswer(r, stored?.answer)?.id ?? null;
}

function state(r: Referendum, answer: string | null, off: TelemetryOffReason | null): FeedbackState {
  return {
    referendum: r.id,
    open: isReferendumOpen(r),
    answer,
    canSend: off === null,
    offReason: off,
    ha: isHaMode() || getDeploymentChannel() === 'ha',
  };
}

/** This install's answer to the current question, and whether a vote can be sent. */
export async function getFeedbackState(r: Referendum = REFERENDUM): Promise<FeedbackState> {
  const [answer, off] = await Promise.all([storedAnswer(r), offReason()]);
  return state(r, answer, off);
}

export type CastVoteResult =
  | { ok: true; state: FeedbackState }
  | { ok: false; status: number; error: string };

/**
 * Validate a vote against the question, send it to the counter, and keep it.
 * Nothing leaves the install when anonymous stats are off or there is no
 * collector: the answer is the state saying so, with nothing stored.
 */
export async function castVote(
  referendumId: unknown,
  answerId: unknown,
  r: Referendum = REFERENDUM,
): Promise<CastVoteResult> {
  if (referendumId !== r.id) return { ok: false, status: 400, error: 'Unknown question.' };
  const answer = findAnswer(r, answerId);
  if (!answer) return { ok: false, status: 400, error: 'Unknown answer.' };
  if (!isReferendumOpen(r)) return { ok: false, status: 410, error: 'This question has closed.' };

  const off = await offReason();
  if (off) return { ok: true, state: state(r, await storedAnswer(r), off) };

  const payload: VotePayload = {
    schema: VOTE_SCHEMA_VERSION,
    id: await getOrCreateInstanceId(),
    referendum: r.id,
    answer: answer.id,
  };

  let sent = false;
  try {
    const res = await postToCollector(getVoteEndpoint(), payload);
    sent = res.ok;
  } catch {
    sent = false;
  }
  if (!sent) {
    return { ok: false, status: 502, error: "The vote couldn't be sent. Try again in a moment." };
  }

  const stored: StoredVote = { answer: answer.id, at: new Date().toISOString() };
  await writeSetting(voteSettingKey(r.id), stored);
  return { ok: true, state: state(r, answer.id, null) };
}
