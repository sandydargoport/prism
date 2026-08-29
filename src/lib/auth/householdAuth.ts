const encoder = new TextEncoder();

export const HOUSEHOLD_COOKIE_NAME = 'kyst_household_session';
export const HOUSEHOLD_SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;
export const HOUSEHOLD_SESSION_RENEW_SECONDS = 45 * 24 * 60 * 60;
export const HOUSEHOLD_SERVICE_HEADER = 'x-kyst-service-token';

export type HouseholdAuthState = 'disabled' | 'ready' | 'misconfigured';

const DEPLOYMENT_TOKEN_PATTERN = /^v1\.[a-f0-9]{64}$/;

export function getHouseholdAuthState(): HouseholdAuthState {
  const password = process.env.KYST_AUTH_PASSWORD || '';
  const secret = process.env.KYST_AUTH_SECRET || '';
  const deviceToken = process.env.KYST_AUTH_DEVICE_TOKEN || '';
  const serviceToken = process.env.KYST_AUTH_SERVICE_TOKEN || '';
  const passwordSet = Boolean(password);
  const secretSet = Boolean(secret);
  const anySet = passwordSet || secretSet || Boolean(deviceToken) || Boolean(serviceToken);

  if (!anySet) return 'disabled';
  const valid =
    password.length >= 4 &&
    secret.length >= 32 &&
    (!deviceToken || DEPLOYMENT_TOKEN_PATTERN.test(deviceToken)) &&
    (!serviceToken || DEPLOYMENT_TOKEN_PATTERN.test(serviceToken));
  return valid ? 'ready' : 'misconfigured';
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function digest(value: string): Promise<Uint8Array> {
  const result = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return new Uint8Array(result);
}

export async function constantTimeSecretEqual(
  candidate: string,
  expected: string
): Promise<boolean> {
  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < candidateDigest.length; index += 1) {
    difference |= candidateDigest[index]! ^ expectedDigest[index]!;
  }
  return difference === 0;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64Url(new Uint8Array(signature));
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createHouseholdSession(
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  nonce = randomNonce()
): Promise<string> {
  const expiresAt = nowSeconds + HOUSEHOLD_SESSION_TTL_SECONDS;
  const payload = `v1.${nowSeconds}.${expiresAt}.${nonce}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export type HouseholdSessionValidation = {
  valid: boolean;
  renew: boolean;
};

export async function validateHouseholdSession(
  value: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<HouseholdSessionValidation> {
  if (!value) return { valid: false, renew: false };

  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return { valid: false, renew: false };

  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const nonce = parts[3]!;
  const suppliedSignature = parts[4]!;

  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) {
    return { valid: false, renew: false };
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(nonce)) return { valid: false, renew: false };
  if (issuedAt > nowSeconds + 300 || expiresAt <= nowSeconds) return { valid: false, renew: false };
  if (expiresAt - issuedAt !== HOUSEHOLD_SESSION_TTL_SECONDS) {
    return { valid: false, renew: false };
  }

  const payload = parts.slice(0, 4).join('.');
  const expectedSignature = await sign(payload, secret);
  if (!(await constantTimeSecretEqual(suppliedSignature, expectedSignature))) {
    return { valid: false, renew: false };
  }

  return {
    valid: true,
    renew: expiresAt - nowSeconds <= HOUSEHOLD_SESSION_RENEW_SECONDS,
  };
}

export function householdCookieOptions(maxAge = HOUSEHOLD_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
