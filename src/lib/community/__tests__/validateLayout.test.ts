import {
  validateCommunityLayout,
  type CommunityLayoutData,
  type CommunityIndexEntry,
} from '../validateLayout';

// Helper to build a valid layout
function makeLayout(overrides: Partial<CommunityLayoutData> = {}): CommunityLayoutData {
  return {
    type: 'prism-layout',
    version: 2,
    mode: 'dashboard',
    name: 'Test Layout',
    description: 'A test layout for validation',
    author: 'Tester',
    tags: ['test'],
    screenSizes: ['2560x1440'],
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
      { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
      { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
      { i: 'tasks', x: 24, y: 12, w: 24, h: 20 },
    ],
    ...overrides,
  };
}

describe('validateCommunityLayout', () => {
  // --- Schema validation ---
  describe('schema validation', () => {
    it('accepts a valid layout', () => {
      const result = validateCommunityLayout(makeLayout());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects null/undefined input', () => {
      expect(validateCommunityLayout(null).valid).toBe(false);
      expect(validateCommunityLayout(undefined).valid).toBe(false);
    });

    it('rejects non-object input', () => {
      expect(validateCommunityLayout('string').valid).toBe(false);
      expect(validateCommunityLayout(42).valid).toBe(false);
    });

    it('rejects missing type field', () => {
      const layout = makeLayout();
      delete (layout as unknown as Record<string, unknown>).type;
      const result = validateCommunityLayout(layout);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "type" field. Expected "prism-layout".');
    });

    it('rejects invalid type field', () => {
      const result = validateCommunityLayout({ ...makeLayout(), type: 'wrong' as 'prism-layout' });
      expect(result.valid).toBe(false);
    });

    it('rejects missing version', () => {
      const layout = makeLayout();
      delete (layout as unknown as Record<string, unknown>).version;
      const result = validateCommunityLayout(layout);
      expect(result.valid).toBe(false);
    });

    it('accepts version 1', () => {
      const result = validateCommunityLayout(makeLayout({ version: 1 }));
      expect(result.valid).toBe(true);
    });

    it('accepts version 2', () => {
      const result = validateCommunityLayout(makeLayout({ version: 2 }));
      expect(result.valid).toBe(true);
    });

    it('rejects invalid mode', () => {
      const result = validateCommunityLayout({ ...makeLayout(), mode: 'invalid' as 'dashboard' });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array widgets', () => {
      const result = validateCommunityLayout({ ...makeLayout(), widgets: 'not-array' as unknown as CommunityLayoutData['widgets'] });
      expect(result.valid).toBe(false);
    });
  });

  // --- Widget validation ---
  describe('widget validation', () => {
    it('rejects empty widget array', () => {
      const result = validateCommunityLayout(makeLayout({ widgets: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 1'))).toBe(true);
    });

    it('rejects invalid widget IDs', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'nonexistent_widget', x: 0, y: 32, w: 16, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent_widget'))).toBe(true);
    });

    it('rejects duplicate widget IDs', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'calendar', x: 0, y: 32, w: 24, h: 16 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate widget'))).toBe(true);
    });

    it('rejects widget with missing properties', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12 } as CommunityLayoutData['widgets'][0],
        ],
      }));
      expect(result.valid).toBe(false);
    });
  });

  // --- Bounds checks ---
  describe('bounds checks', () => {
    it('rejects negative x', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: -1, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('x >= 0'))).toBe(true);
    });

    it('rejects negative y', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: -1, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
    });

    it('rejects x + w > 48', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 32, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 0, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 12, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('x + w <= 48'))).toBe(true);
    });

    it('rejects w < 1', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 0, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('w >= 1'))).toBe(true);
    });

    it('rejects h < 1', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 0 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
    });

    it('rejects widgets extending beyond y=120', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 104, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('y=120'))).toBe(true);
    });
  });

  // --- Minimum size constraints ---
  describe('minimum size constraints', () => {
    it('rejects widget below minW', () => {
      // calendar minW is 12
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 8, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('minW'))).toBe(true);
    });

    it('rejects widget below minH', () => {
      // calendar minH is 8
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 4 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('minH'))).toBe(true);
    });
  });

  // --- Overlap detection ---
  describe('overlap detection', () => {
    it('rejects overlapping widgets', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 28, h: 32 },
          { i: 'clock', x: 20, y: 0, w: 16, h: 16 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'tasks', x: 0, y: 32, w: 16, h: 16 },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('overlap'))).toBe(true);
    });

    it('accepts adjacent (non-overlapping) widgets', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'tasks', x: 24, y: 12, w: 24, h: 20 },
        ],
      }));
      expect(result.valid).toBe(true);
    });
  });

  // --- Community submission metadata ---
  describe('community submission metadata', () => {
    it('requires name (1-100 chars) for community submission', () => {
      const result = validateCommunityLayout(makeLayout({ name: '' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('rejects name longer than 100 chars', () => {
      const result = validateCommunityLayout(makeLayout({ name: 'x'.repeat(101) }), { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('requires non-empty description for community submission', () => {
      const result = validateCommunityLayout(makeLayout({ description: '' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('requires author (1-50 chars) for community submission', () => {
      const result = validateCommunityLayout(makeLayout({ author: '' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('rejects author longer than 50 chars', () => {
      const result = validateCommunityLayout(makeLayout({ author: 'x'.repeat(51) }), { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('requires at least one screenSize for community submission', () => {
      const result = validateCommunityLayout(makeLayout({ screenSizes: [] }), { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('requires orientation for community submission', () => {
      const layout = makeLayout();
      delete (layout as unknown as Record<string, unknown>).orientation;
      const result = validateCommunityLayout(layout, { communitySubmission: true });
      expect(result.valid).toBe(false);
    });

    it('does not require metadata fields for non-community validation', () => {
      const result = validateCommunityLayout(makeLayout({ name: '', description: '', author: '' }));
      expect(result.valid).toBe(true);
    });

    it('requires at least 3 visible widgets for community submission', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'clock', x: 0, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 12, y: 0, w: 12, h: 12 },
        ],
      }), { communitySubmission: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 3'))).toBe(true);
    });
  });

  // --- Profanity filter ---
  describe('profanity filter', () => {
    it('rejects profanity in name', () => {
      const result = validateCommunityLayout(makeLayout({ name: 'My shit layout' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Content policy'))).toBe(true);
    });

    it('rejects profanity in description', () => {
      const result = validateCommunityLayout(makeLayout({ description: 'A damn good layout' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Content policy'))).toBe(true);
    });

    it('rejects profanity in author', () => {
      const result = validateCommunityLayout(makeLayout({ author: 'asshole123' }), { communitySubmission: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Content policy'))).toBe(true);
    });

    it('allows clean content', () => {
      const result = validateCommunityLayout(makeLayout({
        name: 'Family Dashboard',
        description: 'A great layout',
        author: 'Prism User',
      }), { communitySubmission: true });
      expect(result.valid).toBe(true);
    });
  });

  // --- Duplicate detection ---
  describe('duplicate detection', () => {
    const existingLayouts: CommunityIndexEntry[] = [
      {
        id: 'existing-layout',
        file: 'dashboard/existing.json',
        name: 'Existing Layout',
        description: 'An existing layout',
        author: 'Prism',
        mode: 'dashboard',
        tags: [],
        screenSizes: ['2560x1440'],
        orientation: 'landscape',
        widgetCount: 4,
        createdAt: '2026-01-01',
      },
    ];

    const existingWidgets = [
      { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
      { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
      { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
      { i: 'tasks', x: 24, y: 12, w: 24, h: 20 },
    ];

    it('rejects exact duplicate of existing layout', () => {
      const result = validateCommunityLayout(makeLayout(), {
        communitySubmission: true,
        existingLayouts,
        existingWidgetSets: [existingWidgets],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate') || e.includes('Duplicate'))).toBe(true);
    });

    it('rejects near-duplicate (>85% overlap)', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'tasks', x: 24, y: 12, w: 24, h: 24 }, // Slightly different h
        ],
      }), {
        communitySubmission: true,
        existingLayouts,
        existingWidgetSets: [existingWidgets],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('similar') || e.includes('Similar'))).toBe(true);
    });

    it('accepts sufficiently different layout', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'meals', x: 0, y: 0, w: 32, h: 24 },
          { i: 'shopping', x: 0, y: 24, w: 24, h: 24 },
          { i: 'clock', x: 32, y: 0, w: 16, h: 12 },
          { i: 'weather', x: 32, y: 12, w: 16, h: 12 },
        ],
      }), {
        communitySubmission: true,
        existingLayouts,
        existingWidgetSets: [existingWidgets],
      });
      expect(result.valid).toBe(true);
    });
  });

  // --- Warnings ---
  describe('warnings', () => {
    it('warns for very tall layouts (y+h > 96)', () => {
      const result = validateCommunityLayout(makeLayout({
        widgets: [
          { i: 'calendar', x: 0, y: 0, w: 24, h: 32 },
          { i: 'clock', x: 24, y: 0, w: 12, h: 12 },
          { i: 'weather', x: 36, y: 0, w: 12, h: 12 },
          { i: 'tasks', x: 0, y: 80, w: 16, h: 32 },
        ],
      }));
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('tall'))).toBe(true);
    });
  });

  // --- Screensaver mode ---
  describe('screensaver mode', () => {
    it('accepts a valid screensaver layout', () => {
      const result = validateCommunityLayout(makeLayout({
        mode: 'screensaver',
        widgets: [
          { i: 'clock', x: 32, y: 0, w: 16, h: 12 },
          { i: 'weather', x: 32, y: 12, w: 16, h: 8 },
          { i: 'messages', x: 0, y: 0, w: 16, h: 16 },
        ],
      }));
      expect(result.valid).toBe(true);
    });
  });
});
