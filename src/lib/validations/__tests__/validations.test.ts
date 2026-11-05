import fs from 'node:fs';
import path from 'node:path';
import {
  createEventSchema,
  createTaskSchema,
  createChoreSchema,
  createShoppingItemSchema,
  createMealSchema,
  createMessageSchema,
  createGoalSchema,
  createBirthdaySchema,
  createApiTokenSchema,
  createLayoutSchema,
  updateLayoutSchema,
  hexColorSchema,
  uuidSchema,
  validateRequest,
} from '../index';

describe('hexColorSchema', () => {
  it('accepts valid hex colors', () => {
    expect(hexColorSchema.safeParse('#3B82F6').success).toBe(true);
    expect(hexColorSchema.safeParse('#000000').success).toBe(true);
    expect(hexColorSchema.safeParse('#FFFFFF').success).toBe(true);
    expect(hexColorSchema.safeParse('#abcdef').success).toBe(true);
  });

  it('rejects invalid hex colors', () => {
    expect(hexColorSchema.safeParse('red').success).toBe(false);
    expect(hexColorSchema.safeParse('#GGG').success).toBe(false);
    expect(hexColorSchema.safeParse('#12345').success).toBe(false);
    expect(hexColorSchema.safeParse('3B82F6').success).toBe(false); // missing #
    expect(hexColorSchema.safeParse('#3B82F6FF').success).toBe(false); // too long
  });
});

describe('uuidSchema', () => {
  it('accepts valid UUIDs', () => {
    expect(uuidSchema.safeParse('4b487cc7-fb42-4f7b-bdd5-c02393fa468f').success).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(uuidSchema.safeParse('').success).toBe(false);
  });
});

describe('createEventSchema', () => {
  const validEvent = {
    title: 'Meeting',
    startTime: '2026-03-01T10:00:00.000Z',
    endTime: '2026-03-01T11:00:00.000Z',
  };

  it('accepts valid event', () => {
    expect(createEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(createEventSchema.safeParse({ ...validEvent, title: '' }).success).toBe(false);
  });

  it('rejects endTime before startTime', () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      endTime: '2026-03-01T09:00:00.000Z', // before start
    });
    expect(result.success).toBe(false);
  });

  it('accepts endTime equal to startTime', () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      endTime: validEvent.startTime,
    });
    expect(result.success).toBe(true);
  });
});

describe('createTaskSchema', () => {
  it('accepts minimal task', () => {
    expect(createTaskSchema.safeParse({ title: 'Do thing' }).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('accepts all optional fields', () => {
    const result = createTaskSchema.safeParse({
      title: 'Task',
      description: 'Details',
      priority: 'high',
      category: 'work',
      assignedTo: '4b487cc7-fb42-4f7b-bdd5-c02393fa468f',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid priority', () => {
    expect(createTaskSchema.safeParse({ title: 'Task', priority: 'urgent' }).success).toBe(false);
  });
});

describe('createChoreSchema', () => {
  const validChore = {
    title: 'Clean room',
    category: 'cleaning',
    frequency: 'weekly',
  };

  it('accepts valid chore', () => {
    expect(createChoreSchema.safeParse(validChore).success).toBe(true);
  });

  it('rejects invalid category', () => {
    expect(createChoreSchema.safeParse({ ...validChore, category: 'swimming' }).success).toBe(false);
  });

  it('rejects invalid frequency', () => {
    expect(createChoreSchema.safeParse({ ...validChore, frequency: 'hourly' }).success).toBe(false);
  });

  it('accepts all valid categories', () => {
    for (const cat of ['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other']) {
      expect(createChoreSchema.safeParse({ ...validChore, category: cat }).success).toBe(true);
    }
  });

  it('accepts all valid frequencies', () => {
    for (const freq of ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom']) {
      expect(createChoreSchema.safeParse({ ...validChore, frequency: freq }).success).toBe(true);
    }
  });
});

describe('createShoppingItemSchema', () => {
  it('accepts valid item', () => {
    const result = createShoppingItemSchema.safeParse({
      listId: '4b487cc7-fb42-4f7b-bdd5-c02393fa468f',
      name: 'Milk',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    expect(createShoppingItemSchema.safeParse({ name: 'Milk' }).success).toBe(false);
  });

  // Note: shopping categories are intentionally flexible — users can create
  // custom categories. The schema accepts any string up to 100 chars; no enum.
});

describe('createMealSchema', () => {
  const validMeal = {
    name: 'Pasta',
    weekOf: '2026-03-01',
    dayOfWeek: 'monday',
    mealType: 'dinner',
  };

  it('accepts valid meal', () => {
    expect(createMealSchema.safeParse(validMeal).success).toBe(true);
  });

  it('rejects invalid weekOf format', () => {
    expect(createMealSchema.safeParse({ ...validMeal, weekOf: 'March 1' }).success).toBe(false);
  });

  it('rejects invalid dayOfWeek', () => {
    expect(createMealSchema.safeParse({ ...validMeal, dayOfWeek: 'someday' }).success).toBe(false);
  });

  it('rejects invalid mealType', () => {
    expect(createMealSchema.safeParse({ ...validMeal, mealType: 'brunch' }).success).toBe(false);
  });
});

describe('createMessageSchema', () => {
  it('accepts valid message', () => {
    const result = createMessageSchema.safeParse({
      message: 'Hello!',
      authorId: '4b487cc7-fb42-4f7b-bdd5-c02393fa468f',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = createMessageSchema.safeParse({
      message: '',
      authorId: '4b487cc7-fb42-4f7b-bdd5-c02393fa468f',
    });
    expect(result.success).toBe(false);
  });

  it('rejects message over 1000 chars', () => {
    const result = createMessageSchema.safeParse({
      message: 'x'.repeat(1001),
      authorId: '4b487cc7-fb42-4f7b-bdd5-c02393fa468f',
    });
    expect(result.success).toBe(false);
  });
});

describe('createGoalSchema', () => {
  it('accepts valid goal', () => {
    const result = createGoalSchema.safeParse({
      name: 'Pizza Night',
      pointCost: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects pointCost of 0', () => {
    const result = createGoalSchema.safeParse({
      name: 'Goal',
      pointCost: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative pointCost', () => {
    const result = createGoalSchema.safeParse({
      name: 'Goal',
      pointCost: -5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts recurring with period', () => {
    const result = createGoalSchema.safeParse({
      name: 'Weekly Treat',
      pointCost: 20,
      recurring: true,
      recurrencePeriod: 'weekly',
    });
    expect(result.success).toBe(true);
  });
});

describe('createBirthdaySchema', () => {
  it('accepts valid birthday', () => {
    const result = createBirthdaySchema.safeParse({
      name: 'Grandma',
      birthDate: '1950-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = createBirthdaySchema.safeParse({
      name: 'Bob',
      birthDate: 'June 15',
    });
    expect(result.success).toBe(false);
  });
});

describe('createApiTokenSchema', () => {
  it('accepts valid token name', () => {
    expect(createApiTokenSchema.safeParse({ name: 'Home Assistant' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createApiTokenSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(createApiTokenSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });
});

describe('createLayoutSchema', () => {
  const validLayout = {
    name: 'Kitchen',
    widgets: [{ i: 'clock', x: 0, y: 0, w: 2, h: 2 }],
  };

  it('accepts valid layout', () => {
    expect(createLayoutSchema.safeParse(validLayout).success).toBe(true);
  });

  it('rejects empty widgets array', () => {
    expect(createLayoutSchema.safeParse({ ...validLayout, widgets: [] }).success).toBe(false);
  });

  it('rejects invalid slug characters', () => {
    expect(createLayoutSchema.safeParse({ ...validLayout, slug: 'My Kitchen!' }).success).toBe(false);
  });

  it('accepts valid slug', () => {
    expect(createLayoutSchema.safeParse({ ...validLayout, slug: 'my-kitchen' }).success).toBe(true);
  });

  // The idle background (#782) and calm mode's ticks (#691). Unknown keys are
  // stripped, so a field missing from the schema would be silently dropped on
  // every save.
  it('keeps the idle background and each widget\'s show-when-idle tick', () => {
    const idleBackground = {
      day: 'dashboard', night: 'sky', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 },
    } as const;
    const parsed = createLayoutSchema.parse({
      ...validLayout,
      idleBackground,
      widgets: [{ i: 'clock', x: 0, y: 0, w: 2, h: 2, showWhenIdle: false }],
    });
    expect(parsed.idleBackground).toEqual(idleBackground);
    expect(parsed.widgets[0]!.showWhenIdle).toBe(false);
  });

  it('leaves the background unset when not given, so a new dashboard takes the column default', () => {
    expect(createLayoutSchema.parse(validLayout).idleBackground).toBeUndefined();
  });

  it('rejects an unknown idle background', () => {
    expect(createLayoutSchema.safeParse({ ...validLayout, idleBackground: { source: 'video' } }).success).toBe(false);
    expect(createLayoutSchema.safeParse({ ...validLayout, idleBackground: 'calm' }).success).toBe(false);
  });

  // GHSA-mrhx-c7xc-m3w5: a list whose every item fails builds one issue per
  // item, so a large enough body exhausts memory. With a limit on the list,
  // an oversized one is refused whole before any item is checked.
  it('refuses an oversized widget list with one issue, without checking each item', () => {
    const widgets = Array.from({ length: 200_000 }, () => 'not a widget');
    const result = createLayoutSchema.safeParse({ ...validLayout, widgets });
    expect(result.success).toBe(false);
    expect(result.error!.issues).toHaveLength(1);
    expect(result.error!.issues[0]!.code).toBe('too_big');
  });
});
// How a dashboard is drawn (#907).
describe('layout view', () => {
  const base = { name: 'Kitchen', widgets: [{ i: 'clock', x: 0, y: 0, w: 4, h: 4 }] };
  it('accepts the grid and Today', () => {
    expect(createLayoutSchema.parse({ ...base, view: 'today' }).view).toBe('today');
    expect(createLayoutSchema.parse({ ...base, view: 'grid' }).view).toBe('grid');
  });
  it('refuses any other view', () => {
    expect(createLayoutSchema.safeParse({ ...base, view: 'freeform' }).success).toBe(false);
  });
  it('leaves the view unset when not given, so an update keeps it', () => {
    expect(createLayoutSchema.parse(base).view).toBeUndefined();
    expect(updateLayoutSchema.parse({ name: 'Kitchen' }).view).toBeUndefined();
  });
});


/**
 * Every list in a request schema needs a maximum, for the reason above: only a
 * limited list is refused before its items are checked. Reads the source, so a
 * new `z.array(...)` without `.max(...)` in its chain fails here.
 */
describe('request schemas limit every list', () => {
  const root = path.resolve(__dirname, '../../..');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  /** The chain of calls after the `z.array(...)` starting at `start`, e.g. `.min(1).max(9).optional()`. */
  function chainAfter(text: string, start: number): string {
    let i = text.indexOf('(', start);
    let depth = 0;
    do {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    } while (depth > 0 && i < text.length);
    const from = i;
    // Consume `.name(...)` links, allowing whitespace and newlines between them.
    for (;;) {
      const link = /^\s*\.\w+\(/.exec(text.slice(i));
      if (!link) break;
      i += link[0].length;
      depth = 1;
      while (depth > 0 && i < text.length) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        i++;
      }
    }
    return text.slice(from, i);
  }

  it('finds no z.array without a .max', () => {
    const unlimited: string[] = [];
    let seen = 0;
    for (const file of sourceFiles(root)) {
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes("from 'zod'")) continue;
      for (const match of text.matchAll(/\bz\.array\(/g)) {
        seen++;
        if (!/\.max\(/.test(chainAfter(text, match.index!))) {
          const line = text.slice(0, match.index).split('\n').length;
          unlimited.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(unlimited).toEqual([]);
  });
});

describe('validateRequest', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validateRequest(createTaskSchema, { title: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test');
    }
  });

  it('returns error for invalid input', () => {
    const result = validateRequest(createTaskSchema, { title: '' });
    expect(result.success).toBe(false);
  });
});

// An update writes only what the request sent. `.partial()` on a create schema
// keeps each field's `.default()`, so an edit that never mentioned a field
// wrote the create-time default over the stored value.
describe('update schemas leave out what the request left out', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const all = require('../index') as Record<string, unknown>;
  const updates = Object.entries(all).filter(([name]) => /^(update|patch)\w+Schema$/.test(name)) as [
    string,
    { safeParse: (v: unknown) => { success: boolean; data?: unknown } },
  ][];

  it('finds the update schemas', () => {
    expect(updates.map(([n]) => n)).toEqual(
      expect.arrayContaining(['updateLayoutSchema', 'updateChoreSchema', 'updateGoalSchema', 'updateBusRouteSchema', 'patchEventSchema']),
    );
  });

  it.each(updates)('%s adds no field to an empty update', (_name, schema) => {
    const parsed = schema.safeParse({});
    if (parsed.success) expect(parsed.data).toEqual({});
  });

  it('keeps a layout the default, and its orientation, when only its text size changes', () => {
    expect(all.updateLayoutSchema).toBeDefined();
    const { updateLayoutSchema } = all as { updateLayoutSchema: { parse: (v: unknown) => unknown } };
    expect(updateLayoutSchema.parse({ fontScale: 120 })).toEqual({ fontScale: 120 });
  });

  it('still fills the defaults in when creating', () => {
    const { createLayoutSchema: create } = all as { createLayoutSchema: { parse: (v: unknown) => Record<string, unknown> } };
    const made = create.parse({ name: 'Kitchen', widgets: [{ i: 'clock', x: 0, y: 0, w: 2, h: 2 }] });
    expect(made.isDefault).toBe(false);
    expect(made.orientation).toBe('landscape');
  });

  it('is what every PATCH route parses with', () => {
    const api = path.join(__dirname, '..', '..', '..', 'app', 'api');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === 'route.ts' && /create\w+Schema\.partial\(\)/.test(fs.readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(api);
    expect(offenders).toEqual([]);
  });
});
