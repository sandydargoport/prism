import {
  createHouseholdSession,
  getHouseholdAuthState,
  HOUSEHOLD_SESSION_RENEW_SECONDS,
  HOUSEHOLD_SESSION_TTL_SECONDS,
  validateHouseholdSession,
} from '../householdAuth';

const secret = 's'.repeat(64);
const nonce = 'n'.repeat(43);

describe('householdAuth', () => {
  afterEach(() => {
    delete process.env.KYST_AUTH_PASSWORD;
    delete process.env.KYST_AUTH_SECRET;
    delete process.env.KYST_AUTH_DEVICE_TOKEN;
    delete process.env.KYST_AUTH_SERVICE_TOKEN;
  });

  it('is disabled when no KYST auth variables are present', () => {
    expect(getHouseholdAuthState()).toBe('disabled');
  });

  it('fails closed when core variables are partial or weak', () => {
    process.env.KYST_AUTH_PASSWORD = '1234';
    expect(getHouseholdAuthState()).toBe('misconfigured');
    process.env.KYST_AUTH_SECRET = 'short';
    expect(getHouseholdAuthState()).toBe('misconfigured');
  });

  it('accepts a complete configuration and validates token formats', () => {
    process.env.KYST_AUTH_PASSWORD = '1234';
    process.env.KYST_AUTH_SECRET = secret;
    process.env.KYST_AUTH_DEVICE_TOKEN = `v1.${'a'.repeat(64)}`;
    process.env.KYST_AUTH_SERVICE_TOKEN = `v1.${'b'.repeat(64)}`;
    expect(getHouseholdAuthState()).toBe('ready');

    process.env.KYST_AUTH_DEVICE_TOKEN = 'weak';
    expect(getHouseholdAuthState()).toBe('misconfigured');
  });

  it('creates and validates a 90-day signed session', async () => {
    const now = 1_800_000_000;
    const token = await createHouseholdSession(secret, now, nonce);
    expect(token).toMatch(/^v1\.1800000000\.1807776000\./);
    await expect(validateHouseholdSession(token, secret, now)).resolves.toEqual({
      valid: true,
      renew: false,
    });
  });

  it('rejects tampering and expiration', async () => {
    const now = 1_800_000_000;
    const token = await createHouseholdSession(secret, now, nonce);
    await expect(validateHouseholdSession(`${token}x`, secret, now)).resolves.toEqual({
      valid: false,
      renew: false,
    });
    await expect(
      validateHouseholdSession(token, secret, now + HOUSEHOLD_SESSION_TTL_SECONDS)
    ).resolves.toEqual({ valid: false, renew: false });
  });

  it('requests sliding renewal in the final 45 days', async () => {
    const now = 1_800_000_000;
    const token = await createHouseholdSession(secret, now, nonce);
    await expect(
      validateHouseholdSession(
        token,
        secret,
        now + HOUSEHOLD_SESSION_TTL_SECONDS - HOUSEHOLD_SESSION_RENEW_SECONDS
      )
    ).resolves.toEqual({ valid: true, renew: true });
  });
});
