import { ComponentType, lazy } from 'react';
import { ClockWidget } from './ClockWidget';
import { WeatherWidget } from './WeatherWidget';

// Lazy-load non-default widgets to reduce initial bundle size
const CalendarWidget = lazy(() => import('./CalendarWidget').then(m => ({ default: m.CalendarWidget })));
const TasksWidget = lazy(() => import('./TasksWidget').then(m => ({ default: m.TasksWidget })));
const MessagesWidget = lazy(() => import('./MessagesWidget').then(m => ({ default: m.MessagesWidget })));
const ChoresWidget = lazy(() => import('./ChoresWidget').then(m => ({ default: m.ChoresWidget })));
const ShoppingWidget = lazy(() => import('./ShoppingWidget').then(m => ({ default: m.ShoppingWidget })));
const MealsWidget = lazy(() => import('./MealsWidget').then(m => ({ default: m.MealsWidget })));
const BirthdaysWidget = lazy(() => import('./BirthdaysWidget').then(m => ({ default: m.BirthdaysWidget })));
const PhotoWidget = lazy(() => import('./PhotoWidget').then(m => ({ default: m.PhotoWidget })));
const PointsWidget = lazy(() => import('./PointsWidget').then(m => ({ default: m.PointsWidget })));
const WishesWidget = lazy(() => import('./WishesWidget').then(m => ({ default: m.WishesWidget })));
const BusTrackingWidget = lazy(() => import('./BusTrackingWidget').then(m => ({ default: m.BusTrackingWidget })));
const TravelWidget = lazy(() => import('./TravelWidget').then(m => ({ default: m.TravelWidget })));

export interface WidgetProps {
  className?: string;
  gridW?: number;
  gridH?: number;
  backgroundColor?: string;
  [key: string]: unknown;
}

export interface WidgetRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  label: string;
  icon: string;
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  maxW?: number;
  maxH?: number;
  hasGrid?: boolean;
}

export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  clock: {
    component: ClockWidget,
    label: 'Clock',
    icon: 'Clock',
    minW: 8,
    minH: 4,
    defaultW: 12,
    defaultH: 12,
  },
  weather: {
    component: WeatherWidget,
    label: 'Weather',
    icon: 'Cloud',
    minW: 8,
    minH: 8,
    defaultW: 12,
    defaultH: 24,
  },
  calendar: {
    component: CalendarWidget,
    label: 'Calendar',
    icon: 'Calendar',
    minW: 12,
    minH: 16,
    defaultW: 24,
    defaultH: 24,
    hasGrid: true,
  },
  tasks: {
    component: TasksWidget,
    label: 'Tasks',
    icon: 'CheckSquare',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 24,
  },
  messages: {
    component: MessagesWidget,
    label: 'Messages',
    icon: 'MessageSquare',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 24,
  },
  chores: {
    component: ChoresWidget,
    label: 'Chores',
    icon: 'ListChecks',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 24,
  },
  shopping: {
    component: ShoppingWidget,
    label: 'Shopping',
    icon: 'ShoppingCart',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 24,
  },
  meals: {
    component: MealsWidget,
    label: 'Meals',
    icon: 'UtensilsCrossed',
    minW: 12,
    minH: 12,
    defaultW: 24,
    defaultH: 24,
  },
  birthdays: {
    component: BirthdaysWidget,
    label: 'Birthdays',
    icon: 'Cake',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 24,
  },
  photos: {
    component: PhotoWidget,
    label: 'Photos',
    icon: 'Image',
    minW: 8,
    minH: 8,
    defaultW: 16,
    defaultH: 16,
  },
  points: {
    component: PointsWidget,
    label: 'Points',
    icon: 'Trophy',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 20,
  },
  wishes: {
    component: WishesWidget,
    label: 'Wishes',
    icon: 'Gift',
    minW: 8,
    minH: 8,
    defaultW: 12,
    defaultH: 16,
  },
  busTracking: {
    component: BusTrackingWidget,
    label: 'Bus Tracker',
    icon: 'Bus',
    minW: 8,
    minH: 8,
    defaultW: 12,
    defaultH: 12,
  },
  travel: {
    component: TravelWidget,
    label: 'Travel',
    icon: 'Globe',
    minW: 8,
    minH: 12,
    defaultW: 12,
    defaultH: 20,
  },
};

export const ALL_WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);

export const SCREENSAVER_WIDGETS = [
  { id: 'clock', label: 'Clock' },
  { id: 'weather', label: 'Weather' },
  { id: 'messages', label: 'Messages' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'birthdays', label: 'Birthdays' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'chores', label: 'Chores' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'meals', label: 'Meals' },
  { id: 'photos', label: 'Photos' },
  { id: 'wishes', label: 'Wishes' },
  { id: 'busTracking', label: 'Bus Tracker' },
];
