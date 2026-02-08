export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  role?: 'parent' | 'child' | 'guest';
  hasPin?: boolean;
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
  lastCompleted?: Date | string;
  nextDue?: string;
  enabled: boolean;
  requiresApproval: boolean;
  pointValue: number;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
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
  category?: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other';
  checked: boolean;
  notes?: string;
  addedBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date | string;
}

export interface ShoppingList {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  listType?: 'grocery' | 'hardware' | 'other';
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

export interface Meal {
  id: string;
  name: string;
  description?: string | null;
  recipe?: string | null;
  recipeUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  ingredients?: string | null;
  weekOf: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cookedAt?: Date | string | null;
  cookedBy?: { id: string; name: string; color: string } | null;
  createdBy?: { id: string; name: string; color: string } | null;
  createdAt: Date | string;
}
