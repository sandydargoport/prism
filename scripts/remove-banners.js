#!/usr/bin/env node
/**
 * Removes banner-style comments from TypeScript/TSX files.
 * Takes a conservative approach - only removes banner lines, not entire blocks.
 */

const fs = require('fs');
const path = require('path');

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function main() {
  const files = walkDir(path.join(process.cwd(), 'src'));

  let totalFilesModified = 0;
  let totalLinesRemoved = 0;

  for (const filePath of files) {
    const file = path.relative(process.cwd(), filePath);
    const original = fs.readFileSync(filePath, 'utf8');
    const lines = original.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip lines that are just banner separators
      // Pattern: // ===...=== or * ===...=== or just ===...===
      if (/^(?:\/\/|\*)?\s*={10,}\s*$/.test(trimmed)) {
        continue;
      }

      // Skip "PRISM - Something" header lines in JSDoc
      if (/^\*\s+PRISM\s+-\s+/.test(trimmed)) {
        continue;
      }

      // Skip "WHAT THIS FILE DOES:" lines
      if (/^\*\s+WHAT THIS (?:FILE|HOOK|COMPONENT) DOES:?\s*$/.test(trimmed)) {
        continue;
      }

      newLines.push(line);
    }

    // Clean up empty JSDoc blocks: /** \n * \n */
    let modified = newLines.join('\n');

    // Remove JSDoc blocks that only contain empty lines or whitespace
    modified = modified.replace(/\/\*\*\n(?:\s*\*\s*\n)*\s*\*\//g, '');

    // Clean up multiple consecutive blank lines
    modified = modified.replace(/\n{3,}/g, '\n\n');

    const linesRemoved = lines.length - modified.split('\n').length;

    if (modified !== original) {
      fs.writeFileSync(filePath, modified, 'utf8');
      totalFilesModified++;
      totalLinesRemoved += linesRemoved;
      if (linesRemoved > 0) {
        console.log(`${file}: removed ${linesRemoved} lines`);
      }
    }
  }

  console.log(`\nDone! Modified ${totalFilesModified} files, removed ${totalLinesRemoved} lines total.`);
}

main();
