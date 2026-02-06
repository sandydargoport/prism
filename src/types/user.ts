export type UserRole = 'parent' | 'child' | 'guest';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  color: string;
  pin?: string;
  email?: string;
  avatarUrl?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultCalendarView?: 'day' | 'week' | 'twoWeek' | 'month';
  showCompletedTasks?: boolean;
  showCompletedChores?: boolean;
  reminderNotifications?: boolean;
  soundEnabled?: boolean;
  [key: string]: unknown;
}

export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateUserInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & Pick<User, 'id'>;

export const PERMISSIONS: Record<UserRole, RolePermissions> = {
  parent: {
    canViewAllCalendars: true,
    canViewOwnCalendar: true,
    canAddEvent: true,
    canEditOwnEvent: true,
    canDeleteOwnEvent: true,
    canEditAnyEvent: true,
    canDeleteAnyEvent: true,
    canManageTasks: true,
    canCompleteTasks: true,
    canDeleteTasks: true,
    canManageChores: true,
    canCompleteChores: true,
    canApproveChores: true,
    canAssignChores: true,
    canManageGoals: true,
    canModifySettings: true,
    canManageUsers: true,
    canAccessSmartHome: true,
    canViewLocationMap: true,
    canPostMessages: true,
    canDeleteAnyMessage: true,
    canToggleAwayMode: true,
  },

  child: {
    canViewAllCalendars: true,
    canViewOwnCalendar: true,
    canAddEvent: true,
    canEditOwnEvent: true,
    canDeleteOwnEvent: false,
    canEditAnyEvent: false,
    canDeleteAnyEvent: false,
    canManageTasks: true,
    canCompleteTasks: true,
    canDeleteTasks: false,
    canManageChores: true,
    canCompleteChores: true,
    canApproveChores: false,
    canAssignChores: false,
    canManageGoals: false,
    canModifySettings: false,
    canManageUsers: false,
    canAccessSmartHome: false,
    canViewLocationMap: true,
    canPostMessages: true,
    canDeleteAnyMessage: false,
    canToggleAwayMode: false,
  },

  guest: {
    canViewAllCalendars: true,
    canViewOwnCalendar: false,
    canAddEvent: false,
    canEditOwnEvent: false,
    canDeleteOwnEvent: false,
    canEditAnyEvent: false,
    canDeleteAnyEvent: false,
    canManageTasks: false,
    canCompleteTasks: false,
    canDeleteTasks: false,
    canManageChores: false,
    canCompleteChores: false,
    canApproveChores: false,
    canAssignChores: false,
    canManageGoals: false,
    canModifySettings: false,
    canManageUsers: false,
    canAccessSmartHome: false,
    canViewLocationMap: false,
    canPostMessages: false,
    canDeleteAnyMessage: false,
    canToggleAwayMode: false,
  },
};

export interface RolePermissions {
  canViewAllCalendars: boolean;
  canViewOwnCalendar: boolean;
  canAddEvent: boolean;
  canEditOwnEvent: boolean;
  canDeleteOwnEvent: boolean;
  canEditAnyEvent: boolean;
  canDeleteAnyEvent: boolean;
  canManageTasks: boolean;
  canCompleteTasks: boolean;
  canDeleteTasks: boolean;
  canManageChores: boolean;
  canCompleteChores: boolean;
  canApproveChores: boolean;
  canAssignChores: boolean;
  canManageGoals: boolean;
  canModifySettings: boolean;
  canManageUsers: boolean;
  canAccessSmartHome: boolean;
  canViewLocationMap: boolean;
  canPostMessages: boolean;
  canDeleteAnyMessage: boolean;
  canToggleAwayMode: boolean;
}

export function hasPermission(
  user: User,
  permission: keyof RolePermissions
): boolean {
  return PERMISSIONS[user.role][permission];
}

export function isParent(user: User): boolean {
  return user.role === 'parent';
}

export function isChild(user: User): boolean {
  return user.role === 'child';
}

export function isGuest(user: User): boolean {
  return user.role === 'guest';
}
