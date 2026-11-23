'use client';

/**
 * The Feedback card (#1311): one question, one tap per answer, one answer per
 * install. At the bottom of More, and exported for Help. The question and its
 * answers come from REFERENDUM; this layout stays the same for the next one.
 *
 * With anonymous stats off (or no collector on this build) the card shows no
 * buttons: it says the vote can't be sent, where the switch is, and links to
 * the public poll when there is one.
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { REFERENDUM, isReferendumOpen } from '@/lib/feedback/referendum';
import type { FeedbackState } from '@/lib/feedback/types';

const SEND_FAILED = "The vote couldn't be sent. Try again in a moment.";

/** What the card says when a vote can't be sent, with where to turn stats back on. */
export function offMessage(state: Pick<FeedbackState, 'offReason' | 'ha'>): string {
  const base = "Anonymous stats are off on this install, so this vote can't be sent.";
  if (state.offReason === 'hard-disabled') {
    return state.ha
      ? `${base} The switch is in the add-on's Configuration tab, Anonymous stats.`
      : `${base} The server's PRISM_DISABLE_TELEMETRY setting turns them off.`;
  }
  if (state.offReason === 'disabled') {
    return `${base} The switch is in Settings, About, Anonymous update check.`;
  }
  return base;
}

export function FeedbackCard({ showHeading = true }: { showHeading?: boolean }) {
  const t = useTranslations('common');
  const questionId = React.useId();
  const [state, setState] = React.useState<FeedbackState | null>(null);
  const [sending, setSending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Every open asks again, so the install's current answer shows on reopen.
  const load = React.useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch('/api/feedback', { signal });
      if (res.ok) setState((await res.json()) as FeedbackState);
    } catch {
      /* no answer from the server: the card stays hidden */
    }
  }, []);
  useFetchOnMount(load);

  const vote = async (answer: string) => {
    if (sending || answer === state?.answer) return;
    setSending(answer);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referendumId: REFERENDUM.id, answer }),
      });
      const data = (await res.json().catch(() => null)) as (FeedbackState & { error?: string }) | null;
      if (res.ok && data) setState(data);
      else setError(data?.error ?? SEND_FAILED);
    } catch {
      setError(SEND_FAILED);
    } finally {
      setSending(null);
    }
  };

  if (!state || !state.open || state.referendum !== REFERENDUM.id || !isReferendumOpen(REFERENDUM)) return null;

  return (
    <section className="flex flex-col gap-2" data-feedback-card>
      {showHeading && (
        <p className="m-0 text-caption font-medium text-muted-foreground">{t('nav.feedback', { defaultValue: 'Feedback' })}</p>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <p className="m-0 text-body font-medium" id={questionId}>{REFERENDUM.question}</p>
        {state.canSend ? (
          <>
            <div role="group" aria-labelledby={questionId} className="flex flex-wrap gap-2">
              {REFERENDUM.answers.map((a) => {
                const chosen = state.answer === a.id;
                return (
                  <Button
                    key={a.id}
                    type="button"
                    variant={chosen ? 'default' : 'outline'}
                    aria-pressed={chosen}
                    disabled={sending !== null}
                    onClick={() => { void vote(a.id); }}
                    data-feedback-answer={a.id}
                    data-chosen={chosen || undefined}
                  >
                    {chosen && <Check className="h-4 w-4" aria-hidden />}
                    {a.label}
                  </Button>
                );
              })}
            </div>
            {state.answer && (
              <p className="m-0 text-caption text-muted-foreground" role="status" data-feedback-thanks>
                Thanks, your vote is counted. Tap another answer to change it.
              </p>
            )}
            {error && (
              <p className="m-0 text-caption text-destructive" role="alert" data-feedback-error>{error}</p>
            )}
          </>
        ) : (
          <p className="m-0 text-caption text-muted-foreground" data-feedback-off>
            {offMessage(state)}
            {REFERENDUM.pollUrl && (
              <>
                {' '}
                <a href={REFERENDUM.pollUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" data-feedback-poll>
                  Answer the poll on GitHub instead.
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
