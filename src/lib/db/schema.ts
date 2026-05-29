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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  role: varchar('role', { length: 20 }).notNull()
    .$type<'parent' | 'child' | 'guest'>(),

  // Color for calendar/task display (hex format: "#3B82F6")
  color: varchar('color', { length: 7 }).notNull(),

  // Nullable because guests don't have PINs
  pin: varchar('pin', { length: 255 }),

  email: varchar('email', { length: 255 }),

  avatarUrl: text('avatar_url'),

  // Flexible schema for future additions
  preferences: jsonb('preferences').default({}).notNull(),

  // Display order in PinPad and profile lists (lower = first)
  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));


export const calendarGroups = pgTable('calendar_groups', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),

  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),

  // Type: 'user' (auto-created for a user) or 'custom' (manually created)
  type: varchar('type', { length: 20 }).notNull().default('custom'),

  // If type='user', link to the user
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('calendar_groups_type_idx').on(table.type),
}));


export const calendarSources = pgTable('calendar_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Calendar provider ("google", "apple", "microsoft", "caldav")
  provider: varchar('provider', { length: 50 }).notNull(),

  // ID of the calendar in the external system
  sourceCalendarId: varchar('source_calendar_id', { length: 255 }).notNull(),

  // Dashboard calendar name this maps to (e.g., "Alex's Calendar", "Family Calendar")
  dashboardCalendarName: varchar('dashboard_calendar_name', { length: 255 }).notNull(),

  displayName: varchar('display_name', { length: 255 }),

  // Override color (if different from user color)
  color: varchar('color', { length: 7 }),

  enabled: boolean('enabled').default(true).notNull(),

  // Whether this calendar appears in the "Add Event" modal for creating events
  // Subscription/read-only calendars should have this set to false
  showInEventModal: boolean('show_in_event_modal').default(true).notNull(),

  // Whether this is a family-shared calendar (vs personal or unassigned)
  isFamily: boolean('is_family').default(false).notNull(),

  groupId: uuid('group_id').references(() => calendarGroups.id, { onDelete: 'set null' }),

  // OAuth tokens (encrypted in application layer)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // iCal subscription URL (used when provider='ical'; null otherwise)
  icalUrl: text('ical_url'),

  lastSynced: timestamp('last_synced'),
  // syncErrors carries actual error state ({ needsReauth, lastError, timestamp })
  // for Google + similar OAuth flows. Historically also stored CalDAV
  // connection config (server URL, username, supportsEvents/Tasks,
  // taskListId, contactBirthdaysEnabled) which was semantically muddy.
  // Migrated to providerConfig in v1.8.4. See feat/caldav-followups.
  syncErrors: jsonb('sync_errors'),
  // Stable per-provider configuration: serverUrl + username for CalDAV,
  // supportsEvents/supportsTasks/taskListId/contactBirthdaysEnabled flags,
  // anything else that's "what this source is" rather than "what went
  // wrong recently". Read at sync time; never mutated by error handlers.
  providerConfig: jsonb('provider_config'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('calendar_sources_user_id_idx').on(table.userId),
  enabledIdx: index('calendar_sources_enabled_idx').on(table.enabled),
}));


export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),

  calendarSourceId: uuid('calendar_source_id')
    .references(() => calendarSources.id, { onDelete: 'cascade' }),

  // ID from external system (for sync tracking)
  externalEventId: varchar('external_event_id', { length: 255 }),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 255 }),

  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  allDay: boolean('all_day').default(false).notNull(),

  recurring: boolean('recurring').default(false).notNull(),
  recurrenceRule: text('recurrence_rule'), // iCal RRULE format

  // Who created this event (for locally-created events)
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  // Display color (inherits from calendar if not set)
  color: varchar('color', { length: 7 }),

  reminderMinutes: integer('reminder_minutes'),

  lastSynced: timestamp('last_synced'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  startTimeIdx: index('events_start_time_idx').on(table.startTime),
  endTimeIdx: index('events_end_time_idx').on(table.endTime),
  calendarSourceIdx: index('events_calendar_source_idx').on(table.calendarSourceId),
  // Unique constraint to prevent duplicate synced events
  sourceExternalUnique: uniqueIndex('events_source_external_unique')
    .on(table.calendarSourceId, table.externalEventId),
}));


export const taskLists = pgTable('task_lists', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),

  color: varchar('color', { length: 7 }),

  // Sort order for display
  sortOrder: integer('sort_order').default(0).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const taskSources = pgTable('task_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which user connected this source
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Provider: "microsoft_todo", "todoist", "apple_reminders", etc.
  provider: varchar('provider', { length: 50 }).notNull(),

  // External list ID in the provider's system
  externalListId: varchar('external_list_id', { length: 255 }).notNull(),

  // External list name (for display/debugging)
  externalListName: varchar('external_list_name', { length: 255 }),

  // Which Prism task list this syncs to
  taskListId: uuid('task_list_id').references(() => taskLists.id, { onDelete: 'cascade' }).notNull(),

  // Sync enabled/disabled
  syncEnabled: boolean('sync_enabled').default(true).notNull(),

  // OAuth tokens (encrypted in application layer)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  lastSyncAt: timestamp('last_sync_at'),
  lastSyncError: text('last_sync_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userProviderIdx: index('task_sources_user_provider_idx').on(table.userId, table.provider),
  taskListIdx: index('task_sources_task_list_idx').on(table.taskListId),
}));


export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Which list this task belongs to (null = default/inbox)
  listId: uuid('list_id').references(() => taskLists.id, { onDelete: 'cascade' }),

  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  dueDate: timestamp('due_date'),

  priority: varchar('priority', { length: 20 })
    .$type<'high' | 'medium' | 'low'>(),

  category: varchar('category', { length: 100 }),

  completed: boolean('completed').default(false).notNull(),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),

  // External sync tracking
  taskSourceId: uuid('task_source_id').references(() => taskSources.id, { onDelete: 'set null' }),
  externalId: varchar('external_id', { length: 255 }),
  externalUpdatedAt: timestamp('external_updated_at'),
  lastSynced: timestamp('last_synced'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index('tasks_list_id_idx').on(table.listId),
  assignedToIdx: index('tasks_assigned_to_idx').on(table.assignedTo),
  dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
  completedIdx: index('tasks_completed_idx').on(table.completed),
  taskSourceIdx: index('tasks_task_source_idx').on(table.taskSourceId),
  externalIdIdx: index('tasks_external_id_idx').on(table.externalId),
}));


export const chores = pgTable('chores', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  category: varchar('category', { length: 50 }).notNull()
    .$type<'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other'>(),

  // Null = anyone can do it
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  frequency: varchar('frequency', { length: 20 }).notNull()
    .$type<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom'>(),

  // For custom frequencies: number of days between occurrences
  customIntervalDays: integer('custom_interval_days'),

  // Start day override: 0=Sunday, 1=Monday, ..., 6=Saturday
  // For weekly: which day of the week the chore resets
  // For monthly: 1-28 (day of month)
  // For annually: MM-DD string (e.g., "03-15" for March 15)
  startDay: varchar('start_day', { length: 10 }),

  lastCompleted: timestamp('last_completed'),
  nextDue: date('next_due'),
  // Optional time-of-day for the chore (HH:mm). Null = "top of day" / floats.
  // Used by time-grid calendar views to place the chore at a specific hour.
  nextDueTime: varchar('next_due_time', { length: 5 }),

  pointValue: integer('point_value').default(0).notNull(),

  requiresApproval: boolean('requires_approval').default(false).notNull(),

  enabled: boolean('enabled').default(true).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nextDueIdx: index('chores_next_due_idx').on(table.nextDue),
  assignedToIdx: index('chores_assigned_to_idx').on(table.assignedTo),
}));


export const choreCompletions = pgTable('chore_completions', {
  id: uuid('id').defaultRandom().primaryKey(),

  choreId: uuid('chore_id')
    .references(() => chores.id, { onDelete: 'cascade' })
    .notNull(),

  completedBy: uuid('completed_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  completedAt: timestamp('completed_at').defaultNow().notNull(),

  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),

  // Points awarded (might differ from chore default)
  pointsAwarded: integer('points_awarded'),

  photoUrl: text('photo_url'),

  notes: text('notes'),
}, (table) => ({
  choreIdIdx: index('chore_completions_chore_id_idx').on(table.choreId),
  completedAtIdx: index('chore_completions_completed_at_idx').on(table.completedAt),
  approvedByIdx: index('chore_completions_approved_by_idx').on(table.approvedBy),
  choreApprovedByIdx: index('chore_completions_chore_approved_by_idx').on(table.choreId, table.approvedBy),
}));


export const shoppingListSources = pgTable('shopping_list_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which user connected this source
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Provider: "microsoft_todo", "todoist", etc.
  provider: varchar('provider', { length: 50 }).notNull(),

  // External list ID in the provider's system
  externalListId: varchar('external_list_id', { length: 255 }).notNull(),

  // External list name (for display/debugging)
  externalListName: varchar('external_list_name', { length: 255 }),

  // Which Prism shopping list this syncs to
  shoppingListId: uuid('shopping_list_id').references(() => shoppingLists.id, { onDelete: 'cascade' }).notNull(),

  // Sync enabled/disabled
  syncEnabled: boolean('sync_enabled').default(true).notNull(),

  // OAuth tokens (encrypted in application layer)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  lastSyncAt: timestamp('last_sync_at'),
  lastSyncError: text('last_sync_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userProviderIdx: index('shopping_list_sources_user_provider_idx').on(table.userId, table.provider),
  shoppingListIdx: index('shopping_list_sources_shopping_list_idx').on(table.shoppingListId),
}));


export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  description: text('description'),

  icon: varchar('icon', { length: 50 }),

  color: varchar('color', { length: 7 }),

  // List type: 'grocery' | 'hardware' | 'general' | 'other' - determines layout style
  listType: varchar('list_type', { length: 20 }).default('grocery').notNull()
    .$type<'grocery' | 'hardware' | 'general' | 'other'>(),

  sortOrder: integer('sort_order').default(0).notNull(),

  // Per-list category visibility — null means show all categories
  visibleCategories: jsonb('visible_categories').$type<string[] | null>(),

  // Null means anyone can check off items (family list)
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const shoppingItems = pgTable('shopping_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  listId: uuid('list_id')
    .references(() => shoppingLists.id, { onDelete: 'cascade' })
    .notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  quantity: integer('quantity'),
  unit: varchar('unit', { length: 50 }), // "lbs", "oz", "gallon", "count"
  category: varchar('category', { length: 50 }),

  checked: boolean('checked').default(false).notNull(),

  // Source tracking (for sync)
  source: varchar('source', { length: 50 }).default('internal').notNull(),
  sourceId: varchar('source_id', { length: 255 }),

  recurring: boolean('recurring').default(false).notNull(),
  recurrenceInterval: varchar('recurrence_interval', { length: 20 }), // "weekly", "monthly"

  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),

  notes: text('notes'),

  // External sync tracking
  shoppingListSourceId: uuid('shopping_list_source_id').references(() => shoppingListSources.id, { onDelete: 'set null' }),
  externalId: varchar('external_id', { length: 255 }),
  externalUpdatedAt: timestamp('external_updated_at'),
  lastSynced: timestamp('last_synced'),

  // Cached Kroger productId from the last time this item was sent to the
  // Kroger cart — pre-selects the same SKU on subsequent sends so weekly
  // staples become one-tap.
  krogerProductId: varchar('kroger_product_id', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index('shopping_items_list_id_idx').on(table.listId),
  categoryIdx: index('shopping_items_category_idx').on(table.category),
  checkedIdx: index('shopping_items_checked_idx').on(table.checked),
  shoppingListSourceIdx: index('shopping_items_source_idx').on(table.shoppingListSourceId),
  externalIdIdx: index('shopping_items_external_id_idx').on(table.externalId),
}));

// ============================================================================
// KROGER CART INTEGRATION
// ============================================================================

/**
 * Per-user Kroger OAuth tokens. Unlike Microsoft / Google integrations which
 * are scoped to a Prism list (shopping_list_sources), Kroger is account-level
 * — one connection per user, used to push items into that user's online cart.
 *
 * Tokens are encrypted at the application layer with ENCRYPTION_KEY.
 */
export const userKrogerConnections = pgTable('user_kroger_connections', {
  id: uuid('id').defaultRandom().primaryKey(),

  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // Optional — Kroger's "favorite store" id if the user picked one. Lets us
  // search products with location-specific pricing.
  preferredLocationId: varchar('preferred_location_id', { length: 50 }),
  preferredLocationName: varchar('preferred_location_name', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_kroger_connections_user_id_idx').on(table.userId),
}));


export const recipes = pgTable('recipes', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Source URL (for scraped recipes)
  url: text('url'),

  // Where did this recipe come from?
  sourceType: varchar('source_type', { length: 50 }).default('manual').notNull()
    .$type<'manual' | 'url_import' | 'paprika_import'>(),

  // Structured ingredients (JSON array of {name, amount, unit, notes})
  ingredients: jsonb('ingredients').default([]).notNull(),

  // Instructions (can be plain text or JSON array of steps)
  instructions: text('instructions'),

  prepTime: integer('prep_time'), // minutes
  cookTime: integer('cook_time'), // minutes
  servings: integer('servings'),

  // Categorization
  tags: jsonb('tags').default([]).notNull(), // ["quick", "vegetarian", "kid-friendly"]
  cuisine: varchar('cuisine', { length: 100 }), // "Italian", "Mexican", etc.
  category: varchar('category', { length: 100 }), // "Main Dish", "Dessert", etc.

  // Image (URL or local path)
  imageUrl: text('image_url'),

  // Ratings and notes
  rating: integer('rating'), // 1-5 stars
  notes: text('notes'),

  // How often we've made this
  timesMade: integer('times_made').default(0).notNull(),
  lastMadeAt: timestamp('last_made_at'),

  // Favorite for quick access
  isFavorite: boolean('is_favorite').default(false).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('recipes_name_idx').on(table.name),
  favoriteIdx: index('recipes_favorite_idx').on(table.isFavorite),
  sourceTypeIdx: index('recipes_source_type_idx').on(table.sourceType),
}));


export const meals = pgTable('meals', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),

  description: text('description'),

  // Link to a saved recipe (optional - can also have inline recipe data)
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),

  // Inline recipe data (for quick entries or when not using saved recipes)
  recipe: text('recipe'),
  recipeUrl: text('recipe_url'),

  prepTime: integer('prep_time'), // minutes
  cookTime: integer('cook_time'), // minutes
  servings: integer('servings'),

  ingredients: text('ingredients'),

  weekOf: date('week_of').notNull(),

  dayOfWeek: varchar('day_of_week', { length: 20 }).notNull()
    .$type<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>(),

  mealType: varchar('meal_type', { length: 20 }).notNull()
    .$type<'breakfast' | 'lunch' | 'dinner' | 'snack'>(),

  // Optional time-of-day (HH:mm) for time-grid calendar placement. When null,
  // the UI substitutes a default based on mealType (breakfast 07:00, lunch
  // 12:00, snack 15:00, dinner 18:00). Stored separately so a user-set time
  // survives mealType changes.
  mealTime: varchar('meal_time', { length: 5 }),

  cookedAt: timestamp('cooked_at'),
  cookedBy: uuid('cooked_by').references(() => users.id, { onDelete: 'set null' }),

  // Source tracking (for Paprika sync)
  source: varchar('source', { length: 50 }).default('internal').notNull(),
  sourceId: varchar('source_id', { length: 255 }),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  weekOfIdx: index('meals_week_of_idx').on(table.weekOf),
  dayOfWeekIdx: index('meals_day_of_week_idx').on(table.dayOfWeek),
}));


export const familyMessages = pgTable('family_messages', {
  id: uuid('id').defaultRandom().primaryKey(),

  message: text('message').notNull(),

  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  pinned: boolean('pinned').default(false).notNull(),

  important: boolean('important').default(false).notNull(),

  // When should this message auto-delete? (null = never)
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('family_messages_created_at_idx').on(table.createdAt),
  expiresAtIdx: index('family_messages_expires_at_idx').on(table.expiresAt),
}));


export const maintenanceReminders = pgTable('maintenance_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull()
    .$type<'car' | 'home' | 'appliance' | 'yard' | 'other'>(),

  description: text('description'),

  schedule: varchar('schedule', { length: 20 }).notNull()
    .$type<'monthly' | 'quarterly' | 'annually' | 'custom'>(),
  customIntervalDays: integer('custom_interval_days'),

  lastCompleted: timestamp('last_completed'),
  nextDue: date('next_due').notNull(),

  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nextDueIdx: index('maintenance_reminders_next_due_idx').on(table.nextDue),
}));


export const maintenanceCompletions = pgTable('maintenance_completions', {
  id: uuid('id').defaultRandom().primaryKey(),

  reminderId: uuid('reminder_id')
    .references(() => maintenanceReminders.id, { onDelete: 'cascade' })
    .notNull(),

  completedAt: timestamp('completed_at').defaultNow().notNull(),
  completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),

  cost: decimal('cost', { precision: 10, scale: 2 }),
  vendor: varchar('vendor', { length: 255 }),
  notes: text('notes'),
});


export const birthdays = pgTable('birthdays', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  // Birth date (year for age calculation, or just month/day)
  birthDate: date('birth_date').notNull(),

  eventType: varchar('event_type', { length: 20 }).default('birthday').notNull(),

  // Link to family member (if applicable)
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  giftIdeas: text('gift_ideas'),

  // How many days before to remind about sending card
  sendCardDaysBefore: integer('send_card_days_before').default(7),

  // Null = manually created
  googleCalendarSource: varchar('google_calendar_source', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  nameEventTypeIdx: uniqueIndex('birthdays_name_event_type_idx').on(table.name, table.eventType),
}));


export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),

  key: varchar('key', { length: 100 }).unique().notNull(),

  // JSON for flexibility
  value: jsonb('value').notNull(),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const babysitterInfo = pgTable('babysitter_info', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Section type: 'emergency_contact' | 'house_info' | 'child_info' | 'house_rule'
  section: varchar('section', { length: 50 }).notNull()
    .$type<'emergency_contact' | 'house_info' | 'child_info' | 'house_rule'>(),

  sortOrder: integer('sort_order').default(0).notNull(),

  // Content varies by section type (JSON object)
  content: jsonb('content').notNull(),

  // Sensitive items require PIN to view on public babysitter page
  isSensitive: boolean('is_sensitive').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sectionIdx: index('babysitter_info_section_idx').on(table.section),
  sortOrderIdx: index('babysitter_info_sort_order_idx').on(table.sortOrder),
}));


export const layouts = pgTable('layouts', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  // URL-safe identifier for multi-dashboard routing (/d/[slug])
  slug: varchar('slug', { length: 100 }).unique(),

  isDefault: boolean('is_default').default(false).notNull(),

  // Legacy field — replaced by slug for multi-dashboard routing
  displayId: varchar('display_id', { length: 100 }),

  // Widget configuration (JSON array of widget objects)
  widgets: jsonb('widgets').notNull(),

  // Per-dashboard screensaver layout (null = use default template)
  screensaverWidgets: jsonb('screensaver_widgets'),

  // Per-dashboard screen orientation
  orientation: varchar('orientation', { length: 20 }).default('landscape'),

  // Per-dashboard font scale (percentage, e.g. 90, 100, 110 — null = 100)
  fontScale: integer('font_scale'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  // SHA-256 hex of the raw token (for fast lookup)
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),

  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  // Scopes limit what resources a token can access. ['*'] = full parent access.
  scopes: jsonb('scopes').$type<string[]>().default(['*']).notNull(),

  lastUsedAt: timestamp('last_used_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('api_tokens_token_hash_idx').on(table.tokenHash),
  createdByIdx: index('api_tokens_created_by_idx').on(table.createdBy),
}));


export const apiCredentials = pgTable('api_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),

  service: varchar('service', { length: 100 }).unique().notNull(),

  // Encrypted credentials (JSON object with service-specific fields)
  encryptedCredentials: text('encrypted_credentials').notNull(),

  // When do these credentials expire? (for OAuth tokens)
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }),
  summary: varchar('summary', { length: 500 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
}));


// Relations define relationships for Drizzle's relation queries.
// These don't affect the database schema - they're for TypeScript types.

export const usersRelations = relations(users, ({ many }) => ({
  calendarSources: many(calendarSources),
  taskSources: many(taskSources),
  shoppingListSources: many(shoppingListSources),
  wishItemSources: many(wishItemSources),
  tasks: many(tasks),
  chores: many(chores),
  choreCompletions: many(choreCompletions),
  shoppingLists: many(shoppingLists),
  shoppingItems: many(shoppingItems),
  meals: many(meals),
  recipes: many(recipes),
  maintenanceReminders: many(maintenanceReminders),
  maintenanceCompletions: many(maintenanceCompletions),
  familyMessages: many(familyMessages),
  auditLogs: many(auditLogs),
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

export const taskListsRelations = relations(taskLists, ({ one, many }) => ({
  tasks: many(tasks),
  taskSources: many(taskSources),
  createdByUser: one(users, {
    fields: [taskLists.createdBy],
    references: [users.id],
  }),
}));

export const taskSourcesRelations = relations(taskSources, ({ one, many }) => ({
  user: one(users, {
    fields: [taskSources.userId],
    references: [users.id],
  }),
  taskList: one(taskLists, {
    fields: [taskSources.taskListId],
    references: [taskLists.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  list: one(taskLists, {
    fields: [tasks.listId],
    references: [taskLists.id],
  }),
  taskSource: one(taskSources, {
    fields: [tasks.taskSourceId],
    references: [taskSources.id],
  }),
  assignedToUser: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  completedByUser: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  meals: many(meals),
  createdByUser: one(users, {
    fields: [recipes.createdBy],
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

export const shoppingListSourcesRelations = relations(shoppingListSources, ({ one, many }) => ({
  user: one(users, {
    fields: [shoppingListSources.userId],
    references: [users.id],
  }),
  shoppingList: one(shoppingLists, {
    fields: [shoppingListSources.shoppingListId],
    references: [shoppingLists.id],
  }),
  items: many(shoppingItems),
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
  sources: many(shoppingListSources),
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
  shoppingListSource: one(shoppingListSources, {
    fields: [shoppingItems.shoppingListSourceId],
    references: [shoppingListSources.id],
  }),
}));

export const mealsRelations = relations(meals, ({ one }) => ({
  recipe: one(recipes, {
    fields: [meals.recipeId],
    references: [recipes.id],
  }),
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


export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  pointCost: integer('point_cost').notNull(),

  emoji: varchar('emoji', { length: 10 }),

  // Priority order (1 = highest). Points fill goals in ascending priority order.
  priority: integer('priority').notNull().default(0),

  // Recurring goals reset each period; non-recurring accumulate until manually reset.
  recurring: boolean('recurring').notNull().default(false),

  // 'weekly' | 'monthly' | 'yearly' — only used when recurring = true
  recurrencePeriod: varchar('recurrence_period', { length: 20 })
    .$type<'weekly' | 'monthly' | 'yearly'>(),

  active: boolean('active').default(true).notNull(),

  // For non-recurring goals: when the parent last reset the goal after full achievement.
  // Progress is only counted from completions after this timestamp.
  lastResetAt: timestamp('last_reset_at').defaultNow().notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  activeIdx: index('goals_active_idx').on(table.active),
  activePriorityIdx: index('goals_active_priority_idx').on(table.active, table.priority),
}));


export const goalAchievements = pgTable('goal_achievements', {
  id: uuid('id').defaultRandom().primaryKey(),

  goalId: uuid('goal_id')
    .references(() => goals.id, { onDelete: 'cascade' })
    .notNull(),

  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  // For recurring: period start date. For non-recurring: lastResetAt date.
  periodStart: date('period_start').notNull(),

  achievedAt: timestamp('achieved_at').defaultNow().notNull(),
}, (table) => ({
  goalUserPeriodIdx: uniqueIndex('goal_achievements_goal_user_period_idx')
    .on(table.goalId, table.userId, table.periodStart),
  userIdIdx: index('goal_achievements_user_id_idx').on(table.userId),
  goalIdIdx: index('goal_achievements_goal_id_idx').on(table.goalId),
}));


export const photoSources = pgTable('photo_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  type: varchar('type', { length: 20 }).notNull()
    .$type<'local' | 'onedrive' | 'immich' | 'icloud_shared'>(),

  name: varchar('name', { length: 255 }).notNull(),

  // Cross-source dedup priority. Lower = preferred. When the same photo
  // (same dedupeKey) is pulled from multiple sources, the copy from the
  // lowest-priority-number source is the one displayed; the others are
  // suppressed at read time. Lets a user who backs up to BOTH OneDrive and
  // iCloud pick which service's copy wins without re-syncing.
  priority: integer('priority').default(100).notNull(),

  onedriveFolderId: varchar('onedrive_folder_id', { length: 255 }),

  // OAuth tokens (for OneDrive sources)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // Immich shared-link sources
  immichServerUrl: text('immich_server_url'),
  immichShareKey: text('immich_share_key'),
  immichPasswordEnc: text('immich_password_enc'),
  immichAlbumId: text('immich_album_id'),

  lastSynced: timestamp('last_synced'),
  syncErrors: jsonb('sync_errors'),

  enabled: boolean('enabled').default(true).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),

  sourceId: uuid('source_id')
    .references(() => photoSources.id, { onDelete: 'cascade' })
    .notNull(),

  filename: varchar('filename', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(),
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes'),

  // When the photo was taken (from EXIF or file date)
  takenAt: timestamp('taken_at'),

  // External ID for synced photos (e.g., OneDrive item ID)
  externalId: varchar('external_id', { length: 255 }),

  thumbnailPath: varchar('thumbnail_path', { length: 255 }),

  favorite: boolean('favorite').default(false).notNull(),

  // Orientation: auto-detected from dimensions
  orientation: varchar('orientation', { length: 20 })
    .$type<'landscape' | 'portrait' | 'square'>(),

  // Comma-separated display contexts (e.g., "wallpaper,screensaver")
  usage: varchar('usage', { length: 100 }).default('wallpaper,gallery,screensaver').notNull(),

  // GPS coordinates extracted from EXIF (for travel map auto-linking)
  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 10, scale: 6 }),

  // When true: no local file — served by proxying through OneDrive on demand.
  // filename stores the OneDrive item ID. Used for camera-roll sources where we
  // record GPS metadata without downloading every photo.
  isExternal: boolean('is_external').default(false).notNull(),

  // Cross-source dedup key: `${takenAt-to-the-second}_${width}x${height}`.
  // Two photos with an identical key are treated as the same shot pulled
  // from different sources (e.g. the same picture backed up to both
  // OneDrive and iCloud). Null when the photo lacks EXIF capture time +
  // dimensions — those are never deduped. Computed at sync time. Read-time
  // dedup groups by this key and keeps the lowest source.priority copy.
  dedupeKey: varchar('dedupe_key', { length: 120 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdIdx: index('photos_source_id_idx').on(table.sourceId),
  takenAtIdx: index('photos_taken_at_idx').on(table.takenAt),
  favoriteIdx: index('photos_favorite_idx').on(table.favorite),
  usageIdx: index('photos_usage_idx').on(table.usage),
  dedupeKeyIdx: index('photos_dedupe_key_idx').on(table.dedupeKey),
}));


export const photoSourcesRelations = relations(photoSources, ({ many }) => ({
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  source: one(photoSources, {
    fields: [photos.sourceId],
    references: [photoSources.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  createdByUser: one(users, {
    fields: [apiTokens.createdBy],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  achievements: many(goalAchievements),
}));

export const goalAchievementsRelations = relations(goalAchievements, ({ one }) => ({
  goal: one(goals, {
    fields: [goalAchievements.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalAchievements.userId],
    references: [users.id],
  }),
}));


export const wishItems = pgTable('wish_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Whose wish list this item belongs to
  memberId: uuid('member_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  url: text('url'),
  notes: text('notes'),

  sortOrder: integer('sort_order').default(0).notNull(),

  // Claim tracking (hidden from the list owner for gift surprises)
  claimed: boolean('claimed').default(false).notNull(),
  claimedBy: uuid('claimed_by').references(() => users.id, { onDelete: 'set null' }),
  claimedAt: timestamp('claimed_at'),

  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),

  // External sync tracking
  wishItemSourceId: uuid('wish_item_source_id').references(() => wishItemSources.id, { onDelete: 'set null' }),
  externalId: varchar('external_id', { length: 255 }),
  externalUpdatedAt: timestamp('external_updated_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  memberIdIdx: index('wish_items_member_id_idx').on(table.memberId),
  claimedIdx: index('wish_items_claimed_idx').on(table.claimed),
  wishItemSourceIdx: index('wish_items_source_idx').on(table.wishItemSourceId),
  externalIdIdx: index('wish_items_external_id_idx').on(table.externalId),
}));

export const wishItemsRelations = relations(wishItems, ({ one }) => ({
  member: one(users, {
    fields: [wishItems.memberId],
    references: [users.id],
    relationName: 'wishItemsMember',
  }),
  addedByUser: one(users, {
    fields: [wishItems.addedBy],
    references: [users.id],
    relationName: 'wishItemsAddedBy',
  }),
  claimedByUser: one(users, {
    fields: [wishItems.claimedBy],
    references: [users.id],
    relationName: 'wishItemsClaimedBy',
  }),
  wishItemSource: one(wishItemSources, {
    fields: [wishItems.wishItemSourceId],
    references: [wishItemSources.id],
  }),
}));


export const giftIdeas = pgTable('gift_ideas', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Who created this gift idea
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  // Who this gift idea is for
  forUserId: uuid('for_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  url: text('url'),
  notes: text('notes'),
  price: decimal('price', { precision: 10, scale: 2 }),

  purchased: boolean('purchased').default(false).notNull(),
  purchasedAt: timestamp('purchased_at'),

  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index('gift_ideas_created_by_idx').on(table.createdBy),
  forUserIdx: index('gift_ideas_for_user_idx').on(table.forUserId),
}));

export const giftIdeasRelations = relations(giftIdeas, ({ one }) => ({
  creator: one(users, {
    fields: [giftIdeas.createdBy],
    references: [users.id],
    relationName: 'giftIdeasCreator',
  }),
  forUser: one(users, {
    fields: [giftIdeas.forUserId],
    references: [users.id],
    relationName: 'giftIdeasForUser',
  }),
}));


export const wishItemSources = pgTable('wish_item_sources', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Which user connected this source
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Provider: "microsoft_todo", etc.
  provider: varchar('provider', { length: 50 }).notNull(),

  // External list ID in the provider's system
  externalListId: varchar('external_list_id', { length: 255 }).notNull(),

  // External list name (for display/debugging)
  externalListName: varchar('external_list_name', { length: 255 }),

  // Which family member's wish list this syncs to
  memberId: uuid('member_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Sync enabled/disabled
  syncEnabled: boolean('sync_enabled').default(true).notNull(),

  // OAuth tokens (encrypted in application layer)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  lastSyncAt: timestamp('last_sync_at'),
  lastSyncError: text('last_sync_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userProviderIdx: index('wish_item_sources_user_provider_idx').on(table.userId, table.provider),
  memberIdx: index('wish_item_sources_member_idx').on(table.memberId),
}));

// Bus Tracking

export const busRoutes = pgTable('bus_routes', {
  id: uuid('id').defaultRandom().primaryKey(),

  studentName: varchar('student_name', { length: 100 }).notNull(),

  // Optional link to a family member
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // FirstView trip ID (e.g., "28-C")
  tripId: varchar('trip_id', { length: 50 }).notNull(),

  direction: varchar('direction', { length: 10 }).notNull()
    .$type<'AM' | 'PM'>(),

  // Human-readable label (e.g., "Emma Morning Pickup")
  label: varchar('label', { length: 255 }).notNull(),

  // Expected arrival time (HH:mm format)
  scheduledTime: varchar('scheduled_time', { length: 5 }).notNull(),

  // Days of the week this route is active (1=Mon, 5=Fri)
  activeDays: jsonb('active_days').default([1, 2, 3, 4, 5]).notNull()
    .$type<number[]>(),

  // Ordered geofence checkpoint labels (configured in settings)
  checkpoints: jsonb('checkpoints').default([]).notNull()
    .$type<{ name: string; sortOrder: number }[]>(),

  // Final implicit checkpoints
  stopName: varchar('stop_name', { length: 255 }),
  schoolName: varchar('school_name', { length: 255 }),

  enabled: boolean('enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tripDirectionIdx: uniqueIndex('bus_routes_trip_direction_idx').on(table.tripId, table.direction),
  enabledIdx: index('bus_routes_enabled_idx').on(table.enabled),
}));


export const busGeofenceLog = pgTable('bus_geofence_log', {
  id: uuid('id').defaultRandom().primaryKey(),

  routeId: uuid('route_id')
    .references(() => busRoutes.id, { onDelete: 'cascade' })
    .notNull(),

  eventType: varchar('event_type', { length: 30 }).notNull()
    .$type<'distance_based' | 'arrived_at_stop' | 'arrived_at_school'>(),

  checkpointName: varchar('checkpoint_name', { length: 255 }).notNull(),
  checkpointIndex: integer('checkpoint_index').notNull(),

  eventTime: timestamp('event_time').notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sun, 6=Sat
  tripDate: date('trip_date').notNull(),

  // Gmail message ID for deduplication
  gmailMessageId: varchar('gmail_message_id', { length: 255 }).notNull(),

  // Raw parsed data for debugging
  rawData: jsonb('raw_data'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  routeIdIdx: index('bus_geofence_log_route_id_idx').on(table.routeId),
  gmailMessageIdIdx: uniqueIndex('bus_geofence_log_gmail_message_id_idx').on(table.gmailMessageId),
  tripDateIdx: index('bus_geofence_log_trip_date_idx').on(table.tripDate),
  eventTimeIdx: index('bus_geofence_log_event_time_idx').on(table.eventTime),
}));


// ─── CALENDAR NOTES ────────────────────────────────────────────────
export const calendarNotes = pgTable('calendar_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull(),
  content: text('content').notNull().default(''),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  dateIdx: uniqueIndex('calendar_notes_date_idx').on(table.date),
}));

export const calendarNotesRelations = relations(calendarNotes, ({ one }) => ({
  creator: one(users, {
    fields: [calendarNotes.createdBy],
    references: [users.id],
  }),
}));


export const busRoutesRelations = relations(busRoutes, ({ one, many }) => ({
  user: one(users, {
    fields: [busRoutes.userId],
    references: [users.id],
  }),
  geofenceLogs: many(busGeofenceLog),
}));

export const busGeofenceLogRelations = relations(busGeofenceLog, ({ one }) => ({
  route: one(busRoutes, {
    fields: [busGeofenceLog.routeId],
    references: [busRoutes.id],
  }),
}));


export const wishItemSourcesRelations = relations(wishItemSources, ({ one, many }) => ({
  user: one(users, {
    fields: [wishItemSources.userId],
    references: [users.id],
  }),
  member: one(users, {
    fields: [wishItemSources.memberId],
    references: [users.id],
    relationName: 'wishItemSourcesMember',
  }),
  items: many(wishItems),
}));


// ─── TRAVEL MAP ────────────────────────────────────────────────────────────────

// A trip groups multiple pin stops into a single journey.
// Hub/spoke trips designate one stop as the home base (isHub=true on the pin).
// Route/loop trips draw a polyline through stops in sortOrder order.
export const travelTrips = pgTable('travel_trips', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // How stops are connected on the map
  tripStyle: varchar('trip_style', { length: 20 }).notNull()
    .$type<'route' | 'loop' | 'hub'>(),

  status: varchar('status', { length: 20 }).notNull().default('want_to_go')
    .$type<'want_to_go' | 'been_there'>(),

  isBucketList: boolean('is_bucket_list').default(false).notNull(),

  color: varchar('color', { length: 7 }),
  emoji: varchar('emoji', { length: 10 }),

  visitedDate: date('visited_date'),
  visitedEndDate: date('visited_end_date'),
  year: integer('year'),

  memberIds: jsonb('member_ids').default([]).notNull().$type<string[]>(),
  tags: jsonb('tags').default([]).notNull().$type<string[]>(),

  sortOrder: integer('sort_order').default(0).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  yearIdx: index('travel_trips_year_idx').on(table.year),
}));


export const travelPins = pgTable('travel_pins', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Geographic coordinates
  latitude: decimal('latitude', { precision: 9, scale: 6 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 6 }).notNull(),

  // Human-readable location name (from Nominatim or manual entry)
  placeName: varchar('place_name', { length: 255 }),

  // Pin status
  status: varchar('status', { length: 20 }).notNull().default('want_to_go')
    .$type<'want_to_go' | 'been_there'>(),

  // Star flag — bucket list item (works on either status)
  isBucketList: boolean('is_bucket_list').default(false).notNull(),

  // Optional trip label (e.g. "Spring Break 2026", "Summer Family Trip 2025")
  tripLabel: varchar('trip_label', { length: 255 }),

  // Optional color override (hex). Falls back to status default.
  color: varchar('color', { length: 7 }),

  // Trip dates
  visitedDate: date('visited_date'),
  visitedEndDate: date('visited_end_date'),

  // Year for quick filtering (derived from visitedDate on creation)
  year: integer('year'),

  // Free-form tags (e.g. "Road Trip", "National Park", "Beach")
  tags: jsonb('tags').default([]).notNull()
    .$type<string[]>(),

  // Key stops within a multi-location trip (e.g. ["Kauaʻi", "Hawaiʻi Island"])
  stops: jsonb('stops').$type<string[]>().default([]).notNull(),

  // National Parks / Monuments visited at this location
  nationalParks: jsonb('national_parks').$type<string[]>().default([]).notNull(),

  // Parent pin (for NP/attraction sub-pins only); FK enforced in migration
  parentId: uuid('parent_id'),

  // Trip this stop belongs to (route/loop/hub trips); null = standalone pin
  tripId: uuid('trip_id').references(() => travelTrips.id, { onDelete: 'cascade' }),

  // True on the home-base stop in a hub-style trip
  isHub: boolean('is_hub').default(false).notNull(),

  // Pin kind: 'location' (root), 'stop' (child of parent or trip stop), 'national_park'
  pinType: varchar('pin_type', { length: 20 }).notNull().default('location')
    .$type<'location' | 'stop' | 'national_park'>(),

  // Radius in km for auto-linking photos by GPS proximity
  photoRadiusKm: decimal('photo_radius_km', { precision: 6, scale: 2 }).default('50'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  yearIdx: index('travel_pins_year_idx').on(table.year),
  parentIdIdx: index('travel_pins_parent_id_idx').on(table.parentId),
  tripIdIdx: index('travel_pins_trip_id_idx').on(table.tripId),
}));


export const travelPinPhotos = pgTable('travel_pin_photos', {
  id: uuid('id').defaultRandom().primaryKey(),

  pinId: uuid('pin_id')
    .references(() => travelPins.id, { onDelete: 'cascade' })
    .notNull(),

  photoId: uuid('photo_id')
    .references(() => photos.id, { onDelete: 'cascade' })
    .notNull(),

  // Whether the user manually linked this (vs auto-linked by GPS proximity)
  linkedManually: boolean('linked_manually').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pinPhotoUnique: uniqueIndex('travel_pin_photos_pin_photo_idx').on(table.pinId, table.photoId),
  pinIdIdx: index('travel_pin_photos_pin_id_idx').on(table.pinId),
  photoIdIdx: index('travel_pin_photos_photo_id_idx').on(table.photoId),
}));




export const travelTripsRelations = relations(travelTrips, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [travelTrips.createdBy],
    references: [users.id],
  }),
  stops: many(travelPins),
}));

export const travelPinsRelations = relations(travelPins, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [travelPins.createdBy],
    references: [users.id],
  }),
  parent: one(travelPins, {
    fields: [travelPins.parentId],
    references: [travelPins.id],
    relationName: 'childPins',
  }),
  children: many(travelPins, { relationName: 'childPins' }),
  trip: one(travelTrips, {
    fields: [travelPins.tripId],
    references: [travelTrips.id],
  }),
  pinPhotos: many(travelPinPhotos),
}));

export const travelPinPhotosRelations = relations(travelPinPhotos, ({ one }) => ({
  pin: one(travelPins, {
    fields: [travelPinPhotos.pinId],
    references: [travelPins.id],
  }),
  photo: one(photos, {
    fields: [travelPinPhotos.photoId],
    references: [photos.id],
  }),
}));

// ── Weekend Ideas ─────────────────────────────────────────────────────────────

export const weekendPlaces = pgTable('weekend_places', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 10, scale: 6 }),
  placeName: varchar('place_name', { length: 255 }),
  address: varchar('address', { length: 500 }),
  url: varchar('url', { length: 1000 }),

  status: varchar('status', { length: 20 }).notNull().default('backlog')
    .$type<'backlog' | 'visited'>(),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  rating: integer('rating'),

  notes: text('notes'),
  tags: jsonb('tags').default([]).notNull().$type<string[]>(),

  sourceProvider: varchar('source_provider', { length: 20 })
    .$type<'mapbox' | 'nominatim' | 'manual'>(),
  sourceId: varchar('source_id', { length: 100 }),

  // Denormalized from weekend_visits for fast sorting/display
  lastVisitedDate: varchar('last_visited_date', { length: 10 }),
  visitCount: integer('visit_count').default(0).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('weekend_places_status_idx').on(table.status),
  favoriteIdx: index('weekend_places_favorite_idx').on(table.isFavorite),
  lastVisitedIdx: index('weekend_places_last_visited_idx').on(table.lastVisitedDate),
}));

export const weekendVisits = pgTable('weekend_visits', {
  id: uuid('id').defaultRandom().primaryKey(),

  placeId: uuid('place_id')
    .references(() => weekendPlaces.id, { onDelete: 'cascade' })
    .notNull(),
  visitedBy: uuid('visited_by').references(() => users.id, { onDelete: 'set null' }),

  visitedOn: varchar('visited_on', { length: 10 }).notNull(),
  rating: integer('rating'),
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  placeVisitIdx: index('weekend_visits_place_id_idx').on(table.placeId, table.visitedOn),
}));

export const weekendPlacesRelations = relations(weekendPlaces, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [weekendPlaces.createdBy],
    references: [users.id],
  }),
  visits: many(weekendVisits),
}));

export const weekendVisitsRelations = relations(weekendVisits, ({ one }) => ({
  place: one(weekendPlaces, {
    fields: [weekendVisits.placeId],
    references: [weekendPlaces.id],
  }),
  visitedByUser: one(users, {
    fields: [weekendVisits.visitedBy],
    references: [users.id],
  }),
}));

