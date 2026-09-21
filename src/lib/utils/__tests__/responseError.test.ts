import { readResponseError } from '../responseError';

/**
 * The case that matters most is the one that used to throw: a non-ok response
 * whose body is not JSON. Calling .json() on it produced
 * `Unexpected token '<', "<!DOCTYPE "...`, which replaced the real status with
 * a parser complaint and told the user nothing.
 */

function res(status: number, body: string, contentType?: string, statusText = ''): Response {
  return new Response(body, {
    status,
    statusText,
    headers: contentType ? { 'content-type': contentType } : {},
  });
}

const JSON_CT = 'application/json';
const HTML = '<!DOCTYPE html><html lang="en"><head><title>404</title></head></html>';

describe('readResponseError', () => {
  it('uses the API error when the body is JSON', async () => {
    const { message, body, status } = await readResponseError(
      res(400, JSON.stringify({ error: 'Validation failed' }), JSON_CT),
    );
    expect(message).toBe('Validation failed');
    expect(body).toEqual({ error: 'Validation failed' });
    expect(status).toBe(400);
  });

  it('names the refused fields, deduped', async () => {
    const { message } = await readResponseError(
      res(
        400,
        JSON.stringify({
          error: 'Validation failed',
          details: [{ path: ['location'] }, { path: ['location'] }, { path: ['startTime'] }],
        }),
        JSON_CT,
      ),
    );
    expect(message).toBe('Validation failed: location, startTime');
  });

  it('never surfaces markup when the body is HTML', async () => {
    const { message, body } = await readResponseError(res(404, HTML, 'text/html'));
    expect(message).not.toContain('<');
    expect(message).not.toContain('DOCTYPE');
    expect(body).toBeNull();
  });

  it('explains a 404 as a stale page, which is the usual cause here', async () => {
    const { message } = await readResponseError(res(404, HTML, 'text/html'));
    expect(message).toContain('404');
    expect(message).toMatch(/older version|Clear Cache/i);
  });

  it('survives a body that claims JSON and is not', async () => {
    // A proxy can return an HTML page under a JSON content-type. The old code
    // threw here; this must still produce something readable.
    const { message, body } = await readResponseError(res(502, HTML, JSON_CT));
    expect(body).toBeNull();
    expect(message).toMatch(/did not respond/i);
  });

  it('survives an empty body', async () => {
    const { message } = await readResponseError(res(405, ''));
    expect(message).toContain('405');
  });

  it('maps auth failures to something actionable', async () => {
    expect((await readResponseError(res(401, '', ''))).message).toMatch(/signed out/i);
    expect((await readResponseError(res(403, '', ''))).message).toMatch(/signed out/i);
  });

  it('falls back when JSON carries no usable message', async () => {
    const { message } = await readResponseError(res(418, JSON.stringify({ nope: 1 }), JSON_CT), 'Custom fallback');
    // 418 has no special wording and no statusText here, so the caller's
    // fallback is what the person should see.
    expect(message).toBe('Custom fallback');
  });

  it('prefers statusText over a bare fallback when one exists', async () => {
    const { message } = await readResponseError(res(418, '', '', "I'm a teapot"));
    expect(message).toBe("I'm a teapot (418)");
  });
});
