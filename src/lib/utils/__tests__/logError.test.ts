import { logError, oneLine } from '../logError';

/**
 * Request text in a log message (a search, a date) cannot forge or split log
 * lines, or act as console's format string (CodeQL log injection).
 */
describe('logError', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => spy.mockClear());
  afterAll(() => spy.mockRestore());

  it('logs the message as a %s argument, on one line', () => {
    logError('Search failed for milk\nERROR forged line %s %o', new Error('boom\nmore'), 'req-1');
    const [format, line, detail] = spy.mock.calls[0]!;
    expect(format).toBe('%s');
    expect(line).toBe('[req-1] Search failed for milk ERROR forged line %s %o');
    expect(String(detail)).toContain('boom');
  });

  it('oneLine turns control characters into spaces', () => {
    expect(oneLine('a\r\nb\tc\u0007d')).toBe('a b c d');
  });
});
