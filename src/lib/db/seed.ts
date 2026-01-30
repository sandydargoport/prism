/**
 * ============================================================================
 * PRISM - Database Seed Script
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Populates the database with sample data for development and testing.
 *
 * HOW TO RUN:
 * npm run db:seed
 *
 * ============================================================================
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding database...\n');

  // ============================================================================
  // USERS (Family Members)
  // ============================================================================
  console.log('Creating family members...');

  // Hash PINs (using "1234" as default PIN for all users in demo)
  const hashedPin = await bcrypt.hash('1234', 12);

  const usersResult = await db
    .insert(schema.users)
    .values([
      {
        name: 'Alex',
        role: 'parent',
        color: '#3B82F6', // Blue
        pin: hashedPin,
        email: 'alex@example.com',
        preferences: { theme: 'system' },
      },
      {
        name: 'Jordan',
        role: 'parent',
        color: '#EC4899', // Pink
        pin: hashedPin,
        email: 'jordan@example.com',
        preferences: { theme: 'system' },
      },
      {
        name: 'Emma',
        role: 'child',
        color: '#10B981', // Green
        pin: hashedPin,
        preferences: {},
      },
      {
        name: 'Sophie',
        role: 'child',
        color: '#F59E0B', // Orange
        pin: hashedPin,
        preferences: {},
      },
    ])
    .returning();

  const alex = usersResult[0]!;
  const jordan = usersResult[1]!;
  const emma = usersResult[2]!;
  const sophie = usersResult[3]!;

  console.log(`  Created ${4} family members`);

  // ============================================================================
  // TASKS
  // ============================================================================
  console.log('Creating tasks...');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await db.insert(schema.tasks).values([
    {
      title: 'Schedule dentist appointments',
      description: 'Book checkups for the whole family',
      assignedTo: jordan.id,
      dueDate: nextWeek,
      priority: 'medium',
      category: 'Health',
      createdBy: jordan.id,
    },
    {
      title: 'Fix leaky faucet in bathroom',
      description: 'The upstairs bathroom faucet is dripping',
      assignedTo: alex.id,
      dueDate: tomorrow,
      priority: 'high',
      category: 'Home',
      createdBy: jordan.id,
    },
    {
      title: 'Science project research',
      description: 'Research solar system for school project',
      assignedTo: emma.id,
      dueDate: nextWeek,
      priority: 'high',
      category: 'School',
      createdBy: emma.id,
    },
    {
      title: 'Practice piano',
      description: '30 minutes of practice',
      assignedTo: sophie.id,
      dueDate: today,
      priority: 'medium',
      category: 'Activities',
      createdBy: jordan.id,
    },
    {
      title: 'Buy birthday gift for Grandma',
      assignedTo: alex.id,
      dueDate: nextWeek,
      priority: 'medium',
      category: 'Shopping',
      createdBy: alex.id,
    },
    {
      title: 'Return library books',
      assignedTo: emma.id,
      dueDate: tomorrow,
      priority: 'low',
      category: 'Errands',
      completed: true,
      completedAt: new Date(),
      completedBy: emma.id,
      createdBy: jordan.id,
    },
  ]);

  console.log('  Created 6 tasks');

  // ============================================================================
  // FAMILY MESSAGES
  // ============================================================================
  console.log('Creating family messages...');

  await db.insert(schema.familyMessages).values([
    {
      message: 'Soccer practice moved to 4pm today!',
      authorId: jordan.id,
      important: true,
      pinned: true,
    },
    {
      message: 'Great job on your spelling test, Emma!',
      authorId: alex.id,
      important: false,
    },
    {
      message: 'Grandma is coming to visit this weekend',
      authorId: jordan.id,
      pinned: true,
    },
    {
      message: 'Don\'t forget to feed the fish!',
      authorId: sophie.id,
      important: false,
    },
  ]);

  console.log('  Created 4 family messages');

  // ============================================================================
  // EVENTS
  // ============================================================================
  console.log('Creating calendar events...');

  const eventDate1 = new Date(today);
  eventDate1.setHours(16, 0, 0, 0);
  const eventEnd1 = new Date(eventDate1);
  eventEnd1.setHours(17, 30);

  const eventDate2 = new Date(tomorrow);
  eventDate2.setHours(9, 0, 0, 0);
  const eventEnd2 = new Date(eventDate2);
  eventEnd2.setHours(10, 0);

  const eventDate3 = new Date(today);
  eventDate3.setDate(eventDate3.getDate() + 3);
  eventDate3.setHours(18, 0, 0, 0);
  const eventEnd3 = new Date(eventDate3);
  eventEnd3.setHours(20, 0);

  await db.insert(schema.events).values([
    {
      title: 'Soccer Practice',
      location: 'Community Park',
      startTime: eventDate1,
      endTime: eventEnd1,
      color: '#10B981',
      createdBy: jordan.id,
    },
    {
      title: 'Dentist Appointment',
      location: 'Dr. Smith\'s Office',
      startTime: eventDate2,
      endTime: eventEnd2,
      color: '#3B82F6',
      createdBy: alex.id,
    },
    {
      title: 'Family Movie Night',
      description: 'Vote on the movie by Friday!',
      startTime: eventDate3,
      endTime: eventEnd3,
      color: '#EC4899',
      createdBy: jordan.id,
    },
  ]);

  console.log('  Created 3 events');

  // ============================================================================
  // CHORES
  // ============================================================================
  console.log('Creating chores...');

  const choresResult = await db
    .insert(schema.chores)
    .values([
      {
        title: 'Empty dishwasher',
        description: 'Put away all clean dishes',
        category: 'dishes',
        assignedTo: emma.id,
        frequency: 'daily',
        pointValue: 5,
        requiresApproval: false,
        createdBy: jordan.id,
      },
      {
        title: 'Make bed',
        description: 'Make your bed before school',
        category: 'cleaning',
        frequency: 'daily',
        pointValue: 2,
        requiresApproval: false,
        createdBy: jordan.id,
      },
      {
        title: 'Feed the pets',
        description: 'Feed the fish and cat',
        category: 'pets',
        assignedTo: sophie.id,
        frequency: 'daily',
        pointValue: 3,
        requiresApproval: false,
        createdBy: alex.id,
      },
      {
        title: 'Clean room',
        description: 'Tidy up and vacuum your room',
        category: 'cleaning',
        frequency: 'weekly',
        pointValue: 10,
        requiresApproval: true,
        createdBy: jordan.id,
      },
    ])
    .returning();

  const choreEmptyDishwasher = choresResult[0]!;
  const choreFeedPets = choresResult[2]!;

  console.log('  Created 4 chores');

  // Create some chore completions
  await db.insert(schema.choreCompletions).values([
    {
      choreId: choreEmptyDishwasher.id,
      completedBy: emma.id,
      pointsAwarded: 5,
    },
    {
      choreId: choreFeedPets.id,
      completedBy: sophie.id,
      pointsAwarded: 3,
    },
  ]);

  console.log('  Created 2 chore completions');

  // ============================================================================
  // SHOPPING LISTS
  // ============================================================================
  console.log('Creating shopping lists...');

  const shoppingListsResult = await db
    .insert(schema.shoppingLists)
    .values([
      {
        name: 'Grocery',
        icon: 'shopping-cart',
        color: '#10B981',
        sortOrder: 1,
      },
      {
        name: 'Hardware',
        icon: 'wrench',
        color: '#F59E0B',
        sortOrder: 2,
      },
    ])
    .returning();

  const groceryList = shoppingListsResult[0]!;
  const hardwareList = shoppingListsResult[1]!;

  console.log('  Created 2 shopping lists');

  // Shopping items
  await db.insert(schema.shoppingItems).values([
    {
      listId: groceryList.id,
      name: 'Milk',
      quantity: 1,
      unit: 'gallon',
      category: 'dairy',
      addedBy: jordan.id,
    },
    {
      listId: groceryList.id,
      name: 'Bread',
      quantity: 2,
      unit: 'loaves',
      category: 'bakery',
      addedBy: jordan.id,
    },
    {
      listId: groceryList.id,
      name: 'Apples',
      quantity: 6,
      category: 'produce',
      addedBy: alex.id,
    },
    {
      listId: groceryList.id,
      name: 'Chicken breast',
      quantity: 2,
      unit: 'lbs',
      category: 'meat',
      addedBy: jordan.id,
    },
    {
      listId: hardwareList.id,
      name: 'Lightbulbs',
      quantity: 4,
      category: 'household',
      addedBy: alex.id,
    },
    {
      listId: hardwareList.id,
      name: 'Furnace filter',
      quantity: 1,
      category: 'household',
      addedBy: alex.id,
    },
  ]);

  console.log('  Created 6 shopping items');

  // ============================================================================
  // MEALS
  // ============================================================================
  console.log('Creating meal plans...');

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
  const weekOfDate = weekStart.toISOString().split('T')[0] ?? '';

  await db.insert(schema.meals).values([
    {
      name: 'Spaghetti and Meatballs',
      dayOfWeek: 'monday',
      mealType: 'dinner',
      weekOf: weekOfDate,
      createdBy: jordan.id,
    },
    {
      name: 'Grilled Chicken Salad',
      dayOfWeek: 'tuesday',
      mealType: 'dinner',
      weekOf: weekOfDate,
      createdBy: jordan.id,
    },
    {
      name: 'Taco Tuesday',
      dayOfWeek: 'tuesday',
      mealType: 'lunch',
      weekOf: weekOfDate,
      createdBy: jordan.id,
    },
    {
      name: 'Pizza Night',
      dayOfWeek: 'friday',
      mealType: 'dinner',
      weekOf: weekOfDate,
      createdBy: alex.id,
    },
  ]);

  console.log('  Created 4 meal plans');

  // ============================================================================
  // MAINTENANCE REMINDERS
  // ============================================================================
  console.log('Creating maintenance reminders...');

  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthDate = nextMonth.toISOString().split('T')[0] ?? '';

  await db.insert(schema.maintenanceReminders).values([
    {
      title: 'Change furnace filter',
      category: 'home',
      description: 'Replace the HVAC filter',
      schedule: 'quarterly',
      nextDue: nextMonthDate,
      assignedTo: alex.id,
      createdBy: alex.id,
    },
    {
      title: 'Car oil change',
      category: 'car',
      description: 'Family car - regular oil change',
      schedule: 'quarterly',
      nextDue: nextMonthDate,
      assignedTo: alex.id,
      createdBy: alex.id,
    },
    {
      title: 'Test smoke detectors',
      category: 'home',
      schedule: 'monthly',
      nextDue: nextMonthDate,
      createdBy: jordan.id,
    },
  ]);

  console.log('  Created 3 maintenance reminders');

  // ============================================================================
  // BIRTHDAYS
  // ============================================================================
  console.log('Creating birthdays...');

  await db.insert(schema.birthdays).values([
    {
      name: 'Emma',
      birthDate: '2014-09-10',
      userId: emma.id,
    },
    {
      name: 'Sophie',
      birthDate: '2017-12-03',
      userId: sophie.id,
    },
  ]);

  console.log('  Created 2 birthdays');

  // ============================================================================
  // SETTINGS
  // ============================================================================
  console.log('Creating default settings...');

  await db.insert(schema.settings).values([
    {
      key: 'theme',
      value: { mode: 'system' },
    },
    {
      key: 'location',
      value: { city: 'Springfield', state: 'IL', country: 'US' },
    },
    {
      key: 'security',
      value: {
        requirePinForEvents: true,
        requirePinForDelete: true,
        requirePinForSettings: true,
        sessionTimeout: 30,
      },
    },
  ]);

  console.log('  Created 3 settings');

  // ============================================================================
  // LAYOUTS
  // ============================================================================
  console.log('Creating default layout...');

  await db.insert(schema.layouts).values([
    {
      name: 'Default Dashboard',
      isDefault: true,
      widgets: [
        { i: 'calendar', x: 0, y: 0, w: 2, h: 2 },
        { i: 'clock', x: 2, y: 0, w: 1, h: 1 },
        { i: 'weather', x: 3, y: 0, w: 1, h: 2 },
        { i: 'tasks', x: 2, y: 1, w: 1, h: 2 },
        { i: 'messages', x: 0, y: 2, w: 1, h: 2 },
        { i: 'chores', x: 1, y: 2, w: 1, h: 2 },
        { i: 'shopping', x: 3, y: 2, w: 1, h: 2 },
        { i: 'birthdays', x: 0, y: 4, w: 1, h: 2 },
        { i: 'meals', x: 1, y: 4, w: 2, h: 2 },
      ],
      createdBy: alex.id,
    },
  ]);

  console.log('  Created 1 layout');

  // ============================================================================
  // DONE
  // ============================================================================
  console.log('\nDatabase seeded successfully!');
  console.log('\nDefault PIN for all users: 1234');

  await client.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
