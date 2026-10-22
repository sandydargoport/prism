'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Convert an emoji string to its Twemoji codepoint filename (e.g. "🐼" →
// "1f43c", "👩‍💻" → "1f469-200d-1f4bb"). Mirrors twemoji's toCodePoint: strip the
// FE0F variation selector unless the sequence contains a ZWJ (U+200D).
const U200D = '‍';
const VS16 = /️/g;
function toCodePoint(str: string): string {
  const clean = str.indexOf(U200D) < 0 ? str.replace(VS16, '') : str;
  const out: string[] = [];
  let hi = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    if (hi) {
      out.push((0x10000 + ((hi - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      hi = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      hi = c;
    } else {
      out.push(c.toString(16));
    }
  }
  return out.join('-');
}

interface EmojiProps {
  /** The emoji character(s), e.g. "🎂" */
  e: string;
  /** Accessible label (defaults to the raw emoji). */
  label?: string;
  className?: string;
}

/**
 * Renders an emoji as a self-hosted Twemoji <img> so it displays on ANY browser,
 * including thin-client / kiosk Chromium builds that can't render a color-emoji
 * font. Sized 1em square inline by default (override via className). Falls back
 * to the raw emoji text if the SVG is missing or fails to load.
 */
export function Emoji({ e, label, className }: EmojiProps) {
  const [broken, setBroken] = React.useState(false);
  const cp = e ? toCodePoint(e) : '';

  if (!cp || broken) {
    return (
      <span role="img" aria-label={label ?? e} className={className}>
        {e}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/twemoji/${cp}.svg`}
      alt={label ?? e}
      draggable={false}
      onError={() => setBroken(true)}
      className={cn('inline-block h-[1em] w-[1em] align-[-0.125em]', className)}
    />
  );
}
