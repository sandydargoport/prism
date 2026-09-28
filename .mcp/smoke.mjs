// Smoke test for the Prism MCP server. Spawns dist/index.js over stdio,
// sends an `initialize` + `tools/list` JSON-RPC pair, and asserts that
// the expected family of tools is present. Run with:
//   npm run smoke       (from .mcp/)
// or directly:
//   node smoke.mjs
//
// Uses a fake API token — only exercises the MCP wiring, not real API
// calls (no tool invocations are sent). Verify end-to-end tool calls by
// running the server through a real MCP client (Claude Desktop, etc.).

import { spawn } from 'node:child_process';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const child = spawn('node', [join(__dirname, 'dist/index.js')], {
  env: {
    ...process.env,
    PRISM_BASE_URL: 'http://localhost:3000',
    PRISM_API_TOKEN: 'smoke-fake-token',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = '';
const messages = [];
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) messages.push(JSON.parse(line));
  }
});
child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

function send(msg) { child.stdin.write(JSON.stringify(msg) + '\n'); }
function waitFor(id, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = setInterval(() => {
      const m = messages.find(m => m.id === id);
      if (m) { clearInterval(tick); resolve(m); }
      else if (Date.now() - start > timeout) { clearInterval(tick); reject(new Error(`timeout waiting for id ${id}`)); }
    }, 25);
  });
}

try {
  send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0.0.0' } },
  });
  const init = await waitFor(1);
  console.log(`✓ initialize OK — server: ${init.result?.serverInfo?.name} v${init.result?.serverInfo?.version}`);

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const list = await waitFor(2);
  const tools = list.result?.tools ?? [];
  console.log(`✓ tools/list OK — ${tools.length} tools`);

  const expected = ['list_family', 'list_chores', 'add_shopping_item', 'complete_chore', 'get_weather', 'list_recipes', 'get_household_time'];
  const missing = expected.filter(name => !tools.some(t => t.name === name));
  if (missing.length) throw new Error(`missing expected tools: ${missing.join(', ')}`);
  console.log(`✓ all expected tools present`);

  console.log('\nSmoke test PASSED');
  child.kill();
  process.exit(0);
} catch (err) {
  console.error('SMOKE TEST FAILED:', err.message);
  child.kill();
  process.exit(1);
}
