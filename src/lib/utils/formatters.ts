/**
 * Shared transformation functions for converting database query rows
 * into API response objects. Used by route handlers to avoid duplicating
 * formatting logic across GET, POST, and PATCH endpoints.
 */

/**
 * Format a task database row (with joined user data) into an API response object.
 */
export function formatTaskRow(row: {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: 'high' | 'medium' | 'low' | null;
  category: string | null;
  completed: boolean;
  completedAt: Date | null;
  listId?: string | null;
  taskSourceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserColor: string | null;
  assignedUserAvatar: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate?.toISOString() || null,
    priority: row.priority,
    category: row.category,
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() || null,
    listId: row.listId || null,
    taskSourceId: row.taskSourceId || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignedTo: row.assignedUserId
      ? {
          id: row.assignedUserId,
          name: row.assignedUserName!,
          color: row.assignedUserColor!,
          avatarUrl: row.assignedUserAvatar,
        }
      : null,
  };
}

/**
 * Format a message database row (with joined author data) into an API response object.
 */
export function formatMessageRow(row: {
  id: string;
  message: string;
  pinned: boolean;
  important: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorColor: string;
  authorAvatar: string | null;
}) {
  return {
    id: row.id,
    message: row.message,
    pinned: row.pinned,
    important: row.important,
    expiresAt: row.expiresAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.authorId,
      name: row.authorName,
      color: row.authorColor,
      avatarUrl: row.authorAvatar,
    },
  };
}

/**
 * Format a meal database row (with joined user data) into an API response object.
 */
export function formatMealRow(row: {
  id: string;
  name: string;
  description: string | null;
  recipe: string | null;
  recipeUrl: string | null;
  recipeId: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  ingredients: string | null;
  dayOfWeek: string;
  mealType: string;
  mealTime?: string | null;
  cookedAt: Date | null;
  cookedById: string | null;
  weekOf: string;
  date?: string;
  source: string;
  sourceId: string | null;
  createdAt: Date;
  updatedAt?: Date;
  createdById: string | null;
  createdByName: string | null;
  createdByColor: string | null;
  cookedByUserId: string | null;
  cookedByUserName: string | null;
  cookedByUserColor: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    recipe: row.recipe,
    recipeUrl: row.recipeUrl,
    recipeId: row.recipeId,
    prepTime: row.prepTime,
    cookTime: row.cookTime,
    servings: row.servings,
    ingredients: row.ingredients,
    dayOfWeek: row.dayOfWeek,
    mealType: row.mealType,
    mealTime: row.mealTime ?? null,
    cookedAt: row.cookedAt?.toISOString() || null,
    cookedBy: row.cookedByUserId ? {
      id: row.cookedByUserId,
      name: row.cookedByUserName,
      color: row.cookedByUserColor,
    } : null,
    weekOf: row.weekOf,
    ...(row.date ? { date: row.date } : {}),
    source: row.source,
    sourceId: row.sourceId,
    createdAt: row.createdAt.toISOString(),
    ...(row.updatedAt ? { updatedAt: row.updatedAt.toISOString() } : {}),
    createdBy: row.createdById ? {
      id: row.createdById,
      name: row.createdByName,
      color: row.createdByColor,
    } : null,
  };
}

/**
 * Format an event database row into an API response object.
 * Color priority: event color > group color > user color > calendar color > family default.
 */
export function formatEventRow(row: {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule: string | null;
  color: string | null;
  reminderMinutes: number | null;
  calendarSourceId: string | null;
  calendarSourceName: string | null;
  calendarSourceColor: string | null;
  calendarSourceProvider: string | null;
  calendarSourceIsFamily?: boolean | null;
  userColor?: string | null;
  groupColor?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let eventColor = row.color;
  if (!eventColor && row.groupColor) eventColor = row.groupColor;
  if (!eventColor && row.userColor) eventColor = row.userColor;
  if (!eventColor && row.calendarSourceColor) eventColor = row.calendarSourceColor;
  if (!eventColor && row.calendarSourceIsFamily) eventColor = '#F59E0B';

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    allDay: row.allDay,
    recurring: row.recurring,
    recurrenceRule: row.recurrenceRule,
    color: eventColor,
    reminderMinutes: row.reminderMinutes,
    calendarSource: row.calendarSourceId
      ? {
          id: row.calendarSourceId,
          name: row.calendarSourceName!,
          color: row.userColor || row.calendarSourceColor,
          provider: row.calendarSourceProvider!,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Format a goal database row into an API response object.
 */
export function formatGoalRow(row: {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  emoji: string | null;
  priority: number;
  recurring: boolean;
  recurrencePeriod: string | null;
  active: boolean;
  lastResetAt: Date;
  createdAt: Date;
}, fullyAchieved: boolean) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pointCost: row.pointCost,
    emoji: row.emoji,
    priority: row.priority,
    recurring: row.recurring,
    recurrencePeriod: row.recurrencePeriod,
    active: row.active,
    lastResetAt: row.lastResetAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    fullyAchieved,
  };
}

/**
 * Format a chore database row (with joined assignment data) into an API response object.
 */
export function formatChoreRow(row: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  customIntervalDays: number | null;
  startDay: string | null;
  lastCompleted: Date | null;
  nextDue: string | null;
  nextDueTime?: string | null;
  pointValue: number;
  requiresApproval: boolean;
  enabled: boolean;
  createdAt: Date;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToColor: string | null;
  assignedToAvatar?: string | null;
}, pendingCompletion?: {
  completionId: string;
  completedAt: string;
  completedBy: { id: string; name: string; color: string };
} | null) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    frequency: row.frequency,
    customIntervalDays: row.customIntervalDays,
    startDay: row.startDay || null,
    lastCompleted: row.lastCompleted?.toISOString() || null,
    nextDue: row.nextDue || null,
    nextDueTime: row.nextDueTime ?? null,
    pointValue: row.pointValue,
    requiresApproval: row.requiresApproval,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    assignedTo: row.assignedToId ? {
      id: row.assignedToId,
      name: row.assignedToName,
      color: row.assignedToColor,
      avatarUrl: row.assignedToAvatar ?? null,
    } : null,
    pendingApproval: pendingCompletion || null,
  };
}

/**
 * Format a wish item database row into an API response object.
 * Hides claim info when the owner is viewing their own list.
 */
export function formatWishItemRow(item: {
  id: string;
  memberId: string;
  name: string;
  url: string | null;
  notes: string | null;
  sortOrder: number;
  claimed: boolean;
  claimedById: string | null;
  claimedByName: string | null;
  claimedByColor: string | null;
  claimedAt: Date | null;
  addedById: string | null;
  addedByName: string | null;
  addedByColor: string | null;
  createdAt: Date;
}, isOwnerViewing: boolean) {
  return {
    id: item.id,
    memberId: item.memberId,
    name: item.name,
    url: item.url,
    notes: item.notes,
    sortOrder: item.sortOrder,
    ...(isOwnerViewing
      ? // Owner viewing: show self-claims, hide others' claims (keep gifts secret)
        item.claimed && item.claimedById === item.memberId
          ? {
              claimed: true,
              claimedBy: { id: item.claimedById, name: item.claimedByName, color: item.claimedByColor },
              claimedAt: item.claimedAt?.toISOString() || null,
            }
          : { claimed: false, claimedBy: null, claimedAt: null }
      : {
          claimed: item.claimed,
          claimedBy: item.claimedById
            ? { id: item.claimedById, name: item.claimedByName, color: item.claimedByColor }
            : null,
          claimedAt: item.claimedAt?.toISOString() || null,
        }),
    addedBy: item.addedById
      ? { id: item.addedById, name: item.addedByName, color: item.addedByColor }
      : null,
    createdAt: item.createdAt.toISOString(),
  };
}

/**
 * Format a shopping item database row into an API response object.
 */
export function formatShoppingItemRow(item: {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  recurring: boolean;
  recurrenceInterval: number | string | null;
  notes: string | null;
  listId: string;
  createdAt: Date;
  addedById: string | null;
  addedByName: string | null;
  addedByColor: string | null;
}) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    checked: item.checked,
    recurring: item.recurring,
    recurrenceInterval: item.recurrenceInterval,
    notes: item.notes,
    listId: item.listId,
    createdAt: item.createdAt.toISOString(),
    addedBy: item.addedById ? {
      id: item.addedById,
      name: item.addedByName,
      color: item.addedByColor,
    } : null,
  };
}

/**
 * Format a recipe database row into an API response object.
 */
export function formatRecipeRow(row: {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  sourceType: string;
  ingredients: unknown;
  instructions: string | null;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  tags: unknown;
  cuisine: string | null;
  category: string | null;
  imageUrl: string | null;
  rating: number | null;
  timesMade: number;
  lastMadeAt: Date | null;
  isFavorite: boolean;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    url: row.url,
    sourceType: row.sourceType,
    ingredients: row.ingredients,
    instructions: row.instructions,
    notes: row.notes,
    prepTime: row.prepTime,
    cookTime: row.cookTime,
    servings: row.servings,
    tags: row.tags,
    cuisine: row.cuisine,
    category: row.category,
    imageUrl: row.imageUrl,
    rating: row.rating,
    timesMade: row.timesMade,
    lastMadeAt: row.lastMadeAt?.toISOString() || null,
    isFavorite: row.isFavorite,
    createdBy: row.createdBy
      ? { id: row.createdBy, name: row.createdByName }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
