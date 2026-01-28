import { ComponentType } from 'react';
import {
  ClockWidget,
  WeatherWidget,
  CalendarWidget,
  TasksWidget,
  MessagesWidget,
  ChoresWidget,
  ShoppingWidget,
  MealsWidget,
  BirthdaysWidget,
} from '@/components/widgets';

export interface WidgetRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  label: string;
  icon: string;
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
}

export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  clock: {
    component: ClockWidget,
    label: 'Clock',
    icon: 'Clock',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 1,
  },
  weather: {
    component: WeatherWidget,
    label: 'Weather',
    icon: 'Cloud',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
  calendar: {
    component: CalendarWidget,
    label: 'Calendar',
    icon: 'Calendar',
    minW: 1,
    minH: 1,
    defaultW: 2,
    defaultH: 2,
  },
  tasks: {
    component: TasksWidget,
    label: 'Tasks',
    icon: 'CheckSquare',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
  messages: {
    component: MessagesWidget,
    label: 'Messages',
    icon: 'MessageSquare',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
  chores: {
    component: ChoresWidget,
    label: 'Chores',
    icon: 'ListChecks',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
  shopping: {
    component: ShoppingWidget,
    label: 'Shopping',
    icon: 'ShoppingCart',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
  meals: {
    component: MealsWidget,
    label: 'Meals',
    icon: 'UtensilsCrossed',
    minW: 1,
    minH: 1,
    defaultW: 2,
    defaultH: 2,
  },
  birthdays: {
    component: BirthdaysWidget,
    label: 'Birthdays',
    icon: 'Cake',
    minW: 1,
    minH: 1,
    defaultW: 1,
    defaultH: 2,
  },
};

export const ALL_WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);
