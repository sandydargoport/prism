/**
 * A theme as a file, for sharing without the gallery.
 *
 * The gallery needs a GitHub account to submit to, on purpose. A file needs
 * nothing: download it, send it however you like, import it on another
 * instance. The file is the same shape as a gallery submission, so one format
 * serves both and a file that imports here would also pass the gallery's checks.
 *
 * An imported file is as untrusted as a gallery download, so it goes through the
 * same validator and the same field-by-field projection before it is installed.
 */
import { validateCommunityTheme, projectCommunityTheme } from './validateTheme';
import { normalizeShape, type Theme } from '@/lib/themes/tokens';
import { getBuiltinTheme } from '@/lib/themes/appThemes';
import { slugify } from '@/lib/utils/downloadJson';

export type ThemeFileMeta = {
  name: string;
  description: string;
  author: string;
  tags: string;
};

/** The submission object, shared by Share (GitHub) and Download (file). */
export function buildThemeFile(palette: Theme, meta: ThemeFileMeta) {
  return {
    type: 'prism-theme' as const,
    version: 1 as const,
    name: meta.name.trim(),
    description: meta.description.trim(),
    author: meta.author.trim(),
    tags: meta.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    light: palette.light,
    dark: palette.dark,
    shape: normalizeShape(palette.shape),
    ...(palette.font !== undefined && { font: palette.font }),
    ...(palette.modes !== undefined && { modes: palette.modes }),
  };
}

/**
 * The id an imported theme is stored under. The same rule the submission
 * workflow uses, so a theme keeps one id whichever way it arrived.
 */
export function themeIdFromName(name: string): string | null {
  const id = slugify(name);
  return /^[a-z0-9][a-z0-9-]{0,48}$/.test(id) ? id : null;
}

export type ThemeFileResult =
  | { ok: true; theme: Theme }
  | { ok: false; errors: string[] };

/**
 * Parse and check a theme file's text. `installedIds` are the themes already on
 * this instance: an import never replaces one, because a file that happens to
 * share a name with an installed theme should not silently overwrite it.
 */
export function parseThemeFile(text: string, installedIds: readonly string[]): ThemeFileResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['This is not a Prism theme file (it is not valid JSON).'] };
  }

  // One plain sentence for a file that is not a theme at all, rather than the
  // validator's list of every token it is missing.
  const type = (data as { type?: unknown } | null)?.type;
  if (type === 'prism-layout') {
    return { ok: false, errors: ['This is a layout file. Load it in the layout editor, under More → Import.'] };
  }
  if (type !== 'prism-theme') {
    return { ok: false, errors: ['This is not a Prism theme file.'] };
  }

  const result = validateCommunityTheme(data);
  if (!result.valid) return { ok: false, errors: result.errors };

  const id = themeIdFromName((data as { name: string }).name);
  if (!id) return { ok: false, errors: ['The theme name needs some letters or numbers.'] };
  if (getBuiltinTheme(id)) {
    return { ok: false, errors: [`"${id}" is the name of a built-in palette. Rename the theme in the file and try again.`] };
  }
  if (installedIds.includes(id)) {
    return { ok: false, errors: ['A theme with this name is already installed. Remove it first, or rename the theme in the file.'] };
  }

  const p = projectCommunityTheme(data, id);
  return {
    ok: true,
    theme: {
      id: p.id, name: p.name, description: p.description,
      light: p.light, dark: p.dark, shape: p.shape, font: p.font, modes: p.modes,
    },
  };
}
