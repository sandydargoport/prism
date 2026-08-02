// Copies the self-hosted Twemoji SVG set from @discordapp/twemoji (a devDep)
// into public/twemoji at build time. We render emoji as <img> (see
// components/ui/Emoji.tsx) so they display on ANY browser — including the
// thin-client / kiosk Chromium builds that can't render a color-emoji webfont.
// The assets are NOT committed (gitignored); this runs on prebuild/predev.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/@discordapp/twemoji/dist/svg');
const dest = path.join(root, 'public/twemoji');

if (!existsSync(src)) {
  console.warn('[copy-emoji-assets] twemoji SVG assets not found — skipping (emoji fall back to text).');
  process.exit(0);
}

// Skip if already populated (fast no-op on repeated builds).
if (existsSync(dest) && readdirSync(dest).length > 1000) {
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-emoji-assets] copied Twemoji SVGs → ${path.relative(root, dest)}`);
