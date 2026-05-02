import { NextResponse } from 'next/server';

/**
 * Shape of every Voice API response. The `spoken` field is the natural-language
 * string the caller (Alexa skill, HA component, etc.) speaks back to the user.
 * Keeps caller code dumb — no client-side templating needed.
 */
export type VoiceResponse<T = unknown> = {
  ok: boolean;
  spoken: string;
  data?: T;
};

export function voiceOk<T>(spoken: string, data?: T, status = 200): NextResponse {
  const body: VoiceResponse<T> = data === undefined
    ? { ok: true, spoken }
    : { ok: true, spoken, data };
  return NextResponse.json(body, { status });
}

export function voiceError(spoken: string, status = 400): NextResponse {
  const body: VoiceResponse = { ok: false, spoken };
  return NextResponse.json(body, { status });
}
