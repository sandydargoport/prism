export async function register() {
  // Force IPv4-only connections for all fetch() calls.
  // Docker Desktop's bridge network does not route IPv6, so undici (Node's
  // built-in fetch) hangs trying IPv6 addresses before falling back to IPv4.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // undici is bundled with Node 18+ but has no separate @types package;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setGlobalDispatcher, Agent } = require('undici') as {
      setGlobalDispatcher: (d: unknown) => void;
      Agent: new (opts: { connect: { family: number } }) => unknown;
    };
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

    // Check the encryption key before anything tries to use it. A bad key
    // does not stop Prism running — nothing encrypts until an integration
    // stores a credential — so the failure used to surface much later, in
    // whichever integration happened to encrypt first, looking like a problem
    // with that integration. One reporter spent a long time on Google OAuth
    // troubleshooting for what was a placeholder left in .env (#307).
    //
    // Warn rather than refuse to start: an install that never stores a
    // credential works fine without a key, and there is a documented
    // PIN_ENCRYPTION_KEY fallback. Refusing would break working setups to
    // report a problem they do not have.
    const { checkEncryptionKey } = await import('./lib/utils/crypto');
    const keyProblem = checkEncryptionKey();
    if (keyProblem) {
      console.error(
        '\n' +
        '='.repeat(72) + '\n' +
        '  PRISM CONFIGURATION PROBLEM\n\n' +
        `  ${keyProblem}\n\n` +
        '  Prism will start, but anything that stores a credential will fail:\n' +
        '  Google Calendar, iCloud/CalDAV, bus tracking and photo sources.\n' +
        '  Set the key, then recreate the container.\n' +
        '='.repeat(72) + '\n',
      );
    }

    // Lazy import of node-only code. Kept in a separate file so the edge
    // runtime bundle never resolves these heavy transitive deps (node-ical,
    // redis client, node:crypto).
    const { startCalendarSyncCron } = await import('./lib/server/calendarSyncCron');
    startCalendarSyncCron();

    const { startPhotoSyncCron } = await import('./lib/server/photoSyncCron');
    startPhotoSyncCron();

    const { startTelemetryCron } = await import('./lib/server/telemetryCron');
    startTelemetryCron();
  }
}
