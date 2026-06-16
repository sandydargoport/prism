import { version } from '../../package.json';

export const APP_NAME = 'Prism';
export const APP_VERSION = version;
export const APP_DESCRIPTION = "Your family's digital home";

/** Session duration in seconds, keyed by uppercase role */
export const SESSION_DURATION = {
  PARENT: 7 * 24 * 60 * 60, // 7 days — family dashboard stays logged in
  CHILD: 24 * 60 * 60,      // 1 day
  GUEST: 10 * 60,           // 10 minutes
} as const;

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 6;
/** Default family-wide PIN length when none has been configured. */
export const DEFAULT_PIN_LENGTH = 4;
/** Settings key holding the family-wide PIN length (uniform for all members). */
export const PIN_LENGTH_SETTING_KEY = 'pinLength';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 5 * 60; // kept for backward compat — use LOCKOUT_TIERS for new code
/** Progressive lockout durations in seconds: 5 min → 15 min → 1 hr → 4 hr */
export const LOCKOUT_TIERS = [5 * 60, 15 * 60, 60 * 60, 4 * 60 * 60] as const;
/** How long the lockout tier counter persists after the last failed attempt (24 hr). */
export const LOCKOUT_TIER_TTL = 24 * 60 * 60;

export const TARGET_RESOLUTION = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;

export const IDLE_TIMEOUT = 120;

export const TOUCH_TARGETS = {
  MIN: 44,
  RECOMMENDED: 48,
  LARGE: 60,
} as const;

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
} as const;

export const CALENDAR_VIEWS = ['day', 'week', 'multiWeek', 'month'] as const;
export type CalendarView = typeof CALENDAR_VIEWS[number];
export const DEFAULT_CALENDAR_VIEW: CalendarView = 'multiWeek';
export const CALENDAR_SYNC_INTERVAL = 10 * 60 * 1000;
export const CALENDAR_PAST_MONTHS = 6;
export const CALENDAR_FUTURE_MONTHS = 12;

export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_CATEGORIES = [
  'Work',
  'School',
  'Home',
  'Personal',
  'Shopping',
  'Errands',
  'Health',
  'Other',
] as const;

export const CHORE_SCHEDULES = ['daily', 'weekly', 'monthly', 'custom'] as const;
export type ChoreSchedule = typeof CHORE_SCHEDULES[number];

export const SHOPPING_CATEGORIES = [
  { id: 'produce', name: 'Produce', emoji: '🥬' },
  { id: 'meat', name: 'Meat & Seafood', emoji: '🥩' },
  { id: 'dairy', name: 'Dairy & Refrigerated', emoji: '🧀' },
  { id: 'frozen', name: 'Frozen Foods', emoji: '❄️' },
  { id: 'pantry', name: 'Pantry & Canned', emoji: '🥫' },
  { id: 'bakery', name: 'Bakery', emoji: '🍞' },
  { id: 'ethnic', name: 'Ethnic Foods', emoji: '🌮' },
  { id: 'health', name: 'Health & Beauty', emoji: '🧴' },
  { id: 'household', name: 'Household', emoji: '🧹' },
  { id: 'pet', name: 'Pet Supplies', emoji: '🐕' },
  { id: 'beverages', name: 'Beverages', emoji: '🍷' },
  { id: 'snacks', name: 'Snacks & Candy', emoji: '🍪' },
  { id: 'other', name: 'Other', emoji: '📦' },
] as const;

export const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;
export const WEATHER_FORECAST_DAYS = 5;

export const MAINTENANCE_CATEGORIES = ['car', 'home', 'appliance', 'yard', 'other'] as const;
export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number];
export const MAINTENANCE_SCHEDULES = ['monthly', 'quarterly', 'annually', 'custom'] as const;

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = typeof THEME_MODES[number];

export const SEASONAL_THEMES = {
  1: { name: 'January', theme: 'winter' },
  2: { name: 'February', theme: 'valentine' },
  3: { name: 'March', theme: 'stpatrick' },
  4: { name: 'April', theme: 'easter' },
  5: { name: 'May', theme: 'spring' },
  6: { name: 'June', theme: 'summer' },
  7: { name: 'July', theme: 'independence' },
  8: { name: 'August', theme: 'backtoschool' },
  9: { name: 'September', theme: 'fall' },
  10: { name: 'October', theme: 'halloween' },
  11: { name: 'November', theme: 'thanksgiving' },
  12: { name: 'December', theme: 'christmas' },
} as const;

export const API_RATE_LIMITS = {
  WEATHER: 1000,
  SOLAR: 10000,
  GOOGLE_CALENDAR: 1000000,
} as const;

export const MAX_CACHED_EVENTS = 1000;
export const ARCHIVE_AFTER_DAYS = 30;

export const MESSAGE_AUTO_DELETE_DAYS = 7;
export const MAX_MESSAGE_LENGTH = 500;

export const PHOTO_MAX_SIZE_MB = 20;
export const PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_SLIDESHOW_INTERVAL_DEFAULT = 15;
export const PHOTO_TRANSITION_TYPES = ['fade', 'slide', 'zoom'] as const;
export type PhotoTransitionType = typeof PHOTO_TRANSITION_TYPES[number];
