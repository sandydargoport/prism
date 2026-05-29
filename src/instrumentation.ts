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

    // Lazy import of node-only code. Kept in a separate file so the edge
    // runtime bundle never resolves these heavy transitive deps (node-ical,
    // redis client, node:crypto).
    const { startCalendarSyncCron } = await import('./lib/server/calendarSyncCron');
    startCalendarSyncCron();

    const { startPhotoSyncCron } = await import('./lib/server/photoSyncCron');
    startPhotoSyncCron();
  }
}
