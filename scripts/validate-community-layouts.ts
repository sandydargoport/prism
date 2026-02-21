#!/usr/bin/env npx tsx
/**
 * CI validation script for community layouts.
 * Reads community/layouts/index.json, validates every referenced layout,
 * checks index consistency, exits non-zero on any error.
 *
 * Usage: npx tsx scripts/validate-community-layouts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateCommunityLayout, type CommunityWidget } from '../src/lib/community/validateLayout';

const COMMUNITY_DIR = path.resolve(__dirname, '..', 'community', 'layouts');
const INDEX_PATH = path.join(COMMUNITY_DIR, 'index.json');

interface IndexEntry {
  id: string;
  file: string;
  name: string;
  description: string;
  author: string;
  mode: 'dashboard' | 'screensaver';
  tags: string[];
  screenSizes: string[];
  orientation: string;
  widgetCount: number;
  createdAt: string;
}

interface IndexFile {
  version: number;
  layouts: IndexEntry[];
}

let hasErrors = false;

function error(msg: string) {
  console.error(`  ERROR: ${msg}`);
  hasErrors = true;
}

function warn(msg: string) {
  console.warn(`  WARN: ${msg}`);
}

function main() {
  console.log('Validating community layouts...\n');

  // 1. Read index
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('Index file not found:', INDEX_PATH);
    process.exit(1);
  }

  const indexRaw = fs.readFileSync(INDEX_PATH, 'utf-8');
  let index: IndexFile;
  try {
    index = JSON.parse(indexRaw);
  } catch {
    console.error('Invalid JSON in index.json');
    process.exit(1);
  }

  if (!Array.isArray(index.layouts)) {
    console.error('index.json missing "layouts" array');
    process.exit(1);
  }

  console.log(`Found ${index.layouts.length} layouts in index.\n`);

  // Collect all widget sets for duplicate detection
  const allWidgetSets: CommunityWidget[][] = [];
  const allEntries: IndexEntry[] = [];

  // 2. Validate each layout
  for (const entry of index.layouts) {
    console.log(`[${entry.id}] ${entry.name} (${entry.mode})`);

    // Check file exists
    const layoutPath = path.join(COMMUNITY_DIR, entry.file);
    if (!fs.existsSync(layoutPath)) {
      error(`File not found: ${entry.file}`);
      continue;
    }

    // Read and parse
    let layoutData: unknown;
    try {
      const raw = fs.readFileSync(layoutPath, 'utf-8');
      layoutData = JSON.parse(raw);
    } catch {
      error(`Invalid JSON in ${entry.file}`);
      continue;
    }

    // Validate with the shared validator
    const result = validateCommunityLayout(layoutData);
    if (!result.valid) {
      for (const err of result.errors) {
        error(err);
      }
    }
    for (const w of result.warnings) {
      warn(w);
    }

    // Index consistency checks
    const layout = layoutData as Record<string, unknown>;
    if (layout.mode !== entry.mode) {
      error(`Mode mismatch: index says "${entry.mode}", file says "${layout.mode}"`);
    }
    if (layout.name !== entry.name) {
      error(`Name mismatch: index says "${entry.name}", file says "${layout.name}"`);
    }

    const widgets = layout.widgets as CommunityWidget[] | undefined;
    if (widgets) {
      if (widgets.length !== entry.widgetCount) {
        error(`Widget count mismatch: index says ${entry.widgetCount}, file has ${widgets.length}`);
      }
      allWidgetSets.push(widgets);
      allEntries.push(entry);
    }

    console.log('');
  }

  // 3. Check for duplicate IDs in index
  const ids = index.layouts.map(e => e.id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    error(`Duplicate IDs in index: ${duplicateIds.join(', ')}`);
  }

  // Summary
  console.log('---');
  if (hasErrors) {
    console.error('\nValidation FAILED. See errors above.');
    process.exit(1);
  } else {
    console.log(`\nAll ${index.layouts.length} layouts valid.`);
    process.exit(0);
  }
}

main();
