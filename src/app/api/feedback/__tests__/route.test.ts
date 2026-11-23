/**
 * /api/feedback (#1311): a vote is checked against the question, sent to the
 * install counter as exactly {schema, id, referendum, answer}, and kept as
 * this install's one answer. With anonymous stats off, by any of the same
 * switches as the weekly check-in, nothing is sent and nothing is stored.
 *
 * The real telemetry modules run; only the settings table, the auth, the
 * rate limit and the network are stand-ins.
 */
const mockSettings = new Map<string, unknown>();
const mockDisplayAuth = jest.fn();
const mockRateLimitGuard = jest.fn();

jest.mock('@/lib/telemetry/store', () => ({
  readSetting: async (key: string) => mockSettings.get(key),
  writeSetting: async (key: string, value: unknown) => { mockSettings.set(key, value); },
}));
jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockDisplayAuth() }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: (...a: unknown[]) => mockRateLimitGuard(...a) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../route';
import { REFERENDUM } from '@/lib/feedback/referendum';
import { runCheckIn } from '@/lib/telemetry/checkIn';
import { getVoteEndpoint } from '@/lib/telemetry/constants';

const INSTALL_ID = '11111111-2222-4333-8444-555555555555';
const fetchMock = jest.fn();
const ENV_KEYS = ['PRISM_TELEMETRY_URL', 'PRISM_DISABLE_TELEMETRY', 'PRISM_HA_MODE', 'PRISM_DEPLOYMENT'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/feedback', { method: 'POST', body: JSON.stringify(body) }));
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const stored = () => mockSettings.get(`feedback.vote.${REFERENDUM.id}`) as { answer: string } | undefined;

beforeEach(() => {
  mockSettings.clear();
  mockSettings.set('telemetry.instanceId', INSTALL_ID);
  mockDisplayAuth.mockResolvedValue({ userId: 'display-user', role: 'guest' });
  mockRateLimitGuard.mockReset().mockResolvedValue(null);
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.PRISM_TELEMETRY_URL = 'https://collector.example.com';
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('POST /api/feedback', () => {
  it('sends exactly {schema, id, referendum, answer} to /vote beside the check-in, and keeps the answer', async () => {
    const res = await post({ referendumId: '2026-11-navigation', answer: 'sidebar' });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      referendum: '2026-11-navigation',
      open: true,
      answer: 'sidebar',
      canSend: true,
      offReason: null,
      ha: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://collector.example.com/vote');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      schema: 1,
      id: INSTALL_ID,
      referendum: '2026-11-navigation',
      answer: 'sidebar',
    });
    expect(stored()?.answer).toBe('sidebar');

    // The install's answer comes back on the next open.
    expect((await json(await GET())).answer).toBe('sidebar');
  });

  it('a second vote replaces the first', async () => {
    await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    const res = await post({ referendumId: REFERENDUM.id, answer: 'bottom-bar' });
    expect((await json(res)).answer).toBe('bottom-bar');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).answer).toBe('bottom-bar');
    expect(stored()?.answer).toBe('bottom-bar');
  });

  it.each([
    ['an unknown question', { referendumId: '2025-01-unknown', answer: 'sidebar' }],
    ['an unknown answer', { referendumId: REFERENDUM.id, answer: 'top-bar' }],
    ['no answer', { referendumId: REFERENDUM.id }],
    ['no body', null],
  ])('refuses %s, and sends and stores nothing', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
  });

  it('refuses a vote once the question has closed', async () => {
    REFERENDUM.openUntil = '2020-01-31';
    try {
      const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
      expect(res.status).toBe(410);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete REFERENDUM.openUntil;
    }
  });

  it('with PRISM_DISABLE_TELEMETRY (the Home Assistant Anonymous stats option) sends and stores nothing, and says it is the add-on', async () => {
    process.env.PRISM_DISABLE_TELEMETRY = 'true';
    process.env.PRISM_HA_MODE = '1';
    const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ canSend: false, offReason: 'hard-disabled', ha: true, answer: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
  });

  it('with the switch in Settings > About off, sends and stores nothing', async () => {
    mockSettings.set('telemetry.enabled', false);
    const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(await json(res)).toMatchObject({ canSend: false, offReason: 'disabled', ha: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
  });

  it('on a build with no collector, sends and stores nothing', async () => {
    delete process.env.PRISM_TELEMETRY_URL;
    const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(await json(res)).toMatchObject({ canSend: false, offReason: 'no-endpoint' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
  });

  it.each([
    ['answers with an error', () => fetchMock.mockImplementation(async () => new Response('no', { status: 500 }))],
    ['cannot be reached', () => fetchMock.mockRejectedValue(new Error('offline'))],
  ])('when the counter %s, says so and keeps no answer', async (_name, arrange) => {
    arrange();
    const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(res.status).toBe(502);
    expect((await json(res)).error).toMatch(/couldn't be sent/);
    expect(stored()).toBeUndefined();
  });

  it('is rate-limited for the install, before anything is sent', async () => {
    mockRateLimitGuard.mockResolvedValue(NextResponse.json({ error: 'Too many requests.' }, { status: 429 }));
    const res = await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(res.status).toBe(429);
    expect(mockRateLimitGuard).toHaveBeenCalledWith('install', 'feedback', 10, 60);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('needs a display identity, like the rest of the wall', async () => {
    mockDisplayAuth.mockResolvedValue(null);
    expect((await post({ referendumId: REFERENDUM.id, answer: 'sidebar' })).status).toBe(401);
    expect((await GET()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/feedback', () => {
  it('with no answer yet: none, and whether a vote can be sent', async () => {
    expect(await json(await GET())).toEqual({
      referendum: REFERENDUM.id,
      open: true,
      answer: null,
      canSend: true,
      offReason: null,
      ha: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a stored answer the question no longer has counts as none', async () => {
    mockSettings.set(`feedback.vote.${REFERENDUM.id}`, { answer: 'retired-answer', at: '2026-11-01T00:00:00Z' });
    expect((await json(await GET())).answer).toBeNull();
  });
});

describe('one switch for the check-in and the vote', () => {
  it('the switch that stops the vote stops the weekly check-in too', async () => {
    mockSettings.set('telemetry.enabled', false);
    expect(await runCheckIn()).toMatchObject({ sent: false });
    expect((await json(await post({ referendumId: REFERENDUM.id, answer: 'sidebar' }))).canSend).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    mockSettings.delete('telemetry.enabled');
    await runCheckIn();
    await post({ referendumId: REFERENDUM.id, answer: 'sidebar' });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['https://collector.example.com', 'https://collector.example.com/vote']);
  });

  it('a vote goes beside the check-in wherever the collector lives', () => {
    process.env.PRISM_TELEMETRY_URL = 'https://collector.example.com/';
    expect(getVoteEndpoint()).toBe('https://collector.example.com/vote');
    process.env.PRISM_TELEMETRY_URL = 'https://collector.example.com/v1/checkin';
    expect(getVoteEndpoint()).toBe('https://collector.example.com/v1/vote');
    process.env.PRISM_TELEMETRY_URL = 'https://example.com/prism-counter';
    expect(getVoteEndpoint()).toBe('https://example.com/prism-counter/vote');
    process.env.PRISM_TELEMETRY_URL = 'not a url';
    expect(getVoteEndpoint()).toBe('');
  });
});
