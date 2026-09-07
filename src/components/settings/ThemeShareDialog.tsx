'use client';

/**
 * Share the palette you are looking at to the community gallery.
 *
 * The same shape as the layout editor's share dialog, and for the same reason:
 * validate here, then hand a prefilled issue form to GitHub. Validating before
 * leaving means somebody finds out their theme is unreadable while they are
 * still in Prism and can fix it, rather than after opening an issue and
 * waiting for a bot to tell them.
 *
 * Nothing is uploaded from here. The submission is carried in the URL to a
 * GitHub issue form the person then submits themselves — so a display with no
 * GitHub session, or someone who changes their mind on the page, has published
 * nothing.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { validateCommunityTheme } from '@/lib/community/validateTheme';
import { normalizeShape } from '@/lib/themes/tokens';
import type { Theme } from '@/lib/themes/tokens';

const REPO_ISSUE_URL = 'https://github.com/sandydargoport/prism/issues/new';

export function ThemeShareDialog({ palette, onClose }: { palette: Theme; onClose: () => void }) {
  const [form, setForm] = useState({
    name: palette.name,
    description: palette.description ?? '',
    author: '',
    tags: (palette as { tags?: string[] }).tags?.join(', ') ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleSubmit = () => {
    const submission = {
      type: 'prism-theme' as const,
      version: 1 as const,
      name: form.name.trim(),
      description: form.description.trim(),
      author: form.author.trim(),
      tags: form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      light: palette.light,
      dark: palette.dark,
      shape: normalizeShape(palette.shape),
    };

    const result = validateCommunityTheme(submission);
    if (!result.valid) {
      setErrors(result.errors);
      setWarnings([]);
      return;
    }

    // Text pairs only. An edge warning means the borders are subtle, which is
    // a style rather than a defect, and telling someone their deliberate
    // choice is a problem trains them to ignore the warning that matters.
    const textWarnings = result.warnings.filter((w) => w.kind === 'text');
    if (textWarnings.length && !warnings.length) {
      setErrors([]);
      setWarnings(
        textWarnings.map((w) => `${w.pair} is ${w.ratio.toFixed(2)}:1 — legible, but tiring across a room.`),
      );
      return; // shown once; pressing Share again goes ahead
    }

    // Routes to the issue FORM and prefills by field id. Forms ignore ?body=,
    // so the ids here have to match .github/ISSUE_TEMPLATE/theme-submission.yml.
    const params = new URLSearchParams({
      template: 'theme-submission.yml',
      title: `Community Theme: ${submission.name}`,
      'theme-json': JSON.stringify(submission, null, 2),
      'author-name': submission.author,
    });
    window.open(`${REPO_ISSUE_URL}?${params.toString()}`, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-lg w-full mx-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold">Share this palette</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Your theme stays yours. You license it to Prism for the gallery and
            nothing else. A maintainer reads every submission before it appears.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Name</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={form.name}
            maxLength={40}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={2}
            value={form.description}
            maxLength={160}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Your name</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="How you want to be credited"
            value={form.author}
            maxLength={50}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Tags</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="warm, muted, autumn"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">Up to five, comma separated.</span>
        </label>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            {errors.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Readable, but worth knowing:
            </p>
            {warnings.map((w) => (
              <p key={w} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>
            ))}
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This is shown on the gallery card. Press Share again to submit anyway.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Opens a prefilled form on GitHub. Nothing is sent until you submit it there.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit}>
            {warnings.length ? 'Share anyway' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
}
