/**
 *
 * Populates the database with sample data for development, testing, and screenshots.
 *
 * Every date is relative to "now" — recurring events use RRULE so the seed stays
 * evergreen. Run today, in three months, or in a year and the demo always looks
 * "now". Re-run via:
 *
 *   npm run db:seed
 *
 * Or from the running app: Settings → Backups → Seed demo data.
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

// ─── Date helpers ──────────────────────────────────────────────────────────
// All date math goes through these so dates are always relative to "now".

const NOW = new Date();

function daysFromNow(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number): Date {
  return daysFromNow(-n);
}

function atTime(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function ymd(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayOfWeekName(date: Date): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  return (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const)[date.getDay()]!;
}

async function seed() {
  console.log('Seeding database...\n');

  // ─── USERS (Family Members) ───────────────────────────────────────────────
  console.log('Creating family members...');

  const hashedPin = await bcrypt.hash('1234', 12);

  const usersResult = await db
    .insert(schema.users)
    .values([
      { name: 'Alex',   role: 'parent', color: '#3B82F6', pin: hashedPin, email: 'alex@example.com',   preferences: { theme: 'system' } },
      { name: 'Jordan', role: 'parent', color: '#EC4899', pin: hashedPin, email: 'jordan@example.com', preferences: { theme: 'system' } },
      { name: 'Emma',   role: 'child',  color: '#10B981', pin: hashedPin, preferences: {} },
      { name: 'Sophie', role: 'child',  color: '#F59E0B', pin: hashedPin, preferences: {} },
    ])
    .returning();

  const alex = usersResult[0]!;
  const jordan = usersResult[1]!;
  const emma = usersResult[2]!;
  const sophie = usersResult[3]!;

  console.log(`  Created 4 family members`);

  // ─── TASK LISTS ───────────────────────────────────────────────────────────
  console.log('Creating task lists...');

  const taskListsResult = await db
    .insert(schema.taskLists)
    .values([
      { name: 'Inbox',  color: '#6B7280', sortOrder: 0, createdBy: alex.id },
      { name: 'Family', color: '#EC4899', sortOrder: 1, createdBy: alex.id },
      { name: 'Home',   color: '#F59E0B', sortOrder: 2, createdBy: alex.id },
      { name: 'Work',   color: '#3B82F6', sortOrder: 3, createdBy: alex.id },
      { name: 'School', color: '#10B981', sortOrder: 4, createdBy: jordan.id },
    ])
    .returning();

  const listInbox  = taskListsResult[0]!;
  const listFamily = taskListsResult[1]!;
  const listHome   = taskListsResult[2]!;
  const listWork   = taskListsResult[3]!;
  const listSchool = taskListsResult[4]!;

  console.log(`  Created 5 task lists`);

  // ─── TASKS ────────────────────────────────────────────────────────────────
  console.log('Creating tasks...');

  await db.insert(schema.tasks).values([
    // Overdue (visible at top of list)
    { title: 'Return library books',          listId: listFamily.id, assignedTo: emma.id,   dueDate: daysAgo(2),   priority: 'low',    category: 'Errands',   createdBy: jordan.id },
    // Today
    { title: 'Practice piano (30 min)',       listId: listSchool.id, assignedTo: sophie.id, dueDate: daysFromNow(0), priority: 'medium', category: 'Activities', createdBy: jordan.id },
    { title: 'Submit field-trip permission',  listId: listSchool.id, assignedTo: jordan.id, dueDate: daysFromNow(0), priority: 'high',   category: 'School',     createdBy: jordan.id },
    // Tomorrow
    { title: 'Fix leaky bathroom faucet',     listId: listHome.id,   assignedTo: alex.id,   dueDate: daysFromNow(1), priority: 'high',   category: 'Home', description: 'Upstairs faucet is dripping', createdBy: jordan.id },
    { title: 'Pick up dry cleaning',          listId: listFamily.id, assignedTo: alex.id,   dueDate: daysFromNow(1), priority: 'medium', category: 'Errands',  createdBy: alex.id },
    // This week
    { title: 'Schedule dentist appointments', listId: listFamily.id, assignedTo: jordan.id, dueDate: daysFromNow(4), priority: 'medium', category: 'Health',   description: 'Book checkups for the whole family', createdBy: jordan.id },
    { title: 'Science project research',      listId: listSchool.id, assignedTo: emma.id,   dueDate: daysFromNow(5), priority: 'high',   category: 'School',   description: 'Research the solar system', createdBy: emma.id },
    // Next week
    { title: 'Buy birthday gift for Grandma', listId: listFamily.id, assignedTo: alex.id,   dueDate: daysFromNow(8), priority: 'medium', category: 'Shopping', createdBy: alex.id },
    { title: 'Renew car registration',        listId: listHome.id,   assignedTo: alex.id,   dueDate: daysFromNow(12), priority: 'high',  category: 'Errands',  createdBy: alex.id },
    { title: 'Quarterly budget review',       listId: listWork.id,   assignedTo: alex.id,   dueDate: daysFromNow(14), priority: 'medium', category: 'Finance', createdBy: alex.id },
    // No date / inbox
    { title: 'Research family vacation ideas', listId: listInbox.id,  assignedTo: jordan.id, priority: 'low',  category: 'Planning', createdBy: jordan.id },
    // Recently completed (shown briefly, then settles in history)
    { title: 'Grocery shopping',              listId: listFamily.id, assignedTo: jordan.id, completed: true, completedAt: daysAgo(1), completedBy: jordan.id, createdBy: jordan.id },
    { title: 'Take out trash',                listId: listHome.id,   assignedTo: emma.id,   completed: true, completedAt: daysAgo(1), completedBy: emma.id,   createdBy: jordan.id },
  ]);

  console.log(`  Created 13 tasks`);

  // ─── FAMILY MESSAGES ──────────────────────────────────────────────────────
  console.log('Creating family messages...');

  await db.insert(schema.familyMessages).values([
    { message: 'Soccer practice moved to 4pm today!',                authorId: jordan.id, important: true,  pinned: true },
    { message: 'Grandma is coming to visit this weekend',            authorId: jordan.id, pinned: true },
    { message: 'Great job on your spelling test, Emma! 🌟',          authorId: alex.id },
    { message: "Don't forget to feed the fish before bed",           authorId: sophie.id },
    { message: 'New code for the side gate: 4297',                   authorId: alex.id, important: true },
    { message: 'Spring break is in 3 weeks — start packing lists!',  authorId: jordan.id },
  ]);

  console.log(`  Created 6 family messages`);

  // ─── CALENDAR SOURCES (local "Family" + per-person) ───────────────────────
  console.log('Creating calendar sources...');

  const calSourcesResult = await db
    .insert(schema.calendarSources)
    .values([
      { provider: 'local', sourceCalendarId: 'family-local', dashboardCalendarName: 'Family',  displayName: 'Family',  color: '#EC4899', isFamily: true,  showInEventModal: true, enabled: true },
      { userId: alex.id,   provider: 'local', sourceCalendarId: 'alex-local',   dashboardCalendarName: "Alex's",   displayName: "Alex's",   color: '#3B82F6', isFamily: false, showInEventModal: true, enabled: true },
      { userId: jordan.id, provider: 'local', sourceCalendarId: 'jordan-local', dashboardCalendarName: "Jordan's", displayName: "Jordan's", color: '#EC4899', isFamily: false, showInEventModal: true, enabled: true },
      { userId: emma.id,   provider: 'local', sourceCalendarId: 'emma-local',   dashboardCalendarName: "Emma's",   displayName: "Emma's",   color: '#10B981', isFamily: false, showInEventModal: true, enabled: true },
      { userId: sophie.id, provider: 'local', sourceCalendarId: 'sophie-local', dashboardCalendarName: "Sophie's", displayName: "Sophie's", color: '#F59E0B', isFamily: false, showInEventModal: true, enabled: true },
    ])
    .returning();

  const calFamily = calSourcesResult[0]!;
  const calAlex   = calSourcesResult[1]!;
  const calJordan = calSourcesResult[2]!;
  const calEmma   = calSourcesResult[3]!;
  const calSophie = calSourcesResult[4]!;

  console.log(`  Created 5 calendar sources`);

  // ─── EVENTS (one-off + recurring with RRULE) ──────────────────────────────
  console.log('Creating calendar events...');

  // One-off events
  await db.insert(schema.events).values([
    // Today
    { calendarSourceId: calEmma.id,   title: 'Soccer Practice',    location: 'Community Park',    startTime: atTime(daysFromNow(0), 16, 0), endTime: atTime(daysFromNow(0), 17, 30), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Family Movie Night', description: 'Vote on the movie by Friday!', startTime: atTime(daysFromNow(0), 19, 0), endTime: atTime(daysFromNow(0), 21, 0), color: '#EC4899', createdBy: jordan.id },
    // Tomorrow
    { calendarSourceId: calFamily.id, title: 'Dentist Appointment', location: "Dr. Smith's Office", startTime: atTime(daysFromNow(1), 9, 0), endTime: atTime(daysFromNow(1), 10, 0), color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calSophie.id, title: 'Piano Recital',        location: 'School Auditorium',  startTime: atTime(daysFromNow(1), 18, 0), endTime: atTime(daysFromNow(1), 19, 30), color: '#F59E0B', createdBy: jordan.id },
    // This week
    { calendarSourceId: calAlex.id,   title: 'Team Offsite',         location: 'Downtown',           startTime: atTime(daysFromNow(2), 10, 0), endTime: atTime(daysFromNow(2), 16, 0), color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calFamily.id, title: 'Grandma Arrives',     allDay: true, startTime: atTime(daysFromNow(3), 0, 0), endTime: atTime(daysFromNow(5), 0, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calEmma.id,   title: 'Science Fair',         location: 'Maple Elementary', startTime: atTime(daysFromNow(5), 13, 0), endTime: atTime(daysFromNow(5), 15, 0), color: '#10B981', createdBy: jordan.id },
    // Next week
    { calendarSourceId: calJordan.id, title: "Jordan's Book Club",   location: "Coffee shop",        startTime: atTime(daysFromNow(8), 19, 0), endTime: atTime(daysFromNow(8), 21, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Spring Break Starts',  allDay: true, startTime: atTime(daysFromNow(14), 0, 0), endTime: atTime(daysFromNow(21), 0, 0), color: '#EC4899', createdBy: jordan.id },
    // Past (for historic views)
    { calendarSourceId: calFamily.id, title: 'Parent-Teacher Conference', location: 'Maple Elementary', startTime: atTime(daysAgo(7), 16, 0), endTime: atTime(daysAgo(7), 17, 0), color: '#EC4899', createdBy: jordan.id },
  ]);

  // Recurring events with RRULE — extend forward indefinitely
  await db.insert(schema.events).values([
    // Weekly soccer practice for Emma (Tue + Thu, 4-5:30pm)
    {
      calendarSourceId: calEmma.id,
      title: 'Soccer Practice',
      location: 'Community Park',
      startTime: atTime(daysFromNow(((2 - NOW.getDay()) + 7) % 7), 16, 0),
      endTime:   atTime(daysFromNow(((2 - NOW.getDay()) + 7) % 7), 17, 30),
      recurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      color: '#10B981',
      createdBy: jordan.id,
    },
    // Weekly scout meeting for Sophie (Wed 6-7pm)
    {
      calendarSourceId: calSophie.id,
      title: 'Scouts Meeting',
      location: 'Community Center',
      startTime: atTime(daysFromNow(((3 - NOW.getDay()) + 7) % 7), 18, 0),
      endTime:   atTime(daysFromNow(((3 - NOW.getDay()) + 7) % 7), 19, 0),
      recurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE',
      color: '#F59E0B',
      createdBy: jordan.id,
    },
    // Bi-weekly family game night (Saturday 7-9pm)
    {
      calendarSourceId: calFamily.id,
      title: 'Family Game Night',
      startTime: atTime(daysFromNow(((6 - NOW.getDay()) + 7) % 7), 19, 0),
      endTime:   atTime(daysFromNow(((6 - NOW.getDay()) + 7) % 7), 21, 0),
      recurring: true,
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA',
      color: '#EC4899',
      createdBy: jordan.id,
    },
    // Daily school drop-off (weekdays 8-8:30am, until end of school year)
    {
      calendarSourceId: calFamily.id,
      title: 'School Drop-off',
      startTime: atTime(daysFromNow(((1 - NOW.getDay()) + 7) % 7), 8, 0),
      endTime:   atTime(daysFromNow(((1 - NOW.getDay()) + 7) % 7), 8, 30),
      recurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=' + ymd(daysFromNow(45)).replace(/-/g, '') + 'T000000Z',
      color: '#3B82F6',
      createdBy: alex.id,
    },
    // Monthly date night (first Friday of the month)
    {
      calendarSourceId: calFamily.id,
      title: 'Date Night',
      startTime: atTime(daysFromNow(((5 - NOW.getDay()) + 7) % 7), 19, 0),
      endTime:   atTime(daysFromNow(((5 - NOW.getDay()) + 7) % 7), 22, 0),
      recurring: true,
      recurrenceRule: 'FREQ=MONTHLY;BYDAY=1FR',
      color: '#EC4899',
      createdBy: alex.id,
    },
  ]);

  // Additional one-off events — fill out the month so week / multi-week /
  // month calendar views look like a busy family of four. Spread from ~2 weeks
  // back to ~5 weeks ahead. Colors follow each source (family/Jordan pink,
  // Alex blue, Emma green, Sophie amber).
  await db.insert(schema.events).values([
    // ── Past two weeks (historic fill) ──────────────────────────────────────
    { calendarSourceId: calAlex.id,   title: 'Quarterly Planning',       location: 'Office',            startTime: atTime(daysAgo(13), 9, 0),  endTime: atTime(daysAgo(13), 11, 0), color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calFamily.id, title: 'School Closed',            allDay: true, startTime: atTime(daysAgo(12), 0, 0), endTime: atTime(daysAgo(11), 0, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calEmma.id,   title: 'Soccer Game',              location: 'Community Park',    startTime: atTime(daysAgo(11), 10, 0), endTime: atTime(daysAgo(11), 11, 30), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calSophie.id, title: 'Swim Lesson',              location: 'Rec Center',        startTime: atTime(daysAgo(10), 16, 0), endTime: atTime(daysAgo(10), 16, 45), color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calJordan.id, title: 'Yoga Class',               location: 'Sunrise Studio',    startTime: atTime(daysAgo(9), 7, 30),  endTime: atTime(daysAgo(9), 8, 30),  color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Farmers Market',           location: 'Town Square',       startTime: atTime(daysAgo(8), 9, 0),   endTime: atTime(daysAgo(8), 11, 0),  color: '#EC4899', createdBy: alex.id },
    { calendarSourceId: calAlex.id,   title: 'Dentist',                  location: "Dr. Smith's Office", startTime: atTime(daysAgo(6), 8, 0),  endTime: atTime(daysAgo(6), 8, 45),  color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calEmma.id,   title: 'Library Reading Club',     location: 'Public Library',    startTime: atTime(daysAgo(5), 15, 30), endTime: atTime(daysAgo(5), 16, 30), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calSophie.id, title: 'Playdate with Mia',        startTime: atTime(daysAgo(4), 15, 0),  endTime: atTime(daysAgo(4), 17, 0),  color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: "Dinner at Grandma Helen's", startTime: atTime(daysAgo(3), 17, 30), endTime: atTime(daysAgo(3), 20, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calJordan.id, title: 'Volunteer at Food Bank',   location: 'Community Center',  startTime: atTime(daysAgo(2), 9, 0),   endTime: atTime(daysAgo(2), 12, 0),  color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calAlex.id,   title: 'Haircut',                  startTime: atTime(daysAgo(1), 12, 0),  endTime: atTime(daysAgo(1), 12, 30), color: '#3B82F6', createdBy: alex.id },
    // ── This week and next (near-term busy) ─────────────────────────────────
    { calendarSourceId: calSophie.id, title: 'Piano Lesson',             startTime: atTime(daysFromNow(2), 16, 0),  endTime: atTime(daysFromNow(2), 16, 45), color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calAlex.id,   title: 'Client Call',              startTime: atTime(daysFromNow(2), 14, 0),  endTime: atTime(daysFromNow(2), 15, 0),  color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calEmma.id,   title: 'Art Class',                location: 'Community Center',  startTime: atTime(daysFromNow(3), 16, 0),  endTime: atTime(daysFromNow(3), 17, 0),  color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calJordan.id, title: 'Doctor Checkup',           startTime: atTime(daysFromNow(4), 10, 0),  endTime: atTime(daysFromNow(4), 11, 0),  color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'No School: Teacher Workday', allDay: true, startTime: atTime(daysFromNow(4), 0, 0), endTime: atTime(daysFromNow(5), 0, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Neighborhood BBQ',         startTime: atTime(daysFromNow(6), 12, 0),  endTime: atTime(daysFromNow(6), 15, 0),  color: '#EC4899', createdBy: alex.id },
    { calendarSourceId: calEmma.id,   title: "Sleepover at Mia's",       allDay: true, startTime: atTime(daysFromNow(6), 0, 0), endTime: atTime(daysFromNow(7), 0, 0), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calSophie.id, title: 'Birthday Party for Lucas', startTime: atTime(daysFromNow(7), 14, 0),  endTime: atTime(daysFromNow(7), 16, 0),  color: '#F59E0B', createdBy: jordan.id },
    // ── Two to three weeks out ──────────────────────────────────────────────
    { calendarSourceId: calAlex.id,   title: 'Work Conference',          location: 'Chicago',           allDay: true, startTime: atTime(daysFromNow(9), 0, 0), endTime: atTime(daysFromNow(12), 0, 0), color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calEmma.id,   title: 'Field Trip: Science Museum', allDay: true, startTime: atTime(daysFromNow(11), 0, 0), endTime: atTime(daysFromNow(12), 0, 0), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calSophie.id, title: 'Dentist',                  startTime: atTime(daysFromNow(12), 9, 0),  endTime: atTime(daysFromNow(12), 9, 45), color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calJordan.id, title: 'Girls Night Out',          startTime: atTime(daysFromNow(12), 19, 0), endTime: atTime(daysFromNow(12), 22, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Family Movie Night',       startTime: atTime(daysFromNow(13), 19, 0), endTime: atTime(daysFromNow(13), 21, 0), color: '#EC4899', createdBy: alex.id },
    // ── Spring break and a weekend trip ─────────────────────────────────────
    { calendarSourceId: calFamily.id, title: 'Beach Trip',               location: 'Coastline',         allDay: true, startTime: atTime(daysFromNow(16), 0, 0), endTime: atTime(daysFromNow(19), 0, 0), color: '#EC4899', createdBy: alex.id },
    { calendarSourceId: calEmma.id,   title: 'Summer Camp Registration Opens', startTime: atTime(daysFromNow(18), 10, 0), endTime: atTime(daysFromNow(18), 10, 30), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calAlex.id,   title: 'Back to Office',           startTime: atTime(daysFromNow(20), 9, 0),  endTime: atTime(daysFromNow(20), 17, 0), color: '#3B82F6', createdBy: alex.id },
    // ── Four to five weeks out ──────────────────────────────────────────────
    { calendarSourceId: calSophie.id, title: 'Soccer Tryouts',           location: 'Community Park',    startTime: atTime(daysFromNow(22), 16, 0), endTime: atTime(daysFromNow(22), 17, 30), color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calJordan.id, title: 'Bake Sale (parent volunteer)', location: 'Maple Elementary', startTime: atTime(daysFromNow(23), 8, 0), endTime: atTime(daysFromNow(23), 10, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calAlex.id,   title: 'Car Service',              location: 'Auto Shop',         startTime: atTime(daysFromNow(24), 8, 0),  endTime: atTime(daysFromNow(24), 9, 0),  color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calFamily.id, title: "Grandpa Joe's Birthday Dinner", startTime: atTime(daysFromNow(25), 18, 0), endTime: atTime(daysFromNow(25), 20, 0), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calEmma.id,   title: 'Piano Recital',            location: 'School Auditorium', startTime: atTime(daysFromNow(26), 18, 0), endTime: atTime(daysFromNow(26), 19, 30), color: '#10B981', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Community Fun Run',        allDay: true, startTime: atTime(daysFromNow(27), 0, 0), endTime: atTime(daysFromNow(28), 0, 0), color: '#EC4899', createdBy: alex.id },
    { calendarSourceId: calSophie.id, title: 'Field Day',                location: 'Maple Elementary',  allDay: true, startTime: atTime(daysFromNow(30), 0, 0), endTime: atTime(daysFromNow(31), 0, 0), color: '#F59E0B', createdBy: jordan.id },
    { calendarSourceId: calAlex.id,   title: 'Team Lunch',               startTime: atTime(daysFromNow(31), 12, 0), endTime: atTime(daysFromNow(31), 13, 0), color: '#3B82F6', createdBy: alex.id },
    { calendarSourceId: calJordan.id, title: 'Dentist',                  startTime: atTime(daysFromNow(33), 14, 0), endTime: atTime(daysFromNow(33), 14, 45), color: '#EC4899', createdBy: jordan.id },
    { calendarSourceId: calFamily.id, title: 'Camping Weekend',          location: 'State Park',        allDay: true, startTime: atTime(daysFromNow(34), 0, 0), endTime: atTime(daysFromNow(36), 0, 0), color: '#EC4899', createdBy: alex.id },
  ]);

  console.log(`  Created 53 events (48 one-off + 5 recurring)`);

  // ─── CALENDAR NOTES ───────────────────────────────────────────────────────
  console.log('Creating calendar notes...');

  await db.insert(schema.calendarNotes).values([
    { date: ymd(daysFromNow(0)), content: 'Pickup line will be a mess after the science fair — leave early', createdBy: jordan.id },
    { date: ymd(daysFromNow(3)), content: '<b>Grandma\'s allergies:</b> peanuts, shellfish. Plan meals accordingly.', createdBy: jordan.id },
    { date: ymd(daysFromNow(14)), content: 'Spring break itinerary draft — confirm hotel by Monday', createdBy: alex.id },
  ]);

  console.log(`  Created 3 calendar notes`);

  // ─── CHORES + HISTORY ─────────────────────────────────────────────────────
  console.log('Creating chores...');

  const choresResult = await db
    .insert(schema.chores)
    .values([
      { title: 'Empty dishwasher',  description: 'Put away all clean dishes',     category: 'dishes',  assignedTo: emma.id,   frequency: 'daily',  pointValue: 5,  requiresApproval: false, nextDue: ymd(daysFromNow(0)), createdBy: jordan.id },
      { title: 'Make bed',          description: 'Make your bed before school',   category: 'cleaning', frequency: 'daily',  pointValue: 2,  requiresApproval: false, nextDue: ymd(daysFromNow(0)), createdBy: jordan.id },
      { title: 'Feed the pets',     description: 'Feed the fish and cat',         category: 'pets',     assignedTo: sophie.id, frequency: 'daily',  pointValue: 3,  requiresApproval: false, nextDue: ymd(daysFromNow(0)), createdBy: alex.id },
      { title: 'Clean room',        description: 'Tidy up and vacuum your room',  category: 'cleaning', assignedTo: emma.id,   frequency: 'weekly', pointValue: 10, requiresApproval: true,  nextDue: ymd(daysFromNow(2)), createdBy: jordan.id, startDay: '0' },
      { title: 'Take out trash',    description: 'Curb by 7am Friday',            category: 'trash',    assignedTo: emma.id,   frequency: 'weekly', pointValue: 5,  requiresApproval: false, nextDue: ymd(daysFromNow(((5 - NOW.getDay()) + 7) % 7)), createdBy: alex.id, startDay: '5' },
      { title: 'Sweep front porch', description: 'Sweep and water the plants',    category: 'yard',     assignedTo: sophie.id, frequency: 'weekly', pointValue: 5,  requiresApproval: false, nextDue: ymd(daysFromNow(3)), createdBy: alex.id, startDay: '6' },
      { title: 'Load + run washer', description: 'Family colors load',            category: 'laundry',  assignedTo: jordan.id, frequency: 'weekly', pointValue: 0,  requiresApproval: false, nextDue: ymd(daysFromNow(1)), createdBy: jordan.id },
      { title: 'Clean bathroom',    description: 'Sink, toilet, mirror',          category: 'cleaning', assignedTo: emma.id,   frequency: 'weekly', pointValue: 15, requiresApproval: true,  nextDue: ymd(daysFromNow(4)), createdBy: jordan.id },
    ])
    .returning();

  const choreEmptyDishwasher = choresResult[0]!;
  const choreMakeBed = choresResult[1]!;
  const choreFeedPets = choresResult[2]!;
  const choreCleanRoom = choresResult[3]!;
  const choreTakeTrash = choresResult[4]!;
  const choreSweepPorch = choresResult[5]!;

  console.log(`  Created 8 chores`);

  // Backdated completion history — last 7 days, mostly approved, one pending
  console.log('Creating chore completion history...');

  const choreCompletionRows = [];
  for (let dayBack = 6; dayBack >= 0; dayBack--) {
    const t = daysAgo(dayBack);
    // Emma's dishwasher: every day except one missed
    if (dayBack !== 4) {
      choreCompletionRows.push({
        choreId: choreEmptyDishwasher.id,
        completedBy: emma.id,
        completedAt: atTime(t, 19, 30),
        approvedBy: jordan.id,
        approvedAt: atTime(t, 20, 0),
        pointsAwarded: 5,
      });
    }
    // Make bed: Emma + Sophie both did it most days
    choreCompletionRows.push({
      choreId: choreMakeBed.id,
      completedBy: emma.id,
      completedAt: atTime(t, 7, 30),
      approvedBy: jordan.id,
      approvedAt: atTime(t, 7, 35),
      pointsAwarded: 2,
    });
    if (dayBack !== 2) {
      choreCompletionRows.push({
        choreId: choreMakeBed.id,
        completedBy: sophie.id,
        completedAt: atTime(t, 7, 45),
        approvedBy: alex.id,
        approvedAt: atTime(t, 7, 50),
        pointsAwarded: 2,
      });
    }
    // Sophie's pets: every day
    choreCompletionRows.push({
      choreId: choreFeedPets.id,
      completedBy: sophie.id,
      completedAt: atTime(t, 17, 0),
      approvedBy: alex.id,
      approvedAt: atTime(t, 17, 5),
      pointsAwarded: 3,
    });
  }
  // Clean room: completed last week
  choreCompletionRows.push({
    choreId: choreCleanRoom.id,
    completedBy: emma.id,
    completedAt: atTime(daysAgo(6), 11, 0),
    approvedBy: jordan.id,
    approvedAt: atTime(daysAgo(6), 11, 15),
    pointsAwarded: 10,
  });
  // Take out trash: completed last Friday
  choreCompletionRows.push({
    choreId: choreTakeTrash.id,
    completedBy: emma.id,
    completedAt: atTime(daysAgo(3), 6, 45),
    approvedBy: alex.id,
    approvedAt: atTime(daysAgo(3), 7, 0),
    pointsAwarded: 5,
  });
  // Pending approval — Emma claims clean-room done today, awaiting parent OK
  choreCompletionRows.push({
    choreId: choreCleanRoom.id,
    completedBy: emma.id,
    completedAt: atTime(daysFromNow(0), 16, 0),
    // approvedBy + approvedAt intentionally null = pending
    pointsAwarded: null,
  });
  // Sophie swept the porch on Sunday
  choreCompletionRows.push({
    choreId: choreSweepPorch.id,
    completedBy: sophie.id,
    completedAt: atTime(daysAgo(2), 10, 30),
    approvedBy: alex.id,
    approvedAt: atTime(daysAgo(2), 11, 0),
    pointsAwarded: 5,
  });

  await db.insert(schema.choreCompletions).values(choreCompletionRows);

  console.log(`  Created ${choreCompletionRows.length} chore completions (including 1 pending)`);

  // ─── SHOPPING LISTS ───────────────────────────────────────────────────────
  console.log('Creating shopping lists...');

  const shoppingListsResult = await db
    .insert(schema.shoppingLists)
    .values([
      { name: 'Grocery',  icon: 'shopping-cart', color: '#10B981', listType: 'grocery',  sortOrder: 0, createdBy: jordan.id },
      { name: 'Target',   icon: 'shopping-bag',  color: '#EF4444', listType: 'general',  sortOrder: 1, createdBy: jordan.id },
      { name: 'Hardware', icon: 'wrench',        color: '#F59E0B', listType: 'hardware', sortOrder: 2, createdBy: alex.id },
      { name: 'Costco',   icon: 'package',       color: '#3B82F6', listType: 'grocery',  sortOrder: 3, createdBy: alex.id },
    ])
    .returning();

  const groceryList  = shoppingListsResult[0]!;
  const targetList   = shoppingListsResult[1]!;
  const hardwareList = shoppingListsResult[2]!;
  const costcoList   = shoppingListsResult[3]!;

  console.log(`  Created 4 shopping lists`);

  // Shopping items — mix of unchecked + checked across categories
  console.log('Creating shopping items...');

  const shoppingItemRows: (typeof schema.shoppingItems.$inferInsert)[] = [
    // Grocery — unchecked (the active list)
    { listId: groceryList.id, name: 'Milk',           quantity: 1, unit: 'gallon', category: 'dairy',    addedBy: jordan.id },
    { listId: groceryList.id, name: 'Eggs',           quantity: 1, unit: 'dozen',  category: 'dairy',    addedBy: jordan.id },
    { listId: groceryList.id, name: 'Bread',          quantity: 2, unit: 'loaves', category: 'bakery',   addedBy: jordan.id },
    { listId: groceryList.id, name: 'Bananas',        quantity: 6, category: 'produce',                  addedBy: alex.id },
    { listId: groceryList.id, name: 'Spinach',        quantity: 1, unit: 'bag',    category: 'produce',  addedBy: jordan.id },
    { listId: groceryList.id, name: 'Strawberries',   quantity: 1, unit: 'lb',     category: 'produce',  addedBy: emma.id },
    { listId: groceryList.id, name: 'Chicken breast', quantity: 2, unit: 'lbs',    category: 'meat',     addedBy: jordan.id },
    { listId: groceryList.id, name: 'Ground beef',    quantity: 1, unit: 'lb',     category: 'meat',     addedBy: alex.id },
    { listId: groceryList.id, name: 'Greek yogurt',   quantity: 4, unit: 'cups',   category: 'dairy',    addedBy: jordan.id },
    { listId: groceryList.id, name: 'Pasta',          quantity: 1, unit: 'box',    category: 'pantry',   addedBy: alex.id },
    { listId: groceryList.id, name: 'Marinara sauce', quantity: 1, unit: 'jar',    category: 'pantry',   addedBy: alex.id },
    { listId: groceryList.id, name: 'Frozen waffles', quantity: 1, unit: 'box',    category: 'frozen',   addedBy: sophie.id },
    // Grocery — already checked (recently bought)
    { listId: groceryList.id, name: 'Cereal',         quantity: 1, unit: 'box',    category: 'pantry',   addedBy: emma.id,   checked: true },
    { listId: groceryList.id, name: 'Orange juice',   quantity: 1, unit: 'carton', category: 'beverages', addedBy: jordan.id, checked: true },
    // Target list
    { listId: targetList.id,  name: 'Toilet paper',    quantity: 1, unit: 'pack',   category: 'household', addedBy: alex.id },
    { listId: targetList.id,  name: 'Laundry detergent', quantity: 1,               category: 'household', addedBy: jordan.id },
    { listId: targetList.id,  name: 'Socks for Sophie', quantity: 1, unit: 'pack',  category: 'clothes',   addedBy: jordan.id },
    { listId: targetList.id,  name: 'Notebook',         quantity: 2,                category: 'office',    addedBy: emma.id },
    // Hardware
    { listId: hardwareList.id, name: 'Lightbulbs',      quantity: 4, category: 'household', addedBy: alex.id },
    { listId: hardwareList.id, name: 'Furnace filter',  quantity: 1, category: 'household', addedBy: alex.id },
    { listId: hardwareList.id, name: 'Sink washers',    quantity: 1, category: 'household', addedBy: alex.id, notes: 'For the leaky bathroom faucet' },
    // Costco (mostly checked — last trip)
    { listId: costcoList.id,   name: 'Paper towels',    quantity: 1, unit: 'case',  category: 'household', addedBy: jordan.id, checked: true },
    { listId: costcoList.id,   name: 'Bottled water',   quantity: 1, unit: 'case',  category: 'beverages', addedBy: jordan.id, checked: true },
    { listId: costcoList.id,   name: 'Chicken thighs',  quantity: 1, unit: 'pack',  category: 'meat',      addedBy: alex.id },
  ];

  await db.insert(schema.shoppingItems).values(shoppingItemRows);

  console.log(`  Created ${shoppingItemRows.length} shopping items across 4 lists`);

  // ─── RECIPES ──────────────────────────────────────────────────────────────
  console.log('Creating recipes...');

  const recipesResult = await db
    .insert(schema.recipes)
    .values([
      {
        name: 'Sheet Pan Meatball Pitas',
        description: 'Family-favorite weeknight dinner — meatballs, garlic fries, tzatziki, all on one sheet pan.',
        sourceType: 'manual',
        ingredients: [
          { heading: 'Fries:' },
          { text: '1.5 lb russet potatoes, cut into wedges' },
          { text: '2 tbsp olive oil' },
          { text: '4 cloves garlic, minced' },
          { text: '1 tsp salt' },
          { heading: 'Meatballs:' },
          { text: '1 lb ground beef' },
          { text: '1/2 cup breadcrumbs' },
          { text: '1 egg' },
          { text: '1/4 cup parsley, chopped' },
          { text: '2 tsp oregano' },
          { heading: 'For serving:' },
          { text: '6 pita breads, warmed' },
          { text: '1 cup tzatziki sauce' },
          { text: '1 cucumber, sliced' },
          { text: '1 cup grape tomatoes, halved' },
        ],
        instructions: '1. Preheat oven to 425°F.\n2. Toss potato wedges with olive oil, garlic, and salt. Spread on half a sheet pan.\n3. Mix meatball ingredients and form into 1-inch balls. Place on other half of sheet pan.\n4. Roast 25-30 minutes until meatballs are cooked through and fries are crisp.\n5. Stuff pitas with meatballs, fries, tzatziki, cucumber, and tomatoes.',
        prepTime: 20,
        cookTime: 30,
        servings: 4,
        tags: ['weeknight', 'kid-friendly', 'sheet-pan'],
        cuisine: 'Mediterranean',
        category: 'Main Dish',
        rating: 5,
        isFavorite: true,
        timesMade: 7,
        lastMadeAt: daysAgo(11),
        createdBy: jordan.id,
      },
      {
        name: 'One-Pot Chicken Pasta',
        description: 'Tender chicken, pasta, and parmesan — everything cooks in one pot.',
        sourceType: 'manual',
        ingredients: [
          { text: '1.5 lb chicken breast, cubed' },
          { text: '1 tbsp olive oil' },
          { text: '4 cloves garlic, minced' },
          { text: '1 lb penne pasta' },
          { text: '4 cups chicken broth' },
          { text: '1 cup heavy cream' },
          { text: '1 cup parmesan, grated' },
          { text: '2 tsp Italian seasoning' },
          { text: '1 cup baby spinach' },
          { text: 'Salt and pepper to taste' },
        ],
        instructions: '1. Heat olive oil in a large pot. Brown chicken with salt and pepper.\n2. Add garlic and cook 30 seconds.\n3. Add pasta, broth, and Italian seasoning. Bring to a boil, then simmer 12 minutes.\n4. Stir in cream, parmesan, and spinach. Cook 2 more minutes.\n5. Adjust seasoning and serve.',
        prepTime: 10,
        cookTime: 25,
        servings: 4,
        tags: ['one-pot', 'weeknight', 'creamy'],
        cuisine: 'Italian',
        category: 'Main Dish',
        rating: 4,
        isFavorite: true,
        timesMade: 12,
        lastMadeAt: daysAgo(5),
        createdBy: alex.id,
      },
      {
        name: 'Classic Spaghetti and Meatballs',
        description: 'Sunday gravy with hand-rolled meatballs.',
        sourceType: 'manual',
        url: 'https://www.allrecipes.com/recipe/example-spaghetti',
        ingredients: [
          { text: '1 lb spaghetti' },
          { text: '1 lb ground beef' },
          { text: '1/2 cup breadcrumbs' },
          { text: '1 egg' },
          { text: '1/4 cup parmesan, grated' },
          { text: '1 jar (24 oz) marinara sauce' },
          { text: 'Fresh basil, for serving' },
        ],
        instructions: '1. Cook spaghetti per package instructions.\n2. Mix beef, breadcrumbs, egg, parmesan into meatballs (about 16).\n3. Brown meatballs in a skillet, then simmer in marinara for 15 min.\n4. Serve over spaghetti with basil and extra parmesan.',
        prepTime: 15,
        cookTime: 25,
        servings: 4,
        tags: ['classic', 'kid-friendly', 'weeknight'],
        cuisine: 'Italian',
        category: 'Main Dish',
        rating: 5,
        isFavorite: true,
        timesMade: 24,
        lastMadeAt: daysAgo(7),
        createdBy: jordan.id,
      },
      {
        name: 'Sunday Pancakes',
        description: 'Fluffy buttermilk pancakes the kids ask for every weekend.',
        sourceType: 'manual',
        ingredients: [
          { text: '2 cups flour' },
          { text: '2 tbsp sugar' },
          { text: '2 tsp baking powder' },
          { text: '1 tsp baking soda' },
          { text: '1/2 tsp salt' },
          { text: '2 cups buttermilk' },
          { text: '2 eggs' },
          { text: '4 tbsp butter, melted' },
        ],
        instructions: '1. Whisk dry ingredients in a large bowl.\n2. In another bowl, whisk buttermilk, eggs, and butter.\n3. Stir wet into dry until just combined (lumps are fine).\n4. Cook 1/4 cup batter per pancake on a hot griddle, flipping when bubbles form.',
        prepTime: 5,
        cookTime: 15,
        servings: 6,
        tags: ['breakfast', 'weekend', 'kid-friendly'],
        cuisine: 'American',
        category: 'Breakfast',
        rating: 5,
        isFavorite: true,
        timesMade: 30,
        lastMadeAt: daysAgo(3),
        createdBy: alex.id,
      },
      {
        name: 'Taco Tuesday',
        description: 'Quick weeknight tacos. Everyone customizes their own.',
        sourceType: 'manual',
        ingredients: [
          { text: '1 lb ground beef' },
          { text: '1 packet taco seasoning' },
          { text: '12 corn tortillas' },
          { text: '1 cup shredded cheese' },
          { text: '1 cup lettuce, shredded' },
          { text: '2 tomatoes, diced' },
          { text: '1/2 red onion, diced' },
          { text: 'Sour cream, salsa, lime wedges for serving' },
        ],
        instructions: '1. Brown ground beef in a skillet, drain excess fat.\n2. Add taco seasoning + 1/2 cup water, simmer 5 min.\n3. Warm tortillas in a dry pan or microwave.\n4. Build tacos with toppings to taste.',
        prepTime: 10,
        cookTime: 15,
        servings: 4,
        tags: ['weeknight', 'kid-friendly', 'quick'],
        cuisine: 'Mexican',
        category: 'Main Dish',
        rating: 4,
        isFavorite: false,
        timesMade: 18,
        lastMadeAt: daysAgo(2),
        createdBy: jordan.id,
      },
      {
        name: 'Grilled Chicken Salad',
        description: 'Light dinner for warm evenings.',
        sourceType: 'manual',
        ingredients: [
          { text: '2 chicken breasts' },
          { text: '2 tbsp olive oil' },
          { text: '1 lemon, juiced' },
          { text: '6 cups mixed greens' },
          { text: '1 avocado, sliced' },
          { text: '1 cucumber, sliced' },
          { text: '1/4 cup feta, crumbled' },
          { text: '2 tbsp balsamic vinaigrette' },
        ],
        instructions: '1. Marinate chicken in olive oil and lemon juice for 15 minutes.\n2. Grill chicken 6 minutes per side. Let rest, then slice.\n3. Toss greens with veggies, top with chicken and feta. Drizzle vinaigrette.',
        prepTime: 20,
        cookTime: 15,
        servings: 2,
        tags: ['healthy', 'salad', 'quick'],
        cuisine: 'American',
        category: 'Main Dish',
        rating: 4,
        isFavorite: false,
        timesMade: 8,
        lastMadeAt: daysAgo(14),
        createdBy: alex.id,
      },
      {
        name: "Grandma's Banana Bread",
        description: 'Always uses overripe bananas — perfect for the ones the kids forgot about.',
        sourceType: 'manual',
        ingredients: [
          { text: '3 ripe bananas, mashed' },
          { text: '1/3 cup melted butter' },
          { text: '3/4 cup sugar' },
          { text: '1 egg, beaten' },
          { text: '1 tsp vanilla' },
          { text: '1 tsp baking soda' },
          { text: 'Pinch of salt' },
          { text: '1.5 cups flour' },
        ],
        instructions: '1. Preheat oven to 350°F. Grease a loaf pan.\n2. Mix mashed bananas with melted butter. Stir in sugar, egg, and vanilla.\n3. Sprinkle baking soda and salt over the mixture, stir.\n4. Add flour, stir until just combined.\n5. Pour into pan, bake 50-60 minutes until a toothpick comes out clean.',
        prepTime: 10,
        cookTime: 55,
        servings: 8,
        tags: ['bread', 'dessert', 'family-recipe'],
        cuisine: 'American',
        category: 'Bread',
        rating: 5,
        isFavorite: true,
        timesMade: 15,
        lastMadeAt: daysAgo(20),
        createdBy: jordan.id,
      },
    ])
    .returning();

  const recipePita    = recipesResult[0]!;
  const recipePasta   = recipesResult[1]!;
  const recipeSpag    = recipesResult[2]!;
  const recipePancakes = recipesResult[3]!;
  const recipeTacos   = recipesResult[4]!;

  console.log(`  Created ${recipesResult.length} recipes`);

  // ─── MEALS (this + next week, linked to recipes) ──────────────────────────
  console.log('Creating meal plans...');

  const thisWeek = ymd(startOfWeek(NOW));
  const nextWeekStart = ymd(startOfWeek(daysFromNow(7)));

  // Absolute date for each seed meal (weekOf is a Sunday, so date = Sunday +
  // day index). Mirrors src/lib/utils/mealDate.ts, inlined so the esbuild
  // bundle (db:bundle) doesn't need @/-alias resolution.
  const SEED_DAY_NUM: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const seedMealDate = (weekOf: string, dayOfWeek: string): string => {
    const d = new Date(`${weekOf}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (SEED_DAY_NUM[dayOfWeek] ?? 0));
    return d.toISOString().split('T')[0]!;
  };

  await db.insert(schema.meals).values([
    // This week
    { name: 'Pancakes',                  dayOfWeek: 'sunday',    mealType: 'breakfast', weekOf: thisWeek, recipeId: recipePancakes.id, createdBy: alex.id },
    { name: 'Cereal & fruit',            dayOfWeek: 'monday',    mealType: 'breakfast', weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Spaghetti and Meatballs',   dayOfWeek: 'monday',    mealType: 'dinner',    weekOf: thisWeek, recipeId: recipeSpag.id,     createdBy: jordan.id },
    { name: 'Taco Tuesday',              dayOfWeek: 'tuesday',   mealType: 'dinner',    weekOf: thisWeek, recipeId: recipeTacos.id,    createdBy: jordan.id }, // ↓ .map adds `date`
    { name: 'Leftovers',                 dayOfWeek: 'wednesday', mealType: 'dinner',    weekOf: thisWeek, createdBy: alex.id },
    { name: 'One-Pot Chicken Pasta',     dayOfWeek: 'thursday',  mealType: 'dinner',    weekOf: thisWeek, recipeId: recipePasta.id,    createdBy: alex.id },
    { name: 'Pizza Night',               dayOfWeek: 'friday',    mealType: 'dinner',    weekOf: thisWeek, createdBy: alex.id },
    { name: 'Apple slices',              dayOfWeek: 'wednesday', mealType: 'snack',     weekOf: thisWeek, createdBy: emma.id },
    { name: 'Sheet Pan Meatball Pitas',  dayOfWeek: 'saturday',  mealType: 'dinner',    weekOf: thisWeek, recipeId: recipePita.id,     createdBy: jordan.id },
    // Next week
    { name: 'Pancakes',                  dayOfWeek: 'sunday',    mealType: 'breakfast', weekOf: nextWeekStart, recipeId: recipePancakes.id, createdBy: alex.id },
    { name: 'Grilled Chicken Salad',     dayOfWeek: 'monday',    mealType: 'dinner',    weekOf: nextWeekStart, createdBy: alex.id },
    { name: 'Taco Tuesday',              dayOfWeek: 'tuesday',   mealType: 'dinner',    weekOf: nextWeekStart, recipeId: recipeTacos.id,    createdBy: jordan.id },
    // ── This week: fill in breakfasts, lunches, a Sunday dinner + snacks so
    //    the meal planner reads as a full week for screenshots ──────────────
    { name: 'Grilled cheese & tomato soup', dayOfWeek: 'sunday',    mealType: 'lunch',     weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Roast Chicken & Veggies',   dayOfWeek: 'sunday',    mealType: 'dinner',    weekOf: thisWeek, createdBy: alex.id },
    { name: 'Turkey sandwiches',         dayOfWeek: 'monday',    mealType: 'lunch',     weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Scrambled eggs & toast',    dayOfWeek: 'tuesday',   mealType: 'breakfast', weekOf: thisWeek, createdBy: alex.id },
    { name: 'Leftover spaghetti',        dayOfWeek: 'tuesday',   mealType: 'lunch',     weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Oatmeal & berries',         dayOfWeek: 'wednesday', mealType: 'breakfast', weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Chicken salad wraps',       dayOfWeek: 'wednesday', mealType: 'lunch',     weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Yogurt parfaits',           dayOfWeek: 'thursday',  mealType: 'breakfast', weekOf: thisWeek, createdBy: emma.id },
    { name: 'Mac & cheese',              dayOfWeek: 'thursday',  mealType: 'lunch',     weekOf: thisWeek, createdBy: sophie.id },
    { name: 'Fruit smoothies',           dayOfWeek: 'friday',    mealType: 'breakfast', weekOf: thisWeek, createdBy: alex.id },
    { name: 'PB&J and apple slices',     dayOfWeek: 'friday',    mealType: 'lunch',     weekOf: thisWeek, createdBy: emma.id },
    { name: 'Cheese & crackers',         dayOfWeek: 'friday',    mealType: 'snack',     weekOf: thisWeek, createdBy: sophie.id },
    { name: 'Weekend Pancakes',          dayOfWeek: 'saturday',  mealType: 'breakfast', weekOf: thisWeek, recipeId: recipePancakes.id, createdBy: alex.id },
    { name: 'Quesadillas',               dayOfWeek: 'saturday',  mealType: 'lunch',     weekOf: thisWeek, createdBy: jordan.id },
    { name: 'Popcorn',                   dayOfWeek: 'saturday',  mealType: 'snack',     weekOf: thisWeek, createdBy: emma.id },
  ].map((m) => ({ ...m, date: seedMealDate(m.weekOf, m.dayOfWeek) })) as (typeof schema.meals.$inferInsert)[]);

  console.log(`  Created 27 meal plans across this + next week`);

  // ─── MAINTENANCE REMINDERS ────────────────────────────────────────────────
  console.log('Creating maintenance reminders...');

  await db.insert(schema.maintenanceReminders).values([
    { title: 'Change furnace filter',  category: 'home', description: 'Replace the HVAC filter',                    schedule: 'quarterly', nextDue: ymd(daysFromNow(20)), assignedTo: alex.id, createdBy: alex.id },
    { title: 'Car oil change',         category: 'car',  description: 'Family car — regular oil change',           schedule: 'quarterly', nextDue: ymd(daysFromNow(45)), assignedTo: alex.id, createdBy: alex.id },
    { title: 'Test smoke detectors',   category: 'home',                                                            schedule: 'monthly',   nextDue: ymd(daysFromNow(15)),                       createdBy: jordan.id },
    { title: 'Clean gutters',          category: 'home', description: 'Front and back gutters before winter',      schedule: 'custom',    customIntervalDays: 180, nextDue: ymd(daysFromNow(60)), assignedTo: alex.id, createdBy: alex.id },
    { title: 'Service AC',             category: 'home', description: 'Spring AC tune-up',                          schedule: 'annually',  nextDue: ymd(daysFromNow(90)), assignedTo: alex.id, createdBy: alex.id },
  ]);

  console.log(`  Created 5 maintenance reminders`);

  // ─── BIRTHDAYS ────────────────────────────────────────────────────────────
  console.log('Creating birthdays...');

  await db.insert(schema.birthdays).values([
    { name: 'Emma',    birthDate: '2014-09-10', userId: emma.id },
    { name: 'Sophie',  birthDate: '2017-12-03', userId: sophie.id },
    { name: 'Alex',    birthDate: '1985-04-22', userId: alex.id },
    { name: 'Jordan',  birthDate: '1986-07-14', userId: jordan.id },
    { name: 'Grandma Helen', birthDate: '1955-03-19' },
    { name: 'Grandpa Joe',   birthDate: '1953-11-08' },
  ]);

  console.log(`  Created 6 birthdays`);

  // ─── GOALS ────────────────────────────────────────────────────────────────
  console.log('Creating goals...');

  const goalsResult = await db
    .insert(schema.goals)
    .values([
      { name: 'Weekly Allowance', description: 'Earn your weekly spending money',   pointCost: 50,  emoji: '💰', priority: 1, recurring: true,  recurrencePeriod: 'weekly' },
      { name: 'Ice Cream Trip',   description: 'Family trip to the ice cream shop', pointCost: 100, emoji: '🍦', priority: 2, recurring: false },
      { name: 'Movie Night Pick', description: 'Pick the movie for family movie night', pointCost: 75, emoji: '🎬', priority: 3, recurring: false },
      { name: 'New LEGO Set',     description: 'Earn a new LEGO set',               pointCost: 300, emoji: '🧱', priority: 4, recurring: false },
      { name: 'Sleepover',        description: 'Host a sleepover with friends',     pointCost: 200, emoji: '🛏️', priority: 5, recurring: false },
    ])
    .returning();

  const goalAllowance  = goalsResult[0]!;
  const goalMovieNight = goalsResult[2]!;

  console.log(`  Created 5 goals`);

  // ─── GOAL ACHIEVEMENTS (earned-points history) ────────────────────────────
  // The weekly allowance is recurring, so each child earns it once per week —
  // one row per (goal, child, week-start). Emma has hit it the last few weeks,
  // Sophie most of them. Emma has also earned the one-off Movie Night Pick this
  // cycle. periodStart mirrors getGoalPeriodKey(): recurring = start of week
  // (Sunday), non-recurring = the goal's lastResetAt day (seeded "now").
  console.log('Creating goal achievements...');

  const goalAchievementRows: (typeof schema.goalAchievements.$inferInsert)[] = [];
  for (const n of [0, 1, 2, 3]) {
    goalAchievementRows.push({
      goalId: goalAllowance.id,
      userId: emma.id,
      periodStart: ymd(startOfWeek(daysAgo(n * 7))),
      achievedAt: atTime(daysAgo(n * 7), 18, 0),
    });
  }
  for (const n of [0, 1, 2]) {
    goalAchievementRows.push({
      goalId: goalAllowance.id,
      userId: sophie.id,
      periodStart: ymd(startOfWeek(daysAgo(n * 7))),
      achievedAt: atTime(daysAgo(n * 7), 18, 30),
    });
  }
  goalAchievementRows.push({
    goalId: goalMovieNight.id,
    userId: emma.id,
    periodStart: ymd(NOW),
    achievedAt: atTime(daysAgo(2), 17, 0),
  });

  await db.insert(schema.goalAchievements).values(goalAchievementRows);

  console.log(`  Created ${goalAchievementRows.length} goal achievements`);

  // ─── BABYSITTER INFO ──────────────────────────────────────────────────────
  console.log('Creating babysitter info...');

  await db.insert(schema.babysitterInfo).values([
    // Emergency contacts
    { section: 'emergency_contact', sortOrder: 0, content: { name: 'Alex Parker',   relationship: 'Dad (cell)',              phone: '(555) 234-1010', isPrimary: 'true' } },
    { section: 'emergency_contact', sortOrder: 1, content: { name: 'Jordan Parker', relationship: 'Mom (cell)',              phone: '(555) 234-1011', isPrimary: 'true' } },
    { section: 'emergency_contact', sortOrder: 2, content: { name: 'Grandma Helen', relationship: 'Grandmother, 5 min away',  phone: '(555) 234-2020', isPrimary: 'false' } },
    { section: 'emergency_contact', sortOrder: 3, content: { name: 'Poison Control', relationship: '24/7 hotline',            phone: '(800) 222-1222', isPrimary: 'false' } },
    // House info (WiFi password + door code marked sensitive = PIN to reveal)
    { section: 'house_info', sortOrder: 0, content: { label: 'Address',         value: '42 Maple Street, Springfield, IL' } },
    { section: 'house_info', sortOrder: 1, content: { label: 'WiFi Network',    value: 'ParkerFamily' } },
    { section: 'house_info', sortOrder: 2, content: { label: 'WiFi Password',   value: 'sunflower-2231' }, isSensitive: true },
    { section: 'house_info', sortOrder: 3, content: { label: 'Front Door Code', value: '4297' }, isSensitive: true },
    { section: 'house_info', sortOrder: 4, content: { label: 'Trash Day',       value: 'Friday morning, bins by the curb' } },
    // Children
    { section: 'child_info', sortOrder: 0, content: { name: 'Emma',   age: '11', allergies: 'None',                                medications: 'None', bedtime: '8:30 PM', notes: 'Reads before lights out. Nightlight stays on.' } },
    { section: 'child_info', sortOrder: 1, content: { name: 'Sophie', age: '8',  allergies: 'Peanuts (EpiPen in kitchen drawer)', medications: 'None', bedtime: '7:30 PM', notes: 'Needs her stuffed otter to sleep. Story after teeth brushing.' } },
    // House rules
    { section: 'house_rule', sortOrder: 0, content: { rule: 'Screens off one hour before bedtime.',                    importance: 'high' } },
    { section: 'house_rule', sortOrder: 1, content: { rule: 'Snacks are okay from the pantry, no candy after dinner.', importance: 'medium' } },
    { section: 'house_rule', sortOrder: 2, content: { rule: 'Keep the back door locked and the pool gate closed.',     importance: 'high' } },
  ]);

  console.log(`  Created 14 babysitter info entries`);

  // ─── WISH LISTS (per-member items) ────────────────────────────────────────
  console.log('Creating wish lists...');

  await db.insert(schema.wishItems).values([
    // Emma's wishes
    { memberId: emma.id,   name: 'Art set with watercolors',         notes: 'The 48-color kind',           addedBy: emma.id },
    { memberId: emma.id,   name: 'Mystery book series',              url: 'https://example.com/books',     addedBy: emma.id },
    { memberId: emma.id,   name: 'Roller skates (size 4)',           addedBy: emma.id, sortOrder: 2, claimed: true, claimedBy: alex.id, claimedAt: daysAgo(5) },
    { memberId: emma.id,   name: 'Karaoke microphone',               addedBy: emma.id },
    // Sophie's wishes
    { memberId: sophie.id, name: 'LEGO Friends set',                 url: 'https://example.com/lego',      addedBy: sophie.id },
    { memberId: sophie.id, name: 'Stuffed animal (otter)',           notes: 'The one from the aquarium',   addedBy: sophie.id },
    { memberId: sophie.id, name: 'Glitter pens',                     addedBy: jordan.id, sortOrder: 2, claimed: true, claimedBy: jordan.id, claimedAt: daysAgo(3) },
    { memberId: sophie.id, name: 'Pogo stick',                       addedBy: sophie.id },
    // Jordan's wishes
    { memberId: jordan.id, name: 'Wireless headphones',              url: 'https://example.com/headphones', addedBy: jordan.id },
    { memberId: jordan.id, name: 'Cookbook — sheet pan dinners',     addedBy: jordan.id },
    { memberId: jordan.id, name: 'New running shoes',                notes: 'Size 8 in the trail version', addedBy: jordan.id },
    // Alex's wishes
    { memberId: alex.id,   name: 'Smart thermostat',                 addedBy: alex.id },
    { memberId: alex.id,   name: 'Woodworking starter kit',          addedBy: alex.id },
  ]);

  console.log(`  Created 13 wish items`);

  // ─── GIFT IDEAS (private per-person) ──────────────────────────────────────
  console.log('Creating gift ideas...');

  await db.insert(schema.giftIdeas).values([
    // Alex's gift ideas for the rest of the family
    { createdBy: alex.id,   forUserId: jordan.id, name: 'Cooking class for two',  notes: 'Anniversary idea',          price: '180' },
    { createdBy: alex.id,   forUserId: emma.id,   name: 'Bike helmet upgrade',    notes: 'Hers is getting small',     price: '45' },
    { createdBy: alex.id,   forUserId: sophie.id, name: 'Princess castle book',   price: '20' },
    // Jordan's gift ideas
    { createdBy: jordan.id, forUserId: alex.id,   name: 'Woodworking tool set',   url: 'https://example.com/tools',   price: '120' },
    { createdBy: jordan.id, forUserId: emma.id,   name: 'Watercolor master class', notes: 'Online course',            price: '60' },
    { createdBy: jordan.id, forUserId: sophie.id, name: 'New scooter',            price: '85', purchased: true, purchasedAt: daysAgo(2) },
  ]);

  console.log(`  Created 6 gift ideas`);

  // ─── TRAVEL — pins + trips ────────────────────────────────────────────────
  console.log('Creating travel pins and trips...');

  // Standalone pins
  await db.insert(schema.travelPins).values([
    { name: 'Sanibel Island',     latitude: '26.4498', longitude: '-82.1147', placeName: 'Sanibel Island, FL',     status: 'been_there',  visitedDate: '2024-03-15', year: 2024, tags: ['Beach', 'Family Trip'], createdBy: alex.id },
    { name: 'Glacier National Park', latitude: '48.7596', longitude: '-113.7870', placeName: 'Glacier NP, MT',     status: 'want_to_go',  isBucketList: true, tags: ['National Park', 'Hike'], createdBy: jordan.id },
    { name: 'Iceland Ring Road',  latitude: '64.9631',  longitude: '-19.0208',  placeName: 'Iceland',              status: 'want_to_go',  isBucketList: true, tags: ['Adventure', 'Road Trip'], createdBy: alex.id },
    { name: 'Kyoto',              latitude: '35.0116',  longitude: '135.7681',  placeName: 'Kyoto, Japan',          status: 'want_to_go',  isBucketList: true, tags: ['Culture', 'Food'], createdBy: jordan.id },
    { name: 'Yellowstone',        latitude: '44.4280',  longitude: '-110.5885', placeName: 'Yellowstone NP, WY',   status: 'been_there',  visitedDate: '2023-07-10', year: 2023, tags: ['National Park'], nationalParks: ['Yellowstone National Park'], createdBy: alex.id },
    { name: 'Grand Canyon',       latitude: '36.1069',  longitude: '-112.1129', placeName: 'Grand Canyon NP, AZ',  status: 'been_there',  visitedDate: '2022-10-20', year: 2022, tags: ['National Park'], nationalParks: ['Grand Canyon National Park'], createdBy: jordan.id },
  ]);

  // A trip with stops
  const tripResult = await db
    .insert(schema.travelTrips)
    .values([
      { name: 'Summer Pacific NW Road Trip', tripStyle: 'route', status: 'want_to_go', year: NOW.getFullYear(), color: '#10B981', emoji: '🌲', tags: ['Road Trip', 'National Park'], createdBy: alex.id, memberIds: [alex.id, jordan.id, emma.id, sophie.id] },
    ])
    .returning();

  const tripPNW = tripResult[0]!;

  await db.insert(schema.travelPins).values([
    { name: 'Seattle',                latitude: '47.6062', longitude: '-122.3321', placeName: 'Seattle, WA',                tripId: tripPNW.id, pinType: 'stop', sortOrder: 0, status: 'want_to_go', createdBy: alex.id },
    { name: 'Olympic NP',             latitude: '47.8021', longitude: '-123.6044', placeName: 'Olympic National Park, WA',  tripId: tripPNW.id, pinType: 'national_park', sortOrder: 1, status: 'want_to_go', nationalParks: ['Olympic National Park'], createdBy: alex.id },
    { name: 'Mount Rainier NP',       latitude: '46.8523', longitude: '-121.7603', placeName: 'Mount Rainier NP, WA',       tripId: tripPNW.id, pinType: 'national_park', sortOrder: 2, status: 'want_to_go', nationalParks: ['Mount Rainier National Park'], createdBy: alex.id },
    { name: 'Portland',               latitude: '45.5152', longitude: '-122.6784', placeName: 'Portland, OR',               tripId: tripPNW.id, pinType: 'stop', sortOrder: 3, status: 'want_to_go', createdBy: alex.id },
    { name: 'Crater Lake NP',         latitude: '42.8684', longitude: '-122.1685', placeName: 'Crater Lake NP, OR',         tripId: tripPNW.id, pinType: 'national_park', sortOrder: 4, status: 'want_to_go', nationalParks: ['Crater Lake National Park'], createdBy: alex.id },
  ]);

  console.log(`  Created 6 standalone pins + 1 trip with 5 stops`);

  // ─── WEEKEND PLACES ───────────────────────────────────────────────────────
  console.log('Creating weekend places...');

  await db.insert(schema.weekendPlaces).values([
    { name: 'Forest Park trails',       description: 'Big shaded trails — kids can ride scooters',   tags: ['outdoor', 'hike', 'nature'],   status: 'visited',  isFavorite: true,  rating: 5, visitCount: 8, lastVisitedDate: ymd(daysAgo(10)), createdBy: alex.id },
    { name: 'Children\'s Museum',       description: 'Indoor backup for rainy days',                 tags: ['museum', 'kids'],              status: 'visited',  isFavorite: false, rating: 4, visitCount: 3, lastVisitedDate: ymd(daysAgo(30)), createdBy: jordan.id },
    { name: 'Lavender Farm',            description: 'Late-June bloom, picnic spot',                 tags: ['farm', 'outdoor', 'food'],    status: 'visited',  isFavorite: true,  rating: 5, visitCount: 2, lastVisitedDate: ymd(daysAgo(220)), createdBy: jordan.id },
    { name: 'Wildlife Sanctuary',       description: 'Free entry, walking trails, rescued animals',  tags: ['outdoor', 'nature', 'free'],   status: 'backlog',  isFavorite: false, createdBy: emma.id },
    { name: 'Drive-in movie theater',   description: 'Open weekends only May-Oct',                   tags: ['movie', 'family'],            status: 'backlog',  isFavorite: true,  createdBy: alex.id },
    { name: 'Indoor trampoline park',   description: 'Sophie has been asking',                       tags: ['indoor', 'kids'],              status: 'backlog',  isFavorite: false, createdBy: sophie.id },
    { name: 'Pumpkin Patch (Hillview)', description: 'Hayrides + cider donuts in October',          tags: ['outdoor', 'seasonal', 'farm'],  status: 'visited',  isFavorite: true,  rating: 5, visitCount: 4, lastVisitedDate: ymd(daysAgo(180)), createdBy: jordan.id },
    { name: 'Local diner',              description: 'Best Sunday breakfast in town',                tags: ['food'],                        status: 'visited',  isFavorite: true,  rating: 5, visitCount: 12, lastVisitedDate: ymd(daysAgo(7)), createdBy: alex.id },
  ]);

  console.log(`  Created 8 weekend places`);

  // ─── BUS ROUTES (Emma's AM/PM) ────────────────────────────────────────────
  console.log('Creating bus routes...');

  await db.insert(schema.busRoutes).values([
    {
      studentName: 'Emma',
      userId: emma.id,
      tripId: '28-C',
      direction: 'AM',
      label: 'Emma Morning Pickup',
      scheduledTime: '07:42',
      activeDays: [1, 2, 3, 4, 5],
      checkpoints: [
        { name: 'Bus barn', sortOrder: 0 },
        { name: 'Maple & 3rd', sortOrder: 1 },
        { name: 'Pine Grove', sortOrder: 2 },
      ],
      stopName: 'Our stop',
      schoolName: 'Maple Elementary',
      enabled: true,
      sortOrder: 0,
    },
    {
      studentName: 'Emma',
      userId: emma.id,
      tripId: '28-C',
      direction: 'PM',
      label: 'Emma Afternoon Dropoff',
      scheduledTime: '15:18',
      activeDays: [1, 2, 3, 4, 5],
      checkpoints: [
        { name: 'School', sortOrder: 0 },
        { name: 'Pine Grove', sortOrder: 1 },
        { name: 'Maple & 3rd', sortOrder: 2 },
      ],
      stopName: 'Our stop',
      schoolName: 'Maple Elementary',
      enabled: true,
      sortOrder: 1,
    },
  ]);

  console.log(`  Created 2 bus routes`);

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  console.log('Creating default settings...');

  await db.insert(schema.settings).values([
    { key: 'theme',    value: { mode: 'system' } },
    { key: 'location', value: { city: 'Springfield', state: 'IL', country: 'US' } },
    { key: 'security', value: { requirePinForEvents: true, requirePinForDelete: true, requirePinForSettings: true, sessionTimeout: 30 } },
    // Mark setup as complete so the dashboard doesn't redirect to /setup.
    // The wizard normally writes this row after creating the first parent;
    // since the seed creates parents directly, we shortcut here.
    { key: 'setupComplete', value: { completedAt: NOW.toISOString() } },
  ]);

  console.log(`  Created 4 settings (including setupComplete)`);

  // ─── LAYOUTS ──────────────────────────────────────────────────────────────
  console.log('Creating default layout...');

  await db.insert(schema.layouts).values([
    {
      name: 'Default Dashboard',
      isDefault: true,
      widgets: [
        // One-screen, two-column layout: weather fills the full-height left
        // half, four widgets stack down the right half. Fits without scrolling
        // on common laptop/desktop viewports. Calendar, Birthdays, Points,
        // Messages, and Meals are intentionally omitted from the default —
        // users add them via Settings. Keep in sync with DEFAULT_TEMPLATE in
        // src/lib/constants/layoutTemplates.ts.
        { i: 'weather',  x: 0,  y: 0,  w: 24, h: 24 },
        { i: 'clock',    x: 24, y: 0,  w: 24, h: 6  },
        { i: 'tasks',    x: 24, y: 6,  w: 24, h: 6  },
        { i: 'chores',   x: 24, y: 12, w: 24, h: 6  },
        { i: 'shopping', x: 24, y: 18, w: 24, h: 6  },
      ],
      createdBy: alex.id,
    },
  ]);

  console.log(`  Created 1 layout`);

  // ─── DONE ─────────────────────────────────────────────────────────────────
  console.log('\nDatabase seeded successfully!');
  console.log('\nDefault PIN for all users: 1234');

  await client.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
