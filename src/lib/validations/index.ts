/**
 * ============================================================================
 * PRISM - API Validation Schemas
 * ============================================================================
 * Zod schemas for validating API request bodies.
 * Use these in API routes to ensure type-safe input.
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');
export const isoDateSchema = z.string().datetime();

// ============================================================================
// EVENT SCHEMAS
// ============================================================================

const eventBaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  location: z.string().max(255).optional(),
  startTime: isoDateSchema,
  endTime: isoDateSchema,
  allDay: z.boolean().optional().default(false),
  calendarSourceId: uuidSchema.optional(),
  recurring: z.boolean().optional().default(false),
  recurrenceRule: z.string().max(500).optional(),
  color: hexColorSchema.optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(), // max 1 week
  createdBy: uuidSchema.optional(),
});

export const createEventSchema = eventBaseSchema.refine(
  data => new Date(data.endTime) >= new Date(data.startTime),
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export const updateEventSchema = eventBaseSchema.partial();

// ============================================================================
// TASK SCHEMAS
// ============================================================================

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  assignedTo: uuidSchema.optional(),
  dueDate: isoDateSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().max(100).optional(),
  createdBy: uuidSchema.optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  completed: z.boolean().optional(),
});

// ============================================================================
// CHORE SCHEMAS
// ============================================================================

export const createChoreSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  category: z.enum(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other']),
  assignedTo: uuidSchema.optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']),
  customIntervalDays: z.number().int().min(1).max(365).optional(),
  pointValue: z.number().int().min(0).max(1000).optional().default(0),
  requiresApproval: z.boolean().optional().default(false),
  createdBy: uuidSchema.optional(),
});

export const updateChoreSchema = createChoreSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const completeChoreSchema = z.object({
  completedBy: uuidSchema,
  photoUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// SHOPPING SCHEMAS
// ============================================================================

export const createShoppingListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
  color: hexColorSchema.optional(),
  sortOrder: z.number().int().optional(),
  // Who this list is assigned to (only they can check off items)
  // Null/undefined means anyone can check off items (family list)
  assignedTo: uuidSchema.optional(),
  createdBy: uuidSchema.optional(),
});

export const createShoppingItemSchema = z.object({
  listId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(50).optional(),
  category: z.enum(['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'household', 'other']).optional(),
  recurring: z.boolean().optional().default(false),
  recurrenceInterval: z.enum(['weekly', 'monthly']).optional(),
  addedBy: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const updateShoppingItemSchema = createShoppingItemSchema.partial().extend({
  checked: z.boolean().optional(),
});

// ============================================================================
// MEAL SCHEMAS
// ============================================================================

export const createMealSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(5000).optional(),
  recipe: z.string().max(20000).optional(),
  recipeUrl: z.string().url().optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  ingredients: z.string().max(5000).optional(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  source: z.enum(['internal', 'external']).optional().default('internal'),
  sourceId: z.string().max(255).optional(),
  createdBy: uuidSchema.optional(),
});

export const updateMealSchema = createMealSchema.partial().extend({
  cookedBy: uuidSchema.optional(),
});

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

export const createMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000),
  authorId: uuidSchema,
  pinned: z.boolean().optional().default(false),
  important: z.boolean().optional().default(false),
  expiresAt: isoDateSchema.optional(),
});

export const updateMessageSchema = z.object({
  message: z.string().min(1).max(1000).optional(),
  pinned: z.boolean().optional(),
  important: z.boolean().optional(),
  expiresAt: isoDateSchema.nullable().optional(),
});

// ============================================================================
// MAINTENANCE SCHEMAS
// ============================================================================

export const createMaintenanceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  category: z.enum(['car', 'home', 'appliance', 'yard', 'other']),
  description: z.string().max(2000).optional(),
  schedule: z.enum(['monthly', 'quarterly', 'annually', 'custom']),
  customIntervalDays: z.number().int().positive().optional(),
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  assignedTo: uuidSchema.optional(),
  notes: z.string().max(2000).optional(),
  createdBy: uuidSchema.optional(),
});

export const completeMaintenanceSchema = z.object({
  completedBy: uuidSchema.optional(),
  cost: z.number().positive().optional(),
  vendor: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

// ============================================================================
// BIRTHDAY SCHEMAS
// ============================================================================

export const createBirthdaySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  userId: uuidSchema.optional(),
  giftIdeas: z.string().max(2000).optional(),
  sendCardDaysBefore: z.number().int().min(0).max(30).optional().default(7),
});

// ============================================================================
// LAYOUT SCHEMAS
// ============================================================================

const widgetConfigSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  visible: z.boolean().optional().default(true),
  settings: z.record(z.unknown()).optional(),
});

export const createLayoutSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  isDefault: z.boolean().optional().default(false),
  displayId: z.string().max(100).optional(),
  widgets: z.array(widgetConfigSchema).min(1, 'At least one widget is required'),
  createdBy: uuidSchema.optional(),
});

export const updateLayoutSchema = createLayoutSchema.partial();

// ============================================================================
// HELPER FUNCTION
// ============================================================================

/**
 * Validates request body and returns parsed data or error response
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
