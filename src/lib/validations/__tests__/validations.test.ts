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
