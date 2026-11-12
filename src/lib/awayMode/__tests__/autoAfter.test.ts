/**
 * @jest-environment jsdom
 */
/**
 * Away's idle timer is the household's (#1159): every screen reads one value
 * from the server, and a value one browser kept from before becomes the
 * household's the first time that browser reads it.
 */
import { LEGACY_AWAY_TIMEOUT_KEY, legacyAwayHours, resolveAwayAutoAfter } from '../autoAfter';

type Call = { url: string; init?: RequestInit };
let calls: Call[];
const answering = (body: unknown, ok = true) => jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(url), init });
  return { ok, json: async () => body } as Response;
}) as unknown as typeof fetch;

beforeEach(() => {
  localStorage.clear();
  calls = [];
});

describe('resolveAwayAutoAfter', () => {
  it('uses the household value on every screen, whatever the browser kept', async () => {
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '168');
    expect(await resolveAwayAutoAfter({ autoAfterHours: 24 }, answering({}))).toBe(24);
    expect(calls).toHaveLength(0);
    // The browser copy is gone, so it is never offered over the household's.
    expect(localStorage.getItem(LEGACY_AWAY_TIMEOUT_KEY)).toBeNull();
  });

  it('keeps "only by hand" chosen for the household, rather than reading it as unset', async () => {
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '24');
    expect(await resolveAwayAutoAfter({ autoAfterHours: 0 }, answering({}))).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('offers the browser value as the household value when nobody has chosen', async () => {
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '48');
    const hours = await resolveAwayAutoAfter({ autoAfterHours: null }, answering({ autoAfterHours: 48 }));
    expect(hours).toBe(48);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.init?.method).toBe('PATCH');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ autoAfterHours: 48, carryOver: true });
    expect(localStorage.getItem(LEGACY_AWAY_TIMEOUT_KEY)).toBeNull();
  });

  it('follows the household when another screen carried its value over first', async () => {
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '48');
    expect(await resolveAwayAutoAfter({}, answering({ autoAfterHours: 12 }))).toBe(12);
  });

  it('still uses the browser value, and offers it again later, when the server refuses', async () => {
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '24');
    expect(await resolveAwayAutoAfter({}, answering({}, false))).toBe(24);
    expect(localStorage.getItem(LEGACY_AWAY_TIMEOUT_KEY)).toBe('24');
  });

  it('offers nothing from a browser that never chose', async () => {
    expect(await resolveAwayAutoAfter({}, answering({}))).toBe(0);
    localStorage.setItem(LEGACY_AWAY_TIMEOUT_KEY, '0');
    expect(await resolveAwayAutoAfter({}, answering({}))).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('legacyAwayHours', () => {
  it('takes only one of the offered choices', () => {
    expect(legacyAwayHours('24')).toBe(24);
    expect(legacyAwayHours('0')).toBeNull();
    expect(legacyAwayHours('5')).toBeNull();
    expect(legacyAwayHours('nope')).toBeNull();
    expect(legacyAwayHours(null)).toBeNull();
  });
});
