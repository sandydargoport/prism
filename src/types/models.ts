import type { DayOfWeek } from '@/lib/constants/days';
export type { DayOfWeek };

export interface FamilyMember {
  id: string;
  /** Ordinal position in the sorted member list. Present in unauthenticated context; id will be ''. */
  loginIndex?: number;
  name: string;
  color: string;
  avatarUrl?: string | null;
  role?: 'parent' | 'child' | 'guest';
  hasPin?: boolean;
  /** Number of digits this member's PIN pad requires (4/5/6). Not sensitive — exposed even unauthenticated. */
  pinLength?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  completedAt?: string | null;
  source?: string;
  listId?: string | null;
  taskSourceId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string | null;
  };
  createdAt?: string | Date;
  updatedAt?: string;
}

export interface Chore {
  id: string;
  title: string;
  description?: string;
  category: 'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom';
  customIntervalDays?: number;
  startDay?: string | null;
  lastCompleted?: Date | string;
  nextDue?: string;
  /** Optional HH:mm time-of-day; null/undefined → floats above the time grid. */
  nextDueTime?: string | null;
  enabled: boolean;
  requiresApproval: boolean;
  pointValue: number;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string | null;
  };
  createdAt: Date | string;
  updatedAt?: string;
  pendingApproval?: {
    completionId: string;
    completedAt: string;
    completedBy: {
      id: string;
      name: string;
      color: string;
    };
  };
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  checked: boolean;
  notes?: string;
  addedBy?: {
    id: string;
    name: string;
    color: string;
  };
  source?: string;
  /** Kroger productId cached from the last "Send to Kroger" pick. */
  krogerProductId?: string | null;
  createdAt: Date | string;
}

export interface ShoppingList {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  listType?: 'grocery' | 'hardware' | 'general' | 'other';
  visibleCategories?: string[] | null;
  sortOrder: number;
  assignedTo?: string;
  items: ShoppingItem[];
  createdBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date | string;
}

export interface WishItem {
  id: string;
  memberId: string;
  name: string;
  url?: string | null;
  notes?: string | null;
  sortOrder: number;
  claimed: boolean;
  claimedBy?: { id: string; name: string; color: string } | null;
  claimedAt?: string | null;
  addedBy?: { id: string; name: string; color: string } | null;
  createdAt: string;
}

export interface GiftIdea {
  id: string;
  createdBy: { id: string; name: string; color: string };
  forUserId: string;
  forUser: { id: string; name: string; color: string };
  name: string;
  url?: string | null;
  notes?: string | null;
  price?: string | null;
  purchased: boolean;
  purchasedAt?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Meal {
  id: string;
  name: string;
  description?: string | null;
  recipe?: string | null;
  recipeUrl?: string | null;
  recipeId?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  ingredients?: string | null;
  weekOf: string;
  dayOfWeek: DayOfWeek;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Optional HH:mm time-of-day for time-grid placement; null/undefined → default by mealType. */
  mealTime?: string | null;
  cookedAt?: Date | string | null;
  cookedBy?: { id: string; name: string; color: string } | null;
  createdBy?: { id: string; name: string; color: string } | null;
  createdAt: Date | string;
}
