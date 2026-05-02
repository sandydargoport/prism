/**
 * Zod schemas for validating API request bodies.
 * Use these in API routes to ensure type-safe input.
 */

import { z } from 'zod';
import { DAYS_OF_WEEK } from '@/lib/constants/days';

// COMMON SCHEMAS

export const uuidSchema = z.string().uuid();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');
export const isoDateSchema = z.string().datetime();

// EVENT SCHEMAS

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

// TASK SCHEMAS

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  assignedTo: uuidSchema.optional(),
  dueDate: isoDateSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().max(100).optional(),
  createdBy: uuidSchema.optional(),
  listId: uuidSchema.optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  completed: z.boolean().optional(),
});

// CHORE SCHEMAS

export const createChoreSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  category: z.enum(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other']),
  assignedTo: uuidSchema.optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom']),
  customIntervalDays: z.number().int().min(1).max(365).optional(),
  startDay: z.string().max(10).optional().nullable(),
  pointValue: z.number().int().min(0).max(1000).optional().default(0),
  requiresApproval: z.boolean().optional().default(false),
  createdBy: uuidSchema.optional(),
  // Optional initial due date/time. When omitted, server computes nextDue
  // from frequency.
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  nextDueTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)').nullable().optional(),
});

export const updateChoreSchema = createChoreSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const completeChoreSchema = z.object({
  completedBy: uuidSchema,
  photoUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

// SHOPPING SCHEMAS

export const createShoppingListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
  color: hexColorSchema.optional(),
  listType: z.enum(['grocery', 'hardware', 'general', 'other']).optional(),
  sortOrder: z.number().int().optional(),
  visibleCategories: z.array(z.string().max(100)).nullable().optional(),
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
  category: z.string().max(50).optional(),
  recurring: z.boolean().optional().default(false),
  recurrenceInterval: z.enum(['weekly', 'monthly']).optional(),
  addedBy: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const updateShoppingItemSchema = createShoppingItemSchema.partial().extend({
  checked: z.boolean().optional(),
});

// MEAL SCHEMAS

export const createMealSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(5000).optional(),
  recipe: z.string().max(20000).optional(),
  recipeUrl: z.string().url().optional(),
  recipeId: uuidSchema.optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  ingredients: z.string().max(5000).optional(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  // HH:mm time-of-day for time-grid placement; nullable to allow clearing.
  mealTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)').nullable().optional(),
  source: z.enum(['internal', 'external']).optional().default('internal'),
  sourceId: z.string().max(255).optional(),
  createdBy: uuidSchema.optional(),
});

export const updateMealSchema = createMealSchema.partial().extend({
  cookedBy: uuidSchema.nullable().optional(),
});

// MESSAGE SCHEMAS

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

// MAINTENANCE SCHEMAS

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

// BIRTHDAY SCHEMAS

export const createBirthdaySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  userId: uuidSchema.optional(),
  giftIdeas: z.string().max(2000).optional(),
  sendCardDaysBefore: z.number().int().min(0).max(30).optional().default(7),
});

// WISH ITEM SCHEMAS

export const createWishItemSchema = z.object({
  memberId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url().or(z.literal('')).optional(),
  notes: z.string().max(1000).optional(),
  addedBy: uuidSchema.optional(),
});

export const updateWishItemSchema = createWishItemSchema.partial();

// GIFT IDEA SCHEMAS

export const createGiftIdeaSchema = z.object({
  forUserId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url().or(z.literal('')).optional(),
  notes: z.string().max(1000).optional(),
  price: z.string().max(20).optional(),
});

export const updateGiftIdeaSchema = createGiftIdeaSchema.partial();

// WISH ITEM SOURCE SCHEMAS

export const createWishItemSourceSchema = z.object({
  memberId: uuidSchema,
  provider: z.string().min(1).max(50),
  externalListId: z.string().min(1).max(255),
  externalListName: z.string().max(255).optional(),
  syncEnabled: z.boolean().optional().default(true),
});

export const updateWishItemSourceSchema = z.object({
  syncEnabled: z.boolean().optional(),
  externalListName: z.string().max(255).optional(),
});

export const finalizeWishItemSourceSchema = z.object({
  memberId: uuidSchema,
  externalListId: z.string().min(1).max(255),
  externalListName: z.string().max(255).optional(),
});

// GOAL SCHEMAS

export const createGoalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  pointCost: z.number().int().min(1, 'Point cost must be at least 1').max(10000),
  emoji: z.string().max(10).optional(),
  priority: z.number().int().min(0).optional(),
  recurring: z.boolean().optional().default(false),
  recurrencePeriod: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  active: z.boolean().optional().default(true),
});

export const updateGoalSchema = createGoalSchema.partial();

// BUS ROUTE SCHEMAS

export const createBusRouteSchema = z.object({
  studentName: z.string().min(1, 'Student name is required').max(100),
  userId: uuidSchema.optional(),
  tripId: z.string().min(1, 'Trip ID is required').max(50),
  direction: z.enum(['AM', 'PM']),
  label: z.string().min(1, 'Label is required').max(255),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  activeDays: z.array(z.number().int().min(0).max(6)).optional().default([1, 2, 3, 4, 5]),
  checkpoints: z.array(z.object({
    name: z.string().min(1).max(255),
    sortOrder: z.number().int().min(0),
  })).optional().default([]),
  stopName: z.string().max(255).optional(),
  schoolName: z.string().max(255).optional(),
  enabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateBusRouteSchema = createBusRouteSchema.partial();

// CALENDAR NOTE SCHEMAS

export const upsertCalendarNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  content: z.string().max(10000),
});

export const calendarNotesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// API TOKEN SCHEMAS

/**
 * Known token scopes. `*` grants full account access (the legacy default).
 * `voice` is restricted to the `/api/v1/voice/*` namespace. New scopes
 * should be added here AND enforced by `withAuth({ tokenScope: ... })`
 * on the endpoints they cover.
 */
export const TOKEN_SCOPES = ['*', 'voice'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const createApiTokenSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  scopes: z
    .array(z.enum(TOKEN_SCOPES))
    .min(1, 'At least one scope is required')
    .optional()
    .default(['*']),
});

// LAYOUT SCHEMAS

const widgetConfigSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  visible: z.boolean().optional().default(true),
  backgroundColor: z.string().optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  outlineColor: z.string().optional(),
  outlineOpacity: z.number().min(0).max(1).optional(),
  textColor: z.string().optional(),
  textOpacity: z.number().min(0).max(1).optional(),
  textScale: z.number().min(0.5).max(3).optional(),
  gridLineOpacity: z.number().min(0).max(1).optional(),
  cellBackgroundColor: z.string().optional(),
  cellBackgroundOpacity: z.number().min(0).max(1).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const createLayoutSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional(),
  isDefault: z.boolean().optional().default(false),
  widgets: z.array(widgetConfigSchema).min(1, 'At least one widget is required'),
  screensaverWidgets: z.array(widgetConfigSchema).nullable().optional(),
  orientation: z.enum(['landscape', 'portrait']).optional().default('landscape'),
  fontScale: z.number().int().min(50).max(200).nullable().optional(),
  createdBy: uuidSchema.optional(),
});

export const updateLayoutSchema = createLayoutSchema.partial();

// HELPER FUNCTION

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
