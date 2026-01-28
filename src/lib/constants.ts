/**
 * ============================================================================
 * PRISM - Application Constants
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Centralizes all constant values used throughout the application.
 * Using constants instead of hard-coded values makes the code:
 *   - Easier to maintain (change in one place)
 *   - Self-documenting (names explain what values mean)
 *   - Less error-prone (no typos in repeated values)
 *
 * HOW TO USE:
 *   import { APP_NAME, SESSION_DURATION } from '@/lib/constants';
 *   console.log(`Welcome to ${APP_NAME}!`);
 *
 * WHEN TO ADD CONSTANTS:
 * - Values used in multiple places
 * - Configuration that might change
 * - Magic numbers that need explanation
 * - API endpoints or external URLs
 *
 * ============================================================================
 */


// ============================================================================
// APPLICATION INFO
// ============================================================================

/** Application name displayed in UI */
export const APP_NAME = 'Prism';

/** Application version (should match package.json) */
export const APP_VERSION = '1.0.0';

/** Application description for metadata */
export const APP_DESCRIPTION = "Your family's digital home";

/** GitHub repository URL */
export const GITHUB_REPO = 'https://github.com/yourusername/prism';


// ============================================================================
// AUTHENTICATION & SESSIONS
// ============================================================================

/**
 * Session duration in seconds
 * CUSTOMIZE: Adjust these based on your family's preferences
 */
export const SESSION_DURATION = {
  /** Parent session length (30 minutes) */
  PARENT: 30 * 60,
  /** Child session length (15 minutes) */
  CHILD: 15 * 60,
  /** Guest session length (10 minutes) */
  GUEST: 10 * 60,
} as const;

/** Minimum PIN length */
export const MIN_PIN_LENGTH = 4;

/** Maximum PIN length */
export const MAX_PIN_LENGTH = 6;

/** Maximum login attempts before lockout */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Lockout duration in seconds (5 minutes) */
export const LOCKOUT_DURATION = 5 * 60;


// ============================================================================
// DISPLAY & UI
// ============================================================================

/**
 * Primary target display resolution
 * The dashboard is optimized for this resolution but works at others
 */
export const TARGET_RESOLUTION = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;

/**
 * Idle timeout before screensaver activates (in seconds)
 * CUSTOMIZE: Set to 0 to disable idle detection
 */
export const IDLE_TIMEOUT = 120; // 2 minutes

/**
 * Touch target sizes in pixels
 * Based on accessibility guidelines:
 * - Apple HIG: 44px minimum
 * - Material Design: 48px recommended
 */
export const TOUCH_TARGETS = {
  /** Minimum touch target (Apple HIG) */
  MIN: 44,
  /** Recommended touch target (Material Design) */
  RECOMMENDED: 48,
  /** Large touch target for primary actions */
  LARGE: 60,
} as const;

/**
 * Animation durations in milliseconds
 * Keep animations short so they don't slow users down
 */
export const ANIMATION_DURATION = {
  /** Fast animations (button press, hover) */
  FAST: 150,
  /** Normal animations (page transitions) */
  NORMAL: 200,
  /** Slow animations (modal open, theme change) */
  SLOW: 300,
} as const;


// ============================================================================
// CALENDAR
// ============================================================================

/**
 * Calendar view types
 */
export const CALENDAR_VIEWS = ['day', 'week', 'twoWeek', 'month'] as const;
export type CalendarView = typeof CALENDAR_VIEWS[number];

/** Default calendar view */
export const DEFAULT_CALENDAR_VIEW: CalendarView = 'twoWeek';

/**
 * Calendar sync interval in milliseconds
 * How often to fetch updates from Google/Apple calendars
 */
export const CALENDAR_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes

/** How far back to fetch calendar events */
export const CALENDAR_PAST_MONTHS = 6;

/** How far ahead to fetch calendar events */
export const CALENDAR_FUTURE_MONTHS = 12;


// ============================================================================
// TASKS & CHORES
// ============================================================================

/**
 * Task priority levels
 */
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

/**
 * Task categories (default set)
 * CUSTOMIZE: Add or modify categories for your family
 */
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

/**
 * Chore schedule types
 */
export const CHORE_SCHEDULES = ['daily', 'weekly', 'monthly', 'custom'] as const;
export type ChoreSchedule = typeof CHORE_SCHEDULES[number];


// ============================================================================
// SHOPPING LIST
// ============================================================================

/**
 * Shopping list categories (organized by typical store layout)
 * CUSTOMIZE: Reorder to match your grocery store's layout
 */
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


// ============================================================================
// WEATHER
// ============================================================================

/**
 * Weather refresh interval in milliseconds
 * Don't refresh too often - API has rate limits
 */
export const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

/** Number of forecast days to display */
export const WEATHER_FORECAST_DAYS = 5;


// ============================================================================
// MAINTENANCE REMINDERS
// ============================================================================

/**
 * Maintenance categories
 */
export const MAINTENANCE_CATEGORIES = ['car', 'home', 'appliance', 'yard', 'other'] as const;
export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number];

/**
 * Maintenance schedule intervals
 */
export const MAINTENANCE_SCHEDULES = ['monthly', 'quarterly', 'annually', 'custom'] as const;


// ============================================================================
// THEMES
// ============================================================================

/**
 * Theme modes
 */
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = typeof THEME_MODES[number];

/**
 * Months for seasonal themes
 */
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


// ============================================================================
// API RATE LIMITS
// ============================================================================

/**
 * Maximum API calls per day for free tier services
 * These are approximate - check actual service limits
 */
export const API_RATE_LIMITS = {
  /** OpenWeatherMap free tier */
  WEATHER: 1000,
  /** Enphase free tier */
  SOLAR: 10000,
  /** Google Calendar (per user) */
  GOOGLE_CALENDAR: 1000000,
} as const;


// ============================================================================
// DATABASE
// ============================================================================

/**
 * Maximum number of events to cache locally
 */
export const MAX_CACHED_EVENTS = 1000;

/**
 * How long to keep completed tasks/chores before archiving (days)
 */
export const ARCHIVE_AFTER_DAYS = 30;


// ============================================================================
// FAMILY MESSAGE BOARD
// ============================================================================

/**
 * Auto-delete messages after this many days (0 = never)
 * CUSTOMIZE: Adjust based on how long you want messages to persist
 */
export const MESSAGE_AUTO_DELETE_DAYS = 7;

/** Maximum message length */
export const MAX_MESSAGE_LENGTH = 500;
