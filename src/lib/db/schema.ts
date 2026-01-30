/**
 * ============================================================================
 * PRISM - Database Schema Definition
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Defines all database tables using Drizzle ORM.
 * Drizzle is a TypeScript-first ORM that provides:
 *   - Type-safe database queries
 *   - Automatic TypeScript type generation
 *   - SQL-like syntax that's easy to understand
 *   - Built-in migration support
 *
 * HOW DRIZZLE WORKS:
 * Instead of writing raw SQL like:
 *   CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(100), ...)
 *
 * We write TypeScript that describes the schema:
 *   export const users = pgTable('users', { id: uuid('id'), name: varchar('name', { length: 100 }) })
 *
 * Drizzle then:
 *   1. Creates TypeScript types from this schema
 *   2. Generates SQL migrations automatically
 *   3. Validates your queries at compile time
 *
 * TABLE NAMING CONVENTION:
 * - Tables: plural, snake_case (users, calendar_sources, shopping_items)
 * - Columns: snake_case (created_at, assigned_to)
 * - Primary Keys: 'id'
 * - Foreign Keys: referenced_table_id (user_id, chore_id)
 *
 * ============================================================================
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


// ============================================================================
// USERS TABLE
// ============================================================================
// Stores family members and their settings.
// Each person who uses the dashboard has a user record.
// ============================================================================

export const users = pgTable('users', {
  // Primary key - UUID for security (can't guess sequential IDs)
  id: uuid('id').defaultRandom().primaryKey(),

  // Display name (e.g., "Alex", "Jordan")
  name: varchar('name', { length: 100 }).notNull(),

  // Permission level - determines what they can do
  role: varchar('role', { length: 20 }).notNull()
    .$type<'parent' | 'child' | 'guest'>(),

  // Color for calendar/task display (hex format: "#3B82F6")
  color: varchar('color', { length: 7 }).notNull(),

  // Hashed PIN for authentication (bcrypt hash)
  // Nullable because guests don't have PINs
  pin: varchar('pin', { length: 255 }),

  // Email for notifications (optional)
  email: varchar('email', { length: 255 }),

  // Profile picture URL (optional)
  avatarUrl: text('avatar_url'),

  // User-specific preferences stored as JSON
  // Flexible schema for future additions
  preferences: jsonb('preferences').default({}).notNull(),

  // Timestamps for auditing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on email for faster lookups during login
  emailIdx: index('users_email_idx').on(table.email),
}));


// ============================================================================
// CALENDAR SOURCES TABLE
// ============================================================================
// Stores connections to external calendars (Google, Apple, etc.).
// Multiple external calendars can map to one dashboard calendar.
// ============================================================================

export const calendarSources = pgTable('calendar_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which user owns this calendar connection
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Calendar provider ("google", "apple", "microsoft", "caldav")
  provider: varchar('provider', { length: 50 }).notNull(),

  // ID of the calendar in the external system
  sourceCalendarId: varchar('source_calendar_id', { length: 255 }).notNull(),

  // Dashboard calendar name this maps to (e.g., "Alex's Calendar", "Family Calendar")
  dashboardCalendarName: varchar('dashboard_calendar_name', { length: 255 }).notNull(),

  // Display name (from the source, e.g., "Alex's Work Calendar")
  displayName: varchar('display_name', { length: 255 }),

  // Override color (if different from user color)
  color: varchar('color', { length: 7 }),

  // Whether this calendar is enabled/visible
  enabled: boolean('enabled').default(true).notNull(),

  // Whether this is a family-shared calendar (vs personal or unassigned)
  isFamily: boolean('is_family').default(false).notNull(),

  // OAuth tokens (encrypted in application layer)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // Sync tracking
  lastSynced: timestamp('last_synced'),
  syncErrors: jsonb('sync_errors'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for finding calendars by user
  userIdIdx: index('calendar_sources_user_id_idx').on(table.userId),
}));


// ============================================================================
// EVENTS TABLE
// ============================================================================
// Stores calendar events (synced from external sources or created locally).
// ============================================================================

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which calendar source this event belongs to
  calendarSourceId: uuid('calendar_source_id')
    .references(() => calendarSources.id, { onDelete: 'cascade' }),

  // ID from external system (for sync tracking)
  externalEventId: varchar('external_event_id', { length: 255 }),

  // Event details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 255 }),

  // Timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  allDay: boolean('all_day').default(false).notNull(),

  // Recurring events
  recurring: boolean('recurring').default(false).notNull(),
  recurrenceRule: text('recurrence_rule'), // iCal RRULE format

  // Who created this event (for locally-created events)
  createdBy: uuid('created_by').references(() => users.id),

  // Display color (inherits from calendar if not set)
  color: varchar('color', { length: 7 }),

  // Reminder in minutes before event
  reminderMinutes: integer('reminder_minutes'),

  // Sync tracking
  lastSynced: timestamp('last_synced'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for efficient date range queries
  startTimeIdx: index('events_start_time_idx').on(table.startTime),
  // Index for finding events by calendar
  calendarSourceIdx: index('events_calendar_source_idx').on(table.calendarSourceId),
}));


// ============================================================================
// TASKS TABLE
// ============================================================================
// Stores tasks (internal or synced from Microsoft To Do, etc.).
// ============================================================================

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id),

  // Due date (optional)
  dueDate: timestamp('due_date'),

  // Priority level
  priority: varchar('priority', { length: 20 })
    .$type<'high' | 'medium' | 'low'>(),

  // Category for filtering
  category: varchar('category', { length: 100 }),

  // Completion status
  completed: boolean('completed').default(false).notNull(),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id),

  // Source tracking (for sync)
  source: varchar('source', { length: 50 }).default('internal').notNull(),
  sourceId: varchar('source_id', { length: 255 }),
  lastSynced: timestamp('last_synced'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  assignedToIdx: index('tasks_assigned_to_idx').on(table.assignedTo),
  dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
}));


// ============================================================================
// CHORES TABLE
// ============================================================================
// Stores recurring chore definitions.
// ============================================================================

export const chores = pgTable('chores', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Category for organization
  category: varchar('category', { length: 50 }).notNull()
    .$type<'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other'>(),

  // Who this chore is assigned to (null = anyone can do it)
  assignedTo: uuid('assigned_to').references(() => users.id),

  // Frequency type
  frequency: varchar('frequency', { length: 20 }).notNull()
    .$type<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'>(),

  // For custom frequencies: number of days between occurrences
  customIntervalDays: integer('custom_interval_days'),

  // Tracking
  lastCompleted: timestamp('last_completed'),
  nextDue: date('next_due'),

  // Points/allowance earned for completing
  pointValue: integer('point_value').default(0).notNull(),

  // Does this need parent approval?
  requiresApproval: boolean('requires_approval').default(false).notNull(),

  // Is this chore active?
  enabled: boolean('enabled').default(true).notNull(),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nextDueIdx: index('chores_next_due_idx').on(table.nextDue),
}));


// ============================================================================
// CHORE COMPLETIONS TABLE
// ============================================================================
// Tracks when chores are completed and approved.
// ============================================================================

export const choreCompletions = pgTable('chore_completions', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which chore was completed
  choreId: uuid('chore_id')
    .references(() => chores.id, { onDelete: 'cascade' })
    .notNull(),

  // Who completed it
  completedBy: uuid('completed_by')
    .references(() => users.id)
    .notNull(),

  completedAt: timestamp('completed_at').defaultNow().notNull(),

  // Approval tracking
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),

  // Points awarded (might differ from chore default)
  pointsAwarded: integer('points_awarded'),

  // Optional photo proof URL
  photoUrl: text('photo_url'),

  // Optional notes
  notes: text('notes'),
}, (table) => ({
  choreIdIdx: index('chore_completions_chore_id_idx').on(table.choreId),
  completedAtIdx: index('chore_completions_completed_at_idx').on(table.completedAt),
}));


// ============================================================================
// SHOPPING LISTS TABLE
// ============================================================================
// Stores shopping list containers (Grocery, Hardware, etc.).
// ============================================================================

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').defaultRandom().primaryKey(),

  // List name ("Grocery", "Hardware", "Costco")
  name: varchar('name', { length: 100 }).notNull(),

  // Description (optional)
  description: text('description'),

  // Display icon (emoji or icon name)
  icon: varchar('icon', { length: 50 }),

  // Display color
  color: varchar('color', { length: 7 }),

  // Sort order for displaying lists
  sortOrder: integer('sort_order').default(0).notNull(),

  // Who this list is assigned to (only they can check off items)
  // Null means anyone can check off items (family list)
  assignedTo: uuid('assigned_to').references(() => users.id),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// ============================================================================
// SHOPPING ITEMS TABLE
// ============================================================================
// Stores individual shopping list items.
// ============================================================================

export const shoppingItems = pgTable('shopping_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which list this item belongs to
  listId: uuid('list_id')
    .references(() => shoppingLists.id, { onDelete: 'cascade' })
    .notNull(),

  // Item details
  name: varchar('name', { length: 255 }).notNull(),
  quantity: integer('quantity'),
  unit: varchar('unit', { length: 50 }), // "lbs", "oz", "gallon", "count"
  category: varchar('category', { length: 50 })
    .$type<'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other'>(),

  // Is this item checked off?
  checked: boolean('checked').default(false).notNull(),

  // Source tracking (for sync)
  source: varchar('source', { length: 50 }).default('internal').notNull(),
  sourceId: varchar('source_id', { length: 255 }),

  // Should this item be auto-added periodically?
  recurring: boolean('recurring').default(false).notNull(),
  recurrenceInterval: varchar('recurrence_interval', { length: 20 }), // "weekly", "monthly"

  // Who added this item
  addedBy: uuid('added_by').references(() => users.id),

  // Additional notes
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index('shopping_items_list_id_idx').on(table.listId),
  categoryIdx: index('shopping_items_category_idx').on(table.category),
}));


// ============================================================================
// MEALS TABLE
// ============================================================================
// Stores weekly meal plans.
// ============================================================================

export const meals = pgTable('meals', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Meal name
  name: varchar('name', { length: 255 }).notNull(),

  // Description (optional)
  description: text('description'),

  // Recipe information (optional)
  recipe: text('recipe'),
  recipeUrl: text('recipe_url'),

  // Cooking time tracking
  prepTime: integer('prep_time'), // minutes
  cookTime: integer('cook_time'), // minutes
  servings: integer('servings'),

  // Ingredients list
  ingredients: text('ingredients'),

  // Which week this meal is planned for
  weekOf: date('week_of').notNull(),

  // Day of week (monday, tuesday, etc.)
  dayOfWeek: varchar('day_of_week', { length: 20 }).notNull()
    .$type<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>(),

  // Meal type (breakfast, lunch, dinner, snack)
  mealType: varchar('meal_type', { length: 20 }).notNull()
    .$type<'breakfast' | 'lunch' | 'dinner' | 'snack'>(),

  // Cooking status
  cookedAt: timestamp('cooked_at'),
  cookedBy: uuid('cooked_by').references(() => users.id),

  // Source tracking (for Paprika sync)
  source: varchar('source', { length: 50 }).default('internal').notNull(),
  sourceId: varchar('source_id', { length: 255 }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  weekOfIdx: index('meals_week_of_idx').on(table.weekOf),
  dayOfWeekIdx: index('meals_day_of_week_idx').on(table.dayOfWeek),
}));


// ============================================================================
// FAMILY MESSAGES TABLE
// ============================================================================
// Stores messages on the family message board.
// ============================================================================

export const familyMessages = pgTable('family_messages', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Message content
  message: text('message').notNull(),

  // Who posted it
  authorId: uuid('author_id')
    .references(() => users.id)
    .notNull(),

  // Is this message pinned to the top?
  pinned: boolean('pinned').default(false).notNull(),

  // Is this an important/urgent message?
  important: boolean('important').default(false).notNull(),

  // When should this message auto-delete? (null = never)
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('family_messages_created_at_idx').on(table.createdAt),
}));


// ============================================================================
// MAINTENANCE REMINDERS TABLE
// ============================================================================
// Stores recurring home/car/appliance maintenance reminders.
// ============================================================================

export const maintenanceReminders = pgTable('maintenance_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull()
    .$type<'car' | 'home' | 'appliance' | 'yard' | 'other'>(),

  description: text('description'),

  // Schedule
  schedule: varchar('schedule', { length: 20 }).notNull()
    .$type<'monthly' | 'quarterly' | 'annually' | 'custom'>(),
  customIntervalDays: integer('custom_interval_days'),

  // Tracking
  lastCompleted: timestamp('last_completed'),
  nextDue: date('next_due').notNull(),

  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id),

  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nextDueIdx: index('maintenance_reminders_next_due_idx').on(table.nextDue),
}));


// ============================================================================
// MAINTENANCE COMPLETIONS TABLE
// ============================================================================
// Tracks when maintenance tasks are completed.
// ============================================================================

export const maintenanceCompletions = pgTable('maintenance_completions', {
  id: uuid('id').defaultRandom().primaryKey(),

  reminderId: uuid('reminder_id')
    .references(() => maintenanceReminders.id, { onDelete: 'cascade' })
    .notNull(),

  completedAt: timestamp('completed_at').defaultNow().notNull(),
  completedBy: uuid('completed_by').references(() => users.id),

  // Cost tracking (optional)
  cost: decimal('cost', { precision: 10, scale: 2 }),
  vendor: varchar('vendor', { length: 255 }),
  notes: text('notes'),
});


// ============================================================================
// BIRTHDAYS TABLE
// ============================================================================
// Stores birthday reminders.
// ============================================================================

export const birthdays = pgTable('birthdays', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Person's name
  name: varchar('name', { length: 100 }).notNull(),

  // Birth date (year for age calculation, or just month/day)
  birthDate: date('birth_date').notNull(),

  // Event type: birthday, anniversary, or milestone
  eventType: varchar('event_type', { length: 20 }).default('birthday').notNull(),

  // Link to family member (if applicable)
  userId: uuid('user_id').references(() => users.id),

  // Gift ideas (optional)
  giftIdeas: text('gift_ideas'),

  // How many days before to remind about sending card
  sendCardDaysBefore: integer('send_card_days_before').default(7),

  // Google Calendar sync source (null = manually created)
  googleCalendarSource: varchar('google_calendar_source', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// ============================================================================
// SETTINGS TABLE
// ============================================================================
// Stores application-wide settings as key-value pairs.
// ============================================================================

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Setting key (unique identifier)
  key: varchar('key', { length: 100 }).unique().notNull(),

  // Setting value (JSON for flexibility)
  value: jsonb('value').notNull(),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


// ============================================================================
// LAYOUTS TABLE
// ============================================================================
// Stores custom dashboard layouts.
// ============================================================================

export const layouts = pgTable('layouts', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Layout name
  name: varchar('name', { length: 100 }).notNull(),

  // Is this the default layout?
  isDefault: boolean('is_default').default(false).notNull(),

  // For multi-display setups: which display is this for?
  displayId: varchar('display_id', { length: 100 }),

  // Widget configuration (JSON array of widget objects)
  widgets: jsonb('widgets').notNull(),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


// ============================================================================
// API CREDENTIALS TABLE
// ============================================================================
// Stores encrypted API credentials for external services.
// ============================================================================

export const apiCredentials = pgTable('api_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Service name ("google", "apple", "enphase", "sonos")
  service: varchar('service', { length: 100 }).unique().notNull(),

  // Encrypted credentials (JSON object with service-specific fields)
  encryptedCredentials: text('encrypted_credentials').notNull(),

  // When do these credentials expire? (for OAuth tokens)
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


// ============================================================================
// RELATIONS
// ============================================================================
// Define relationships between tables for Drizzle's relation queries.
// These don't affect the database schema - they're for TypeScript types.
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  calendarSources: many(calendarSources),
  tasks: many(tasks),
  chores: many(chores),
  choreCompletions: many(choreCompletions),
  shoppingLists: many(shoppingLists),
  shoppingItems: many(shoppingItems),
  meals: many(meals),
  maintenanceReminders: many(maintenanceReminders),
  maintenanceCompletions: many(maintenanceCompletions),
  familyMessages: many(familyMessages),
}));

export const calendarSourcesRelations = relations(calendarSources, ({ one, many }) => ({
  user: one(users, {
    fields: [calendarSources.userId],
    references: [users.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  calendarSource: one(calendarSources, {
    fields: [events.calendarSourceId],
    references: [calendarSources.id],
  }),
  createdByUser: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignedToUser: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  completedByUser: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
  }),
}));

export const choresRelations = relations(chores, ({ one, many }) => ({
  assignedToUser: one(users, {
    fields: [chores.assignedTo],
    references: [users.id],
  }),
  completions: many(choreCompletions),
}));

export const choreCompletionsRelations = relations(choreCompletions, ({ one }) => ({
  chore: one(chores, {
    fields: [choreCompletions.choreId],
    references: [chores.id],
  }),
  completedByUser: one(users, {
    fields: [choreCompletions.completedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [choreCompletions.approvedBy],
    references: [users.id],
  }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [shoppingLists.createdBy],
    references: [users.id],
  }),
  assignedToUser: one(users, {
    fields: [shoppingLists.assignedTo],
    references: [users.id],
  }),
  items: many(shoppingItems),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingItems.listId],
    references: [shoppingLists.id],
  }),
  addedByUser: one(users, {
    fields: [shoppingItems.addedBy],
    references: [users.id],
  }),
}));

export const mealsRelations = relations(meals, ({ one }) => ({
  cookedByUser: one(users, {
    fields: [meals.cookedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [meals.createdBy],
    references: [users.id],
  }),
}));

export const maintenanceRemindersRelations = relations(maintenanceReminders, ({ one, many }) => ({
  assignedToUser: one(users, {
    fields: [maintenanceReminders.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [maintenanceReminders.createdBy],
    references: [users.id],
  }),
  completions: many(maintenanceCompletions),
}));

export const maintenanceCompletionsRelations = relations(maintenanceCompletions, ({ one }) => ({
  reminder: one(maintenanceReminders, {
    fields: [maintenanceCompletions.reminderId],
    references: [maintenanceReminders.id],
  }),
  completedByUser: one(users, {
    fields: [maintenanceCompletions.completedBy],
    references: [users.id],
  }),
}));

export const birthdaysRelations = relations(birthdays, ({ one }) => ({
  user: one(users, {
    fields: [birthdays.userId],
    references: [users.id],
  }),
}));

export const familyMessagesRelations = relations(familyMessages, ({ one }) => ({
  author: one(users, {
    fields: [familyMessages.authorId],
    references: [users.id],
  }),
}));
