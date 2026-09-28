import { formatTaskRow, formatMessageRow, formatMealRow } from '../formatters';

describe('formatTaskRow', () => {
  const baseRow = {
    id: 'task-1',
    title: 'Buy groceries',
    description: 'Get milk and eggs',
    dueDate: '2026-03-01',
    dueTime: '10:00',
    priority: 'high' as const,
    category: 'shopping',
    completed: false,
    completedAt: null,
    listId: 'list-1',
    taskSourceId: null,
    createdAt: new Date('2026-02-20T08:00:00Z'),
    updatedAt: new Date('2026-02-20T09:00:00Z'),
    assignedUserId: 'user-1',
    assignedUserName: 'Alex',
    assignedUserColor: '#3B82F6',
    assignedUserAvatar: '/avatars/alex.png',
  };

  it('converts timestamps to ISO strings and passes the due through', () => {
    const result = formatTaskRow(baseRow);
    expect(result.dueDate).toBe('2026-03-01');
    expect(result.dueTime).toBe('10:00');
    expect(result.createdAt).toBe('2026-02-20T08:00:00.000Z');
    expect(result.updatedAt).toBe('2026-02-20T09:00:00.000Z');
  });

  it('formats assigned user as nested object', () => {
    const result = formatTaskRow(baseRow);
    expect(result.assignedTo).toEqual({
      id: 'user-1',
      name: 'Alex',
      color: '#3B82F6',
      avatarUrl: '/avatars/alex.png',
    });
  });

  it('returns null for assignedTo when no user assigned', () => {
    const result = formatTaskRow({
      ...baseRow,
      assignedUserId: null,
      assignedUserName: null,
      assignedUserColor: null,
      assignedUserAvatar: null,
    });
    expect(result.assignedTo).toBeNull();
  });

  it('converts null dates to null strings', () => {
    const result = formatTaskRow({ ...baseRow, dueDate: null, dueTime: null, completedAt: null });
    expect(result.dueDate).toBeNull();
    expect(result.completedAt).toBeNull();
  });

  it('passes through scalar fields unchanged', () => {
    const result = formatTaskRow(baseRow);
    expect(result.id).toBe('task-1');
    expect(result.title).toBe('Buy groceries');
    expect(result.completed).toBe(false);
    expect(result.priority).toBe('high');
  });
});

describe('formatMessageRow', () => {
  const baseRow = {
    id: 'msg-1',
    message: 'Hello family!',
    pinned: true,
    important: false,
    expiresAt: new Date('2026-03-01T00:00:00Z'),
    createdAt: new Date('2026-02-20T12:00:00Z'),
    authorId: 'user-1',
    authorName: 'Jordan',
    authorColor: '#EC4899',
    authorAvatar: null,
  };

  it('nests author data', () => {
    const result = formatMessageRow(baseRow);
    expect(result.author).toEqual({
      id: 'user-1',
      name: 'Jordan',
      color: '#EC4899',
      avatarUrl: null,
    });
  });

  it('converts expiresAt date to ISO string', () => {
    const result = formatMessageRow(baseRow);
    expect(result.expiresAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('handles null expiresAt', () => {
    const result = formatMessageRow({ ...baseRow, expiresAt: null });
    expect(result.expiresAt).toBeNull();
  });

  it('preserves boolean fields', () => {
    const result = formatMessageRow(baseRow);
    expect(result.pinned).toBe(true);
    expect(result.important).toBe(false);
  });
});

describe('formatMealRow', () => {
  const baseRow = {
    id: 'meal-1',
    name: 'Spaghetti',
    description: null,
    recipe: null,
    recipeUrl: null,
    recipeId: null,
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    ingredients: 'pasta, sauce',
    dayOfWeek: 'monday',
    mealType: 'dinner',
    cookedAt: null,
    cookedById: null,
    weekOf: '2026-02-16',
    source: 'internal',
    sourceId: null,
    createdAt: new Date('2026-02-15T08:00:00Z'),
    updatedAt: new Date('2026-02-15T09:00:00Z'),
    createdById: 'user-1',
    createdByName: 'Alex',
    createdByColor: '#3B82F6',
    cookedByUserId: null,
    cookedByUserName: null,
    cookedByUserColor: null,
  };

  it('nests createdBy user data', () => {
    const result = formatMealRow(baseRow);
    expect(result.createdBy).toEqual({
      id: 'user-1',
      name: 'Alex',
      color: '#3B82F6',
    });
  });

  it('returns null for cookedBy when not set', () => {
    const result = formatMealRow(baseRow);
    expect(result.cookedBy).toBeNull();
  });

  it('nests cookedBy when set', () => {
    const result = formatMealRow({
      ...baseRow,
      cookedByUserId: 'user-2',
      cookedByUserName: 'Jordan',
      cookedByUserColor: '#EC4899',
    });
    expect(result.cookedBy).toEqual({
      id: 'user-2',
      name: 'Jordan',
      color: '#EC4899',
    });
  });

  it('returns null for createdBy when not set', () => {
    const result = formatMealRow({
      ...baseRow,
      createdById: null,
      createdByName: null,
      createdByColor: null,
    });
    expect(result.createdBy).toBeNull();
  });

  it('includes updatedAt when present', () => {
    const result = formatMealRow(baseRow);
    expect(result.updatedAt).toBe('2026-02-15T09:00:00.000Z');
  });

  it('omits updatedAt when undefined', () => {
    const { updatedAt: _, ...rowWithout } = baseRow;
    const result = formatMealRow(rowWithout as typeof baseRow);
    expect('updatedAt' in result).toBe(false);
  });
});
