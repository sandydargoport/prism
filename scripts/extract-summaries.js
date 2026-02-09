/**
 * Extract change summaries from Claude session transcripts
 *
 * Looks for patterns like:
 * - "Here's a summary..."
 * - "I've implemented..."
 * - "Done! ..." followed by bullet points
 * - "## Summary" sections
 * - Commit messages
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const SESSION_DIR = 'C:/Users/User/.claude/projects/C--projects-prism';
const OUTPUT_FILE = 'C:/projects/prism/docs/CHANGE_SUMMARIES.md';

// Patterns that indicate a summary block
const SUMMARY_PATTERNS = [
  /here['']s a summary/i,
  /I['']ve implemented/i,
  /I['']ve (created|added|updated|fixed|modified)/i,
  /Done!.*:/i,
  /## (Summary|Changes|What was done)/i,
  /changes (include|are|were):/i,
  /This (adds|fixes|implements|updates)/i,
  /Key changes:/i,
  /Features added:/i,
  /\*\*.*\*\*:?\s*\n-/,  // Bold header followed by bullet
];

// Patterns to skip (tool outputs, code blocks, etc.)
const SKIP_PATTERNS = [
  /^```/,
  /system-reminder/i,
  /</,
  /function_results/,
];

async function extractFromSession(filepath) {
  const summaries = [];
  const filename = path.basename(filepath);

  console.log(`Processing ${filename}...`);

  const fileStream = fs.createReadStream(filepath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 10000 === 0) {
      console.log(`  Processed ${lineCount} lines...`);
    }

    try {
      const entry = JSON.parse(line);

      // Only look at assistant messages
      if (entry.type === 'assistant' && entry.message?.content) {
        const content = typeof entry.message.content === 'string'
          ? entry.message.content
          : entry.message.content.map(c => c.text || '').join('\n');

        // Check if this looks like a summary
        const isSummary = SUMMARY_PATTERNS.some(p => p.test(content));
        const shouldSkip = SKIP_PATTERNS.some(p => p.test(content));

        if (isSummary && !shouldSkip && content.length > 100 && content.length < 5000) {
          // Extract timestamp if available
          const timestamp = entry.timestamp || 'unknown';

          summaries.push({
            timestamp,
            session: filename,
            content: content.trim()
          });
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  console.log(`  Found ${summaries.length} potential summaries in ${lineCount} lines`);
  return summaries;
}

async function main() {
  const sessions = fs.readdirSync(SESSION_DIR)
    .filter(f => f.endsWith('.jsonl') && !f.includes('subagent'))
    .map(f => path.join(SESSION_DIR, f))
    .sort();

  console.log(`Found ${sessions.length} session files\n`);

  let allSummaries = [];

  for (const session of sessions) {
    const summaries = await extractFromSession(session);
    allSummaries = allSummaries.concat(summaries);
  }

  // Sort by timestamp
  allSummaries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Write output
  let output = `# Prism Change Summaries\n\n`;
  output += `Extracted from ${sessions.length} Claude Code sessions.\n`;
  output += `Total summaries found: ${allSummaries.length}\n\n`;
  output += `---\n\n`;

  for (const summary of allSummaries) {
    output += `## ${summary.timestamp}\n`;
    output += `*Session: ${summary.session}*\n\n`;
    output += summary.content;
    output += `\n\n---\n\n`;
  }

  // Ensure docs directory exists
  const docsDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWrote ${allSummaries.length} summaries to ${OUTPUT_FILE}`);
}

main().catch(console.error);
