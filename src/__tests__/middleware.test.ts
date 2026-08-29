import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { createHouseholdSession, HOUSEHOLD_COOKIE_NAME } from '@/lib/auth/householdAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  path: string,
  { method = 'GET', headers = {} }: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, { method, headers: new Headers(headers) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('middleware', () => {
  describe('x-request-id injection', () => {
    it('GET request — response includes x-request-id header', async () => {
      const req = makeRequest('/api/foo');
      const res = await middleware(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toHaveLength(24);
    });

    it('POST with no x-request-id — response gets a generated 24-char hex id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toMatch(/^[0-9a-f]{24}$/);
    });

    it('POST with existing x-request-id — response propagates the same value', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'x-request-id': 'existing-id',
        },
      });
      const res = await middleware(req);

      expect(res.headers.get('x-request-id')).toBe('existing-id');
    });
  });

  describe('CSRF protection', () => {
    it('POST with matching Origin/Host — passes through (200)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with mismatched Origin — returns 403 with x-request-id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with no Origin header — passes through (non-browser client)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('CSRF-exempt path /api/away-mode with cross-origin POST — passes through', async () => {
      const req = makeRequest('/api/away-mode', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('GET with mismatched Origin — passes through (CSRF only applies to mutations)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'GET',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });
  });

  describe('DEMO_MODE', () => {
    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('off by default — POST passes through', async () => {
      const req = makeRequest('/api/events', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it('on — POST to mutation route returns 403 with demo_mode error', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('demo_mode');
      expect(body.message).toMatch(/read-only demo/i);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('on — DELETE blocked the same as POST', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events/abc', {
        method: 'DELETE',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('demo_mode');
    });

    it('on — GET passes through (reads always allowed)', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events', {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it('on — login allowed so visitors can switch members', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it("on — logout allowed so visitors don't get stuck", async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/auth/logout', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });
  });

  describe('KYST household authentication', () => {
    const authSecret = 's'.repeat(64);
    const serviceToken = `v1.${'a'.repeat(64)}`;

    beforeEach(() => {
      process.env.KYST_AUTH_PASSWORD = 'test-password';
      process.env.KYST_AUTH_SECRET = authSecret;
      process.env.KYST_AUTH_SERVICE_TOKEN = serviceToken;
    });

    afterEach(() => {
      delete process.env.KYST_AUTH_PASSWORD;
      delete process.env.KYST_AUTH_SECRET;
      delete process.env.KYST_AUTH_DEVICE_TOKEN;
      delete process.env.KYST_AUTH_SERVICE_TOKEN;
    });

    it('returns 401 for an unauthenticated data API request', async () => {
      const response = await middleware(makeRequest('/api/tasks'));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: 'Household authentication required',
      });
    });

    it('accepts a valid household session cookie', async () => {
      const cookie = await createHouseholdSession(authSecret);
      const response = await middleware(
        makeRequest('/api/tasks', {
          headers: { cookie: `${HOUSEHOLD_COOKIE_NAME}=${cookie}` },
        })
      );
      expect(response.status).not.toBe(401);
    });

    it('accepts the deployment service header', async () => {
      const response = await middleware(
        makeRequest('/api/tasks', {
          headers: { 'x-kyst-service-token': serviceToken },
        })
      );
      expect(response.status).not.toBe(401);
    });

    it('rejects an arbitrary service header', async () => {
      const response = await middleware(
        makeRequest('/api/tasks', {
          headers: { 'x-kyst-service-token': `v1.${'b'.repeat(64)}` },
        })
      );
      expect(response.status).toBe(401);
    });

    it('redirects an unauthenticated page request to the login wall', async () => {
      const response = await middleware(makeRequest('/calendar?view=week'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/auth/household?next=%2Fcalendar%3Fview%3Dweek'
      );
    });

    it('keeps the login wall and health checks public', async () => {
      expect((await middleware(makeRequest('/auth/household'))).status).not.toBe(401);
      expect((await middleware(makeRequest('/api/health'))).status).not.toBe(401);
      expect((await middleware(makeRequest('/api/health/ready'))).status).not.toBe(401);
      expect((await middleware(makeRequest('/api/health/deep'))).status).toBe(401);
      expect((await middleware(makeRequest('/sw.js'))).status).not.toBe(401);
      expect((await middleware(makeRequest('/workbox-123.js'))).status).not.toBe(401);
    });

    it('fails closed when only one core secret is configured', async () => {
      delete process.env.KYST_AUTH_SECRET;
      const response = await middleware(makeRequest('/api/tasks'));
      expect(response.status).toBe(503);
    });
  });
});
