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
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  ingredients: string | null;
  dayOfWeek: string;
  mealType: string;
  cookedAt: Date | null;
  cookedById: string | null;
  weekOf: string;
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
    prepTime: row.prepTime,
    cookTime: row.cookTime,
    servings: row.servings,
    ingredients: row.ingredients,
    dayOfWeek: row.dayOfWeek,
    mealType: row.mealType,
    cookedAt: row.cookedAt?.toISOString() || null,
    cookedBy: row.cookedByUserId ? {
      id: row.cookedByUserId,
      name: row.cookedByUserName,
      color: row.cookedByUserColor,
    } : null,
    weekOf: row.weekOf,
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
