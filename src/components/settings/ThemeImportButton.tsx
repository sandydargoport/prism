'use client';

/**
 * Install a theme from a file someone sent, without going through the gallery.
 *
 * The counterpart to Download file in the share dialog. The file is parsed and
 * checked by the same rules a gallery download is, then installed the same way,
 * so it shows up in the picker marked Community and can be removed like one.
 */

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers';
import { parseThemeFile } from '@/lib/community/themeFile';
import { MAX_INSTALLED_THEMES } from '@/lib/themes/tokens';

// Far larger than any real theme, small enough that a wrong file is refused
// before it is read into memory.
const MAX_FILE_BYTES = 64 * 1024;

/** `onErrors` receives the reasons a file was refused, or [] when one is chosen. */
export function ThemeImportButton({ onErrors }: { onErrors: (errors: string[]) => void }) {
  const { installedThemes, installTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    onErrors([]);
    if (file.size > MAX_FILE_BYTES) {
      onErrors(['This file is too large to be a Prism theme.']);
      return;
    }
    if (installedThemes.length >= MAX_INSTALLED_THEMES) {
      onErrors([`You have ${MAX_INSTALLED_THEMES} themes installed, which is the limit. Remove one first.`]);
      return;
    }
    setBusy(true);
    try {
      const parsed = parseThemeFile(await file.text(), installedThemes.map((t) => t.id));
      if (!parsed.ok) {
        onErrors(parsed.errors);
        return;
      }
      if (!(await installTheme(parsed.theme))) {
        onErrors([`"${parsed.theme.name}" could not be installed.`]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4 mr-1" />
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="theme-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // so choosing the same file again still fires
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
