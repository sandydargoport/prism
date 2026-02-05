## Code Standards

### Comment Philosophy

Write comments that explain **why**, not **what**. The code should be self-documenting through clear naming and structure. Comments are for:

- Non-obvious business logic or domain knowledge
- Workarounds with links to issues or explanations
- Performance considerations that aren't immediately apparent
- API contracts and constraints

Avoid:
- Restating what the code does (`// increment counter` above `counter++`)
- Tutorial-style explanations of language features or frameworks
- Section banner separators (`// ====...====`)
- Commented-out code (delete it; git has history)

### Function Documentation

Use JSDoc for public APIs and exported functions. Keep it concise:

```typescript
/**
 * Syncs events from Google Calendar to local database.
 * Uses incremental sync when syncToken is provided.
 *
 * @throws {SyncError} On auth failure or network timeout
 */
async function syncGoogleCalendar(
  calendarId: string,
  syncToken?: string
): Promise<Event[]>
```

Skip JSDoc for internal/private functions where the signature is self-explanatory.

### Interface Documentation

Document non-obvious fields. Skip obvious ones:

```typescript
interface CalendarWidgetProps {
  size: 'small' | 'medium' | 'large';
  maxEvents?: number;
  /** Null means show all calendars */
  calendarIds?: string[] | null;
}
```

### Inline Comments

Reserve for genuinely tricky logic:

```typescript
// OAuth tokens expire 1 hour after issue; refresh 5 min early to avoid race conditions
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Intentionally mutating here for performance — this array is never shared
items.sort((a, b) => a.priority - b.priority);
```

### File Organization

No file header comments required. The filename and exports should make the purpose clear. If a file needs a header comment to explain what it does, consider renaming it or restructuring.
