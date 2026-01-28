/**
 * ============================================================================
 * PRISM - Widgets Index
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Re-exports all widget components from a single entry point.
 *
 * USAGE:
 *   import {
 *     ClockWidget,
 *     WeatherWidget,
 *     CalendarWidget,
 *     TasksWidget,
 *     MessagesWidget,
 *   } from '@/components/widgets';
 *
 * ============================================================================
 */

// Widget Container
export { WidgetContainer, WidgetEmpty } from './WidgetContainer';
export type { WidgetContainerProps, WidgetSize } from './WidgetContainer';

// Clock Widget
export { ClockWidget, useCurrentTime, formatTime } from './ClockWidget';
export type { ClockWidgetProps } from './ClockWidget';

// Weather Widget
export { WeatherWidget } from './WeatherWidget';
export type {
  WeatherWidgetProps,
  WeatherData,
  CurrentWeather,
  ForecastDay,
  WeatherCondition,
} from './WeatherWidget';

// Calendar Widget
export { CalendarWidget } from './CalendarWidget';
export type { CalendarWidgetProps, CalendarEvent } from './CalendarWidget';

// Tasks Widget
export { TasksWidget } from './TasksWidget';
export type { TasksWidgetProps, Task } from './TasksWidget';

// Messages Widget
export { MessagesWidget } from './MessagesWidget';
export type { MessagesWidgetProps, FamilyMessage } from './MessagesWidget';

// Chores Widget
export { ChoresWidget } from './ChoresWidget';
export type { ChoresWidgetProps, Chore } from './ChoresWidget';

// Shopping Widget
export { ShoppingWidget } from './ShoppingWidget';
export type { ShoppingWidgetProps, ShoppingList, ShoppingItem } from './ShoppingWidget';

// Meals Widget
export { MealsWidget } from './MealsWidget';
export type { MealsWidgetProps, Meal } from './MealsWidget';

// Birthdays Widget
export { BirthdaysWidget } from './BirthdaysWidget';
export type { BirthdaysWidgetProps } from './BirthdaysWidget';
