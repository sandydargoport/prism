import { ComponentType, lazy } from 'react';
import { ClockWidget } from './ClockWidget';
import { WeatherWidget } from './WeatherWidget';
import { CalendarWidget } from './CalendarWidget';

// Lazy-load non-default widgets to reduce initial bundle size
const TasksWidget = lazy(() => import('./TasksWidget').then(m => ({ default: m.TasksWidget })));
const MessagesWidget = lazy(() => import('./MessagesWidget').then(m => ({ default: m.MessagesWidget })));
const ChoresWidget = lazy(() => import('./ChoresWidget').then(m => ({ default: m.ChoresWidget })));
const ShoppingWidget = lazy(() => import('./ShoppingWidget').then(m => ({ default: m.ShoppingWidget })));
const MealsWidget = lazy(() => import('./MealsWidget').then(m => ({ default: m.MealsWidget })));
const BirthdaysWidget = lazy(() => import('./BirthdaysWidget').then(m => ({ default: m.BirthdaysWidget })));
const PhotoWidget = lazy(() => import('./PhotoWidget').then(m => ({ default: m.PhotoWidget })));

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
}

export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  clock: {
    component: ClockWidget,
    label: 'Clock',
    icon: 'Clock',
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 3,
  },
  weather: {
    component: WeatherWidget,
    label: 'Weather',
    icon: 'Cloud',
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 6,
  },
  calendar: {
    component: CalendarWidget,
    label: 'Calendar',
    icon: 'Calendar',
    minW: 3,
    minH: 4,
    defaultW: 6,
    defaultH: 6,
  },
  tasks: {
    component: TasksWidget,
    label: 'Tasks',
    icon: 'CheckSquare',
    minW: 2,
    minH: 3,
    defaultW: 3,
    defaultH: 6,
  },
  messages: {
    component: MessagesWidget,
    label: 'Messages',
    icon: 'MessageSquare',
    minW: 2,
    minH: 3,
    defaultW: 3,
    defaultH: 6,
  },
  chores: {
    component: ChoresWidget,
    label: 'Chores',
    icon: 'ListChecks',
    minW: 2,
    minH: 3,
    defaultW: 3,
    defaultH: 6,
  },
  shopping: {
    component: ShoppingWidget,
    label: 'Shopping',
    icon: 'ShoppingCart',
    minW: 2,
    minH: 3,
    defaultW: 3,
    defaultH: 6,
  },
  meals: {
    component: MealsWidget,
    label: 'Meals',
    icon: 'UtensilsCrossed',
    minW: 3,
    minH: 3,
    defaultW: 6,
    defaultH: 6,
  },
  birthdays: {
    component: BirthdaysWidget,
    label: 'Birthdays',
    icon: 'Cake',
    minW: 2,
    minH: 3,
    defaultW: 3,
    defaultH: 6,
  },
  photos: {
    component: PhotoWidget,
    label: 'Photos',
    icon: 'Image',
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 4,
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
];
