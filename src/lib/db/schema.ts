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

  lastSynced: timestamp('last_synced'),
  syncErrors: jsonb('sync_errors'),

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
  calendarSourceIdx: index('events_calendar_source_idx').on(table.calendarSourceId),
  // Unique constraint to prevent duplicate synced events
  sourceExternalUnique: uniqueIndex('events_source_external_unique')
    .on(table.calendarSourceId, table.externalEventId)
    .where(sql`${table.externalEventId} IS NOT NULL`),
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

  // List type: 'grocery' | 'hardware' | 'other' - determines layout style
  listType: varchar('list_type', { length: 20 }).default('grocery').notNull()
    .$type<'grocery' | 'hardware' | 'other'>(),

  sortOrder: integer('sort_order').default(0).notNull(),

  // Null means anyone can check off items (family list)
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


export const shoppingItems = pgTable('shopping_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  listId: uuid('list_id')
    .references(() => shoppingLists.id, { onDelete: 'cascade' })
    .notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  quantity: integer('quantity'),
  unit: varchar('unit', { length: 50 }), // "lbs", "oz", "gallon", "count"
  category: varchar('category', { length: 50 })
    .$type<'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other'>(),

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

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  listIdIdx: index('shopping_items_list_id_idx').on(table.listId),
  categoryIdx: index('shopping_items_category_idx').on(table.category),
  checkedIdx: index('shopping_items_checked_idx').on(table.checked),
  shoppingListSourceIdx: index('shopping_items_source_idx').on(table.shoppingListSourceId),
  externalIdIdx: index('shopping_items_external_id_idx').on(table.externalId),
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


export const layouts = pgTable('layouts', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),

  isDefault: boolean('is_default').default(false).notNull(),

  // For multi-display setups: which display is this for?
  displayId: varchar('display_id', { length: 100 }),

  // Widget configuration (JSON array of widget objects)
  widgets: jsonb('widgets').notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


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


// Relations define relationships for Drizzle's relation queries.
// These don't affect the database schema - they're for TypeScript types.

export const usersRelations = relations(users, ({ many }) => ({
  calendarSources: many(calendarSources),
  taskSources: many(taskSources),
  shoppingListSources: many(shoppingListSources),
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
    .$type<'local' | 'onedrive'>(),

  name: varchar('name', { length: 255 }).notNull(),

  onedriveFolderId: varchar('onedrive_folder_id', { length: 255 }),

  // OAuth tokens (for OneDrive sources)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

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

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdIdx: index('photos_source_id_idx').on(table.sourceId),
  takenAtIdx: index('photos_taken_at_idx').on(table.takenAt),
  favoriteIdx: index('photos_favorite_idx').on(table.favorite),
  usageIdx: index('photos_usage_idx').on(table.usage),
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
