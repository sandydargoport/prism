'use client';

import { useState, useMemo } from 'react';
import { HelpCircle, Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageWrapper } from '@/components/layout';
import { SubpageHeader } from '@/components/layout';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface HelpSection {
  id: string;
  title: string;
  desktopOnly?: boolean;
  content: React.ReactNode;
}

function useSections(isMobile: boolean): HelpSection[] {
  return useMemo(() => {
    const all: HelpSection[] = [
      { id: 'getting-started', title: 'Getting Started', content: <GettingStarted /> },
      { id: 'roles', title: 'Roles & Permissions', content: <Roles /> },
      { id: 'dashboard', title: 'Dashboard', desktopOnly: true, content: <DashboardHelp /> },
      { id: 'mobile-dashboard', title: 'Mobile Dashboard', content: <MobileDashboardHelp /> },
      { id: 'calendar', title: 'Calendar', content: <CalendarHelp isMobile={isMobile} /> },
      { id: 'tasks', title: 'Tasks', content: <TasksHelp /> },
      { id: 'chores', title: 'Chores', content: <ChoresHelp /> },
      { id: 'goals', title: 'Goals & Points', content: <GoalsHelp /> },
      { id: 'shopping', title: 'Shopping', content: <ShoppingHelp /> },
      { id: 'meals', title: 'Meals', content: <MealsHelp /> },
      { id: 'recipes', title: 'Recipes', content: <RecipesHelp /> },
      { id: 'messages', title: 'Messages', content: <MessagesHelp /> },
      { id: 'wishes', title: 'Wishes & Gift Ideas', content: <WishesHelp /> },
      { id: 'birthdays', title: 'Birthdays & Milestones', content: <BirthdaysHelp /> },
      { id: 'weekend', title: 'Weekend Ideas', content: <WeekendHelp /> },
      { id: 'travel', title: 'Travel Map', content: <TravelHelp /> },
      { id: 'photos', title: 'Photos', desktopOnly: true, content: <PhotosHelp /> },
      { id: 'bus', title: 'Bus Tracking', content: <BusHelp /> },
      { id: 'away-mode', title: 'Away Mode', desktopOnly: true, content: <AwayModeHelp /> },
      { id: 'babysitter', title: 'Babysitter Mode', desktopOnly: true, content: <BabysitterHelp /> },
      { id: 'screensaver', title: 'Screensaver', desktopOnly: true, content: <ScreensaverHelp /> },
      { id: 'input', title: 'Keyboard, Voice & Scanning', content: <InputHelp /> },
      { id: 'settings', title: 'Settings', content: <SettingsHelp isMobile={isMobile} /> },
      { id: 'integrations', title: 'Integrations', content: <IntegrationsHelp /> },
      { id: 'caldav', title: 'Apple iCloud (CalDAV)', content: <CalDAVHelp /> },
      { id: 'kroger', title: 'Kroger / Mariano’s Cart', content: <KrogerHelp /> },
      { id: 'voice', title: 'Home Assistant & Voice API', content: <VoiceApiHelp /> },
      { id: 'pwa', title: 'Install as App', content: <PwaHelp /> },
      { id: 'shortcuts', title: 'Keyboard Shortcuts', desktopOnly: true, content: <ShortcutsHelp /> },
      { id: 'troubleshooting', title: 'Troubleshooting', content: <TroubleshootingHelp /> },
    ];
    return isMobile ? all.filter(s => !s.desktopOnly) : all;
  }, [isMobile]);
}

export function HelpView() {
  const isMobile = useIsMobile();
  const sections = useSections(isMobile);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(s =>
      s.title.toLowerCase().includes(q)
    );
  }, [sections, search]);

  // Two-level nav: section list → section detail
  if (activeSection) {
    const section = sections.find(s => s.id === activeSection);
    if (!section) return null;
    return (
      <PageWrapper>
        <SubpageHeader
          icon={<HelpCircle className="h-5 w-5 text-primary" />}
          title={section.title}
          actions={
            <button
              onClick={() => setActiveSection(null)}
              className="text-sm text-primary hover:underline"
            >
              Back to Help
            </button>
          }
        />
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
            {section.content}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SubpageHeader
        icon={<HelpCircle className="h-5 w-5 text-primary" />}
        title="Help"
      />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help topics..."
              className="pl-9"
            />
          </div>

          {/* Section list */}
          <div className="space-y-1">
            {filtered.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card/85 hover:bg-accent transition-colors text-left"
              >
                <span className="font-medium text-sm">{section.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No matching topics</p>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

/* ================================================================
   SECTION CONTENT COMPONENTS
   ================================================================ */

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-bold mt-6 mb-2">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-semibold mt-4 mb-1">{children}</h3>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{children}</p>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>
);
const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>
);

function GettingStarted() {
  return (
    <>
      <P>Prism is a free, self-hosted family dashboard that brings together calendars, tasks, chores, shopping lists, meals, photos, and more into one shared hub.</P>
      <H2>First-Time Setup</H2>
      <Ul>
        <Li><strong>Add family members</strong> in Settings &gt; Family Members</Li>
        <Li><strong>Set a PIN</strong> (4 or 6 digits) for each member, chosen during the setup wizard on a fresh install, or later in Settings &gt; Security. Each member&apos;s PIN length is independent; there is no shared family PIN.</Li>
        <Li><strong>Connect integrations</strong> (Google, Microsoft, Apple/CalDAV, weather) in Settings &gt; Integrations</Li>
        <Li><strong>Customize your dashboard</strong> layout using the Edit button</Li>
        <Li><strong>Install as an app</strong> on phones and tablets for quick access</Li>
      </Ul>
      <H2>Logging In</H2>
      <P>Tap a family member&apos;s avatar, then enter their PIN (4 or 6 digits, depending on how it was set). It auto-submits once the PIN is complete. Keyboard input (0-9, Backspace) also works.</P>
    </>
  );
}

function Roles() {
  return (
    <>
      <P>Prism has two roles: <strong>Parent</strong> and <strong>Child</strong>.</P>
      <H3>Parents can:</H3>
      <Ul>
        <Li>Manage settings, family members, and integrations</Li>
        <Li>Approve chore completions and reset achieved goals</Li>
        <Li>Edit dashboard layouts</Li>
        <Li>Exit Away Mode and Babysitter Mode</Li>
        <Li>Delete any message</Li>
      </Ul>
      <H3>Children can:</H3>
      <Ul>
        <Li>View the dashboard and all pages</Li>
        <Li>Mark chores complete (pending parent approval)</Li>
        <Li>Add tasks, messages, and wish list items</Li>
        <Li>Post and edit their own messages</Li>
      </Ul>
    </>
  );
}

function DashboardHelp() {
  return (
    <>
      <P>The dashboard displays live data through customizable widgets on a 48-column grid layout.</P>

      <H2>Available Widgets</H2>
      <P>Clock, Weather, Calendar, Tasks, Chores, Shopping, Meals, Messages, Photos, Points/Goals, Birthdays, Wishes, and Bus Tracker.</P>

      <H2>Editing the Layout</H2>
      <Ul>
        <Li>Tap the <strong>grid icon</strong> (four squares) in the dashboard header to enter edit mode (parent only)</Li>
        <Li><strong>Drag</strong> widgets to reposition, <strong>resize</strong> by dragging corner handles</Li>
        <Li>Use the <strong>Widgets</strong> button to show/hide widgets and adjust their coordinates</Li>
        <Li>Click a widget to select it, then use the <strong>properties toolbar</strong> to adjust background color, opacity, outline, text color, and text size</Li>
        <Li>Load a pre-designed arrangement from the <strong>Templates</strong> button (see below)</Li>
        <Li><strong>Save</strong> to overwrite the current layout, or use the dropdown arrow for <strong>Save As</strong> to create a named copy</Li>
      </Ul>

      <H2>Starter Templates</H2>
      <P>The <strong>Templates</strong> button offers six built-in dashboards: <strong>Family Central</strong>, <strong>Calendar Focus</strong>, <strong>Command Center</strong>, <strong>Meal Planner</strong>, <strong>School Mornings</strong>, and a photo-forward <strong>Ambient</strong>. Each is built around a single hero widget (usually the calendar) with the other widgets sized to their natural shape and grouped into a couple of balanced zones, a starting point you then rearrange. Every template ships in both landscape and portrait versions, and the screensaver has its own matching set.</P>

      <H2>Mini-map &amp; Validation</H2>
      <P>Click <strong>Mini-map</strong> in the left toolbar to see a miniature map of your layout. It highlights widget positions and flags any issues like overlapping or undersized widgets. Click on the mini-map to scroll the grid to that area. A separate <strong>device preview gallery</strong> shows how your one design looks on each common screen size.</P>

      <H2>Preview Mode</H2>
      <P>Click <strong>Preview</strong> in the toolbar (or press Ctrl+Shift+M) to temporarily hide the editor toolbar and see your layout as it will actually appear; click <strong>Exit Preview</strong> to return. Use the &quot;Show Nav / Hide Nav&quot; toggle to check how it looks with and without the navigation sidebar. This is useful for fine-tuning layouts on dedicated displays.</P>
      <P>For a permanent clean look, enable <strong>Auto-Hide Navigation</strong> in Settings &gt; Appearance. The nav and toolbar will automatically hide after a period of inactivity and reappear on click or keyboard input.</P>

      <H2>Screensaver Layout</H2>
      <P>Each dashboard has its own screensaver layout. In edit mode, click the <strong>Screensaver</strong> button to switch to editing the screensaver widget arrangement. The screensaver activates after a configurable idle period (Settings &gt; Appearance &gt; Timers &amp; Auto-Activation) and shows a photo slideshow with your chosen widgets overlaid. Its templates keep the calendar, or tonight&apos;s meals, as the hero, with small clock, weather, and message accents floating over one clean photo region so the wallpaper stays the star.</P>

      <H2>Import, Export &amp; Community Layouts</H2>
      <Ul>
        <Li><strong>Community gallery</strong>: Click <strong>Community</strong> in the editor toolbar to browse layouts shared by other Prism users. Search by name and filter by <strong>orientation</strong> (Landscape/Portrait, pre-set to the dashboard you&apos;re editing), preview each as a thumbnail, then <strong>Apply layout</strong> to drop it onto a new dashboard.</Li>
        <Li><strong>Share</strong>: Submit your own layout (More &gt; Share). Fill in the details and submit; Prism opens a pre-filled submission, and once it&apos;s approved your layout appears in the gallery.</Li>
        <Li><strong>Export</strong>: Copy your current layout as JSON to share it directly (More &gt; Export)</Li>
        <Li><strong>Import</strong>: Paste a layout JSON to load someone else&apos;s design (More &gt; Import)</Li>
        <Li><strong>Reset</strong>: Revert unsaved edits back to the last saved layout (More &gt; Reset)</Li>
      </Ul>

      <H2>Multiple Dashboards</H2>
      <P>Create separate dashboards for different rooms or displays. Click the dashboard name dropdown in the editor toolbar to switch between dashboards or create new ones.</P>
      <Ul>
        <Li>Default dashboard lives at <strong>/</strong>: make any dashboard the default via <strong>More &gt; Set as Default</strong></Li>
        <Li>Named dashboards get URLs like <strong>/d/kitchen</strong> or <strong>/d/living-room</strong></Li>
        <Li>Each has independent widget layout, screensaver layout, and orientation (landscape/portrait)</Li>
        <Li>Bookmark a dashboard URL on a dedicated device for instant access</Li>
      </Ul>

      <H2>Orientation</H2>
      <P>Toggle between <strong>Landscape</strong> and <strong>Portrait</strong> mode using the orientation button in the editor toolbar. This flips the design canvas between the landscape and portrait frame so you can lay out each orientation for your display.</P>
    </>
  );
}

function MobileDashboardHelp() {
  return (
    <>
      <P>On phones, the dashboard shows a simplified single-column layout with summary cards for weather, calendar, chores, tasks, shopping, meals, messages, and birthdays.</P>
      <P>Tap any card to navigate to the full page for that feature.</P>
    </>
  );
}

function CalendarHelp({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <P>View and manage events from Google Calendar, Microsoft, and local calendars.</P>

      <H2>Personal &amp; Family calendars (no setup needed)</H2>
      <P>Every family member automatically gets their own personal calendar, plus a shared <strong>Family</strong> calendar, so you can add and assign events right away without connecting anything. Connected accounts (below) simply layer on top.</P>

      <H2>Setting Up Connected Calendars</H2>
      <P>Connect Google, Microsoft, or Apple/CalDAV calendars in <strong>Settings &gt; Integrations</strong> (Google Calendar via OAuth; Apple iCloud via the CalDAV card). Once connected, open the <strong>calendar page and tap Manage</strong> to configure individual calendars, where you can:</P>
      <Ul>
        <Li><strong>Enable/disable</strong> individual calendars from showing on the dashboard</Li>
        <Li><strong>Assign to a family member</strong>: each calendar is linked to a person or marked as &quot;Family&quot; (shared)</Li>
        <Li><strong>Set display names</strong>: customize how a calendar appears in the UI</Li>
        <Li><strong>Change colors</strong>: override the default color for any calendar</Li>
      </Ul>
      <P>Google Calendar is <strong>two-way</strong>: events you add, edit, or delete in Prism are pushed back to the connected Google calendar. (Old <strong>Settings &gt; Connected Accounts</strong> and <strong>Settings &gt; Calendars</strong> links redirect to these locations.)</P>

      <H2>Calendar Groups &amp; Columns</H2>
      <P>In Day and List views, events are organized into <strong>columns by calendar group</strong>. Groups are created automatically based on your calendar assignments:</P>
      <Ul>
        <Li>The <strong>Family</strong> group always appears first (for shared/family calendars)</Li>
        <Li><strong>Person columns</strong> appear after Family, ordered by the family member sort order in Settings &gt; Family Members</Li>
        <Li>Reorder family members in Settings to change the column order</Li>
        <Li>Use the <strong>Merge/Split</strong> toggle to combine all events into a single column or separate by person</Li>
      </Ul>
      <P>Filter buttons at the top of the calendar let you show/hide specific calendar groups. Click <strong>All</strong> to show everything.</P>

      <H2>Color Coding</H2>
      <P>Events inherit their color from the calendar source they belong to. When calendars are assigned to family members, each person&apos;s events appear in their column with the calendar&apos;s color. You can customize colors per calendar from the <strong>Manage</strong> overlay on the calendar page. Meals placed on the calendar are marked with a small utensils icon so they stand out from ordinary events.</P>

      {!isMobile && (
        <>
          <H2>Views</H2>
          <P>Agenda, Day, Week, List, Multi-Week (1-4W), Month, and 3-Month. Switch views using the toolbar buttons. The grid lines toggle (grid icon) shows or hides cell borders across all grid-based views.</P>

          <H2>Calendar Notes</H2>
          <P>Click the sticky note icon to show a notes panel alongside Day or List views. Notes are day-tied, shared across the family, and support formatting shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Shift+S strikethrough, Ctrl+Shift+L bullet list. Type &quot;- &quot; at the start of a line to auto-convert to a bullet.</P>

          <H2>Hidden Hours</H2>
          <P>Hide a time range from day and week views (e.g., midnight to 6 AM). The remaining hours auto-resize to fill the available space. Configure the range from the <strong>Manage</strong> overlay on the calendar page (Calendar Hours), and toggle visibility with the clock button in calendar views.</P>
        </>
      )}

      <H2>Navigation</H2>
      <P>Use Previous/Next arrows or swipe left/right on touch devices. Tap &quot;Today&quot; to jump back to the current date.</P>
    </>
  );
}

function TasksHelp() {
  return (
    <>
      <P>Create and manage to-do items with optional assignment, due dates, priorities, and categories.</P>
      <Ul>
        <Li><strong>Add</strong> via the &quot;Add Task&quot; button or inline text input</Li>
        <Li><strong>Complete</strong> by tapping the checkbox</Li>
        <Li><strong>Delete</strong> with the trash icon on a task, or from its edit window (parents only)</Li>
        <Li><strong>Filter</strong> by person, priority, or list</Li>
        <Li><strong>Group by Person</strong> to see tasks organized by family member</Li>
        <Li><strong>Sync</strong> with Microsoft To Do or Google Tasks (configure per-list in Settings &gt; Integrations)</Li>
      </Ul>
      <H2>Removed tasks are held for review</H2>
      <P>
        If a task disappears from the app you sync with, Prism keeps it and shows a
        <strong> Review</strong> button on the Tasks page. A parent chooses to delete it
        or keep it as a local task. If a lot vanish at once — the shape of a connection
        problem rather than someone tidying up — nothing is flagged and the sync says why,
        so a bad connection cannot quietly empty your list.
      </P>
      <P>
        Deleting a task in Prism also removes it from the app it syncs with. Your view
        settings — grouping, sorting and show-completed — are remembered between visits.
      </P>
    </>
  );
}

function ChoresHelp() {
  return (
    <>
      <P>Family chores with an approval workflow and point system.</P>
      <H2>How It Works</H2>
      <Ul>
        <Li>A parent creates a chore with a frequency and point value</Li>
        <Li>A child marks it complete. It enters &quot;Pending Approval&quot;</Li>
        <Li>A parent approves. Points are awarded and the next due date advances</Li>
        <Li>If a parent completes it, it&apos;s auto-approved</Li>
      </Ul>
      <H2>Reset Day</H2>
      <P>Each chore can have a custom reset day. For weekly chores, choose which day of the week (Sun-Sat). Set this in the Add/Edit Chore modal.</P>
    </>
  );
}

function GoalsHelp() {
  return (
    <>
      <P>Set goals that children work toward by earning points from chore completions.</P>
      <H2>How Points Work</H2>
      <P>Points are earned from approved chores. The waterfall system allocates points in priority order: highest priority goals fill first, overflow goes to the next goal.</P>
      <H2>Recurring vs One-Time</H2>
      <Ul>
        <Li><strong>Recurring</strong> goals reset each period (weekly, monthly, yearly)</Li>
        <Li><strong>One-time</strong> goals accumulate until achieved, then a parent taps <strong>Reset</strong> on the goal to start it over</Li>
      </Ul>
      <H2>Celebrations</H2>
      <P>When a goal is fully achieved, a seasonal celebration animation plays, themed to the nearest holiday (St. Patrick&apos;s, Easter, July 4th, Halloween, Thanksgiving, Christmas, etc.).</P>
    </>
  );
}

function ShoppingHelp() {
  return (
    <>
      <P>Manage multiple shopping lists with categories and per-person tracking.</P>
      <Ul>
        <Li><strong>Multiple lists</strong>: Groceries, Hardware, General, etc.</Li>
        <Li><strong>Categories</strong>: Produce, Dairy, Bakery, Meat, etc.</Li>
        <Li><strong>Group by person</strong>: See who requested each item</Li>
        <Li><strong>Reorder categories</strong>: Drag category headers to match your store layout (desktop)</Li>
        <Li><strong>Edit / Delete</strong>: Each row has always-visible pencil and trash buttons. Deletes are immediate (the Undo button only reverses a check-off)</Li>
        <Li><strong>Scan barcodes</strong>: Add items with a USB scanner or the camera scanner on the Shopping page</Li>
        <Li><strong>Send to Kroger</strong>: Push unchecked items to your Kroger / Mariano&apos;s online cart (see the Kroger help section)</Li>
        <Li><strong>Shopping mode</strong>: Tap the expand icon for a full-screen, in-store view</Li>
        <Li><strong>Sync</strong> with Microsoft To Do (configure per-list in Settings &gt; Integrations)</Li>
      </Ul>
    </>
  );
}

function MealsHelp() {
  return (
    <>
      <P>Weekly meal planner with optional recipe integration.</P>
      <Ul>
        <Li><strong>Plan meals</strong> per day: a name is all you need; optionally link a recipe from your library</Li>
        <Li><strong>Multiple meal types</strong>: Breakfast, Lunch, Dinner, Snack, with an optional time of day</Li>
        <Li><strong>Drag meals between days</strong> to reschedule (touch supported)</Li>
        <Li><strong>Mark as cooked</strong> to track what&apos;s been prepared</Li>
        <Li>Days follow your <strong>Week Starts On</strong> setting (Settings &gt; General)</Li>
        <Li><strong>Sync a meal plan</strong> from Tandoor or Mealie via the <strong>Add ▾</strong> menu</Li>
      </Ul>
    </>
  );
}

function MessagesHelp() {
  return (
    <>
      <P>Family message board for shared updates.</P>
      <Ul>
        <Li><strong>Post</strong> messages attributed to whoever is logged in</Li>
        <Li><strong>Pin</strong> important messages to the top</Li>
        <Li><strong>Set expiration</strong> for temporary notices (12h to 7 days)</Li>
        <Li><strong>Edit</strong>: Click the pencil icon, Ctrl+Enter to save</Li>
        <Li><strong>Delete</strong>: Authors can delete their own; parents can delete any</Li>
      </Ul>
    </>
  );
}

function BirthdaysHelp() {
  return (
    <>
      <H2>Where birthdays come from</H2>
      <P>You don&apos;t enter birthdays into Prism. It reads them from the calendars and contacts you already keep, so they stay correct in one place.</P>
      <Ul>
        <Li><strong>Your calendars</strong> — any all-day event with &quot;birthday&quot; or &quot;anniversary&quot; in the title, on any connected calendar (Google, iCloud/CalDAV, iCal subscription, or a local Prism calendar)</Li>
        <Li><strong>Your contacts</strong> — the birthday field on iCloud/CardDAV contacts. Tick &quot;contact birthdays&quot; when connecting iCloud; this is how iPhone birthdays arrive</Li>
        <Li><strong>Google Contacts</strong> — Google&apos;s own generated birthday calendar</Li>
      </Ul>
      <H2>Adding one Prism can&apos;t find</H2>
      <P>Put it on a calendar and Prism picks it up on the next sync. Your own local Prism calendar works fine for this.</P>
      <Ul>
        <Li>Make it an <strong>all-day</strong> event. A timed event is treated as something happening near a birthday, not the birthday itself</Li>
        <Li>Put the person&apos;s name and the word <strong>birthday</strong> in the title: <em>Grandma&apos;s Birthday</em></Li>
        <Li>Add the year in brackets to show their age: <em>Grandma&apos;s Birthday (1948)</em>. Without a year you still get the date, just no age</Li>
      </Ul>
      <H2>Anniversaries and milestones</H2>
      <P>Anniversaries work the same way — include the word <strong>anniversary</strong> in the title.</P>
      <P>Milestones have no obvious keyword, so Prism looks for the shape instead: an all-day event that <strong>repeats every year</strong> and carries a <strong>year</strong> in the title, like <em>Ana and Ben (2005)</em>.</P>
      <P>If you keep a calendar where <em>everything</em> is a life event, open <strong>Manage calendars</strong> and turn on <strong>&quot;Treat every all-day event here as a birthday or milestone&quot;</strong>. Then titles need no keyword at all.</P>
      <H2>Removing one</H2>
      <P>Deleting a birthday in Prism keeps it deleted — it won&apos;t reappear on the next sync, even though the calendar event still exists. Delete the calendar event too if you want it gone everywhere.</P>
      <H2>What Prism ignores</H2>
      <P>Read-only calendars you subscribe to (school terms, public holidays) are skipped, so things like &quot;No School — Martin Luther King&apos;s Birthday&quot; don&apos;t become family birthdays. Titles such as &quot;birthday party&quot; or &quot;prep for Sam&apos;s birthday&quot; are ignored too, since they describe something happening near a birthday rather than the day itself.</P>
    </>
  );
}

function WishesHelp() {
  return (
    <>
      <H2>Wish Lists</H2>
      <P>Each family member has their own wish list. Others can secretly mark items as purchased. The owner doesn&apos;t see who bought what.</P>
      <Ul>
        <Li><strong>Add</strong> items with name, link, and notes</Li>
        <Li><strong>Claim</strong>: Mark as purchased (secret from the owner)</Li>
        <Li><strong>Cross off</strong>: Owner can cross off items they got themselves</Li>
        <Li><strong>Sync</strong> with Microsoft To Do per member (Settings)</Li>
      </Ul>
      <H2>Gift Ideas</H2>
      <P>Private per-user gift idea tracking. Switch to the &quot;Gift Ideas&quot; tab on the Wishes page.</P>
      <Ul>
        <Li>See columns for each family member (except yourself)</Li>
        <Li>Add ideas with name, link, price, and notes</Li>
        <Li>Mark as purchased when you buy them</Li>
        <Li><strong>Privacy</strong>: Only you can see your ideas. They are never visible to the recipient or other family members</Li>
      </Ul>
    </>
  );
}

function PhotosHelp() {
  return (
    <>
      <P>Photo gallery with local uploads plus OneDrive and Immich sync.</P>
      <Ul>
        <Li><strong>Gallery</strong>: Browse all photos with lightbox view; filter to <strong>Favorites</strong></Li>
        <Li><strong>Slideshow</strong>: Auto-rotating display for screensaver and away mode</Li>
        <Li><strong>Sources</strong>: Local uploads, OneDrive, or Immich. Synced sources refresh automatically about every 30 minutes</Li>
        <Li><strong>Tag for:</strong> In the lightbox, toggle where each photo may appear: <strong>Wallpaper</strong>, <strong>Gallery</strong>, and/or <strong>Screensaver</strong></Li>
        <Li><strong>Bulk select</strong> (desktop): Select many photos to show in / remove from Prism at once</Li>
        <Li><strong>Below-HD indicator</strong>: A resolution dot flags low-resolution photos so you can filter them out of wallpapers</Li>
      </Ul>
      <P>Manage sources and set a static wallpaper or screensaver in Settings &gt; Photos.</P>
    </>
  );
}

function AwayModeHelp() {
  return (
    <>
      <P>Privacy overlay for when the dashboard is unattended. Shows a photo slideshow with clock and weather.</P>
      <Ul>
        <Li><strong>Activate</strong>: Tap the palm tree icon in the dashboard header</Li>
        <Li><strong>Auto-activate</strong>: Configure the timer in Settings &gt; Appearance &gt; Timers &amp; Auto-Activation</Li>
        <Li><strong>Exit</strong>: Tap anywhere, then enter a parent PIN</Li>
      </Ul>
    </>
  );
}

function BabysitterHelp() {
  return (
    <>
      <P>Caregiver information overlay showing emergency contacts, house info, child details, and house rules.</P>
      <Ul>
        <Li><strong>Activate</strong>: Tap the babysitter icon in the dashboard header</Li>
        <Li><strong>Exit</strong>: Tap anywhere, then enter a parent PIN</Li>
        <Li><strong>Configure</strong>: Settings &gt; Babysitter Info</Li>
        <Li>Also available at <strong>/babysitter</strong> without login</Li>
      </Ul>
    </>
  );
}

function ScreensaverHelp() {
  return (
    <>
      <P>Auto-activates when the device is idle. Shows a photo slideshow with optional widgets.</P>
      <Ul>
        <Li><strong>Configure timeout</strong>: Settings &gt; Appearance &gt; Timers &amp; Auto-Activation (Screensaver &gt; Activate after). Options are 30s, 1m, 2m, 10m, 1h, or Never (default 2m)</Li>
        <Li><strong>Photo rotation</strong>: Set the &quot;Rotate photos every&quot; interval, or pin one static photo</Li>
        <Li><strong>Edit layout</strong>: In dashboard edit mode, toggle &quot;Screensaver&quot;</Li>
      </Ul>
      <H2>Palettes</H2>
      <P>
        <strong>Settings &gt; Appearance &gt; Palette</strong> changes the colours. The
        palette applies to every screen in the house; light and dark stay per-screen,
        since that depends on the room a screen is in.
      </P>
      <P>
        If a palette ever makes Prism hard to read, add <code>?theme=default</code> to the
        address to reset it. That works on a display with no keyboard.
      </P>
      <H2>Signing out when nobody is there</H2>
      <P>
        Under the same Timers section, <strong>Sign out after</strong> controls how long
        the display can sit untouched before it stops being signed in as whoever last
        used it. Thirty minutes by default; you can change it or turn it off.
      </P>
      <P>
        Nothing disappears when it happens. The calendar, tasks and messages stay on
        screen for anyone to read. What comes back is the PIN prompt on anything that
        changes something, so a task added on the display is added by whoever is
        actually standing there.
      </P>
    </>
  );
}

function SettingsHelp({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <P>Configure Prism to fit your family&apos;s needs. Open Settings from the navigation to find these sections:</P>
      <H3>Family Members</H3>
      <P>Add, edit, or remove members. Set names, colors, avatars, and roles.</P>
      <H3>Security</H3>
      <P>Set or change each member&apos;s PIN (4 or 6 digits). Generate API tokens for external integrations. Each token carries a <strong>scope</strong>; pick the smallest that works (&quot;Voice API only (recommended)&quot; for Alexa / Home Assistant, or &quot;Full access (legacy)&quot;).</P>
      <H3>General</H3>
      <Ul>
        <Li><strong>Weather location</strong>: Set by ZIP / postal code</Li>
        <Li><strong>Week Starts On</strong>: Sunday or Monday</Li>
      </Ul>
      <H3>Integrations</H3>
      <P>One place to connect providers (Google, Microsoft, Apple iCloud / CalDAV, Kroger, and more) shown as provider cards. Task, Shopping, and Wish List sync are configured per-list inside the Microsoft or Google card. (Old &quot;Connected Accounts&quot; / &quot;Task Sync&quot; / &quot;Shopping Sync&quot; links redirect here.)</P>
      <H3>Appearance</H3>
      <Ul>
        <Li><strong>Theme &amp; palette</strong>: Light, Dark, or System, plus seasonal themes</Li>
        {!isMobile && <Li><strong>Timers &amp; Auto-Activation</strong>: Screensaver and Away Mode idle timers, photo rotation</Li>}
        {!isMobile && <Li><strong>Auto-Hide Navigation</strong>: Hide nav after inactivity</Li>}
      </Ul>
      {!isMobile && (
        <>
          <H3>Text Size</H3>
          <P>Wallpaper and per-display kiosk options.</P>
        </>
      )}
      <H3>Photos</H3>
      <P>Add photo sources (OneDrive, Immich), pick sync folders, and set a static wallpaper or screensaver photo.</P>
      <H3>Bus Tracking</H3>
      <P>Connect Gmail and discover bus routes for the Bus Tracker widget (see the Bus Tracking help section).</P>
      <H3>Input</H3>
      <P>On-screen touch keyboard, voice-to-text, and USB / camera barcode scanning options.</P>
      <H3>Babysitter Info</H3>
      <P>Emergency contacts, house info, and rules shown in Babysitter Mode.</P>
      <H3>Backups &amp; Data</H3>
      <P>Create, download, and restore database backups.</P>
      <H3>Activity Log</H3>
      <P>Review a log of significant actions taken in Prism.</P>
    </>
  );
}

function IntegrationsHelp() {
  return (
    <>
      <P>Everything connects from one place: <strong>Settings &gt; Integrations</strong>, shown as provider cards.</P>
      <H2>Google Calendar</H2>
      <P>Connect in Settings &gt; Integrations (Google card). <strong>Two-way sync</strong>: events you add, edit, or delete in Prism are pushed back to the connected Google calendar.</P>
      <H2>Microsoft To Do</H2>
      <P>Bidirectional sync for Tasks, Shopping Lists, and Wish Lists, with newest-wins conflict resolution. Connect the Microsoft card, then turn on sync per-list inside that card.</P>
      <H2>Google Tasks</H2>
      <P>An alternative task provider. Connect Google Tasks from the Google card and map it to a task list.</P>
      <H2>Apple iCloud / CalDAV</H2>
      <P>Connect iCloud (or any CalDAV server) for calendars, Reminders, and optional contact birthdays. See the <strong>Apple iCloud (CalDAV)</strong> help section for setup. Read-only for edits, but deleting a single (non-recurring) synced event in Prism now removes it upstream too.</P>
      <H2>Kroger / Mariano&apos;s Cart</H2>
      <P>Push your shopping list to your online Kroger / Mariano&apos;s cart. See the <strong>Kroger / Mariano&apos;s Cart</strong> help section.</P>
      <H2>Gmail Bus Tracking</H2>
      <P>Connect Gmail to read FirstView bus-arrival emails and power the Bus Tracker widget. See the <strong>Bus Tracking</strong> help section.</P>
      <H2>Recipe &amp; Meal Sync (Tandoor / Mealie)</H2>
      <P>Import recipes and pull in meal plans from a Tandoor or Mealie server using a read-only API token. Start from the Add ▾ menu on the Recipes or Meals page.</P>
      <H2>OneDrive / Immich Photos</H2>
      <P>Sync photos from OneDrive folders or an Immich server. Configure in Settings &gt; Photos. Synced sources refresh automatically about every 30 minutes.</P>
      <H2>Weather</H2>
      <P>Works out of the box via <strong>Open-Meteo</strong>. No API key needed. Set your location by ZIP / postal code in Settings &gt; General. OpenWeatherMap is optional (set <code>WEATHER_PROVIDER=openweather</code> plus a key).</P>
      <H2>Home Assistant &amp; Voice API</H2>
      <P>Control Prism by voice via Home Assistant, Alexa skills, or Node-RED. See the <strong>Home Assistant &amp; Voice API</strong> help section.</P>
    </>
  );
}

function PwaHelp() {
  return (
    <>
      <P>Install Prism as an app on your device for quick access without opening a browser.</P>
      <H3>iOS (Safari)</H3>
      <P>Open Prism in Safari &gt; tap <strong>Share</strong> &gt; <strong>Add to Home Screen</strong> &gt; <strong>Add</strong>.</P>
      <H3>Android (Chrome)</H3>
      <P>Open in Chrome &gt; tap <strong>Menu</strong> &gt; <strong>Install app</strong>.</P>
      <H3>Desktop (Chrome/Edge)</H3>
      <P>Click the <strong>install icon</strong> in the address bar.</P>
    </>
  );
}

function ShortcutsHelp() {
  return (
    <>
      <div className="space-y-2">
        {[
          ['0-9', 'PIN pad', 'Enter digit'],
          ['Backspace', 'PIN pad', 'Delete last digit'],
          ['Escape', 'Modals', 'Close'],
          ['Ctrl+Enter', 'Message edit', 'Save'],
          ['Ctrl+B', 'Calendar notes', 'Bold'],
          ['Ctrl+I', 'Calendar notes', 'Italic'],
          ['Ctrl+U', 'Calendar notes', 'Underline'],
          ['Ctrl+Shift+S', 'Calendar notes', 'Strikethrough'],
          ['Ctrl+Shift+L', 'Calendar notes', 'Bullet list'],
          ['Ctrl+Shift+M', 'Layout editor', 'Toggle preview mode'],
        ].map(([key, where, action]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono shrink-0 min-w-[100px] text-center">{key}</kbd>
            <span className="text-muted-foreground shrink-0 w-28">{where}</span>
            <span>{action}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TroubleshootingHelp() {
  return (
    <>
      <H3>Forgot PIN</H3>
      <P>Ask a parent to reset it in Settings &gt; Security &gt; Member PINs.</P>
      <H3>Calendar events not showing</H3>
      <P>Open the calendar page and tap <strong>Manage</strong>. Is the calendar enabled? Tap &quot;Sync&quot; to force a refresh. Verify the Google / Microsoft / Apple connection is active in Settings &gt; Integrations.</P>
      <H3>Tasks/Shopping not syncing</H3>
      <P>Verify Microsoft (or Google) is connected in Settings &gt; Integrations. Check that sync is enabled on the list. Tap &quot;Sync All&quot; to force a refresh.</P>
      <H3>Widget not loading</H3>
      <P>Refresh the page. Toggle the widget off and on in edit mode. Clear browser cache if stuck.</P>
    </>
  );
}

function RecipesHelp() {
  return (
    <>
      <P>A recipe library you can scale, shop from, and drop onto the meal planner.</P>
      <H2>Adding Recipes</H2>
      <Ul>
        <Li><strong>Import from URL</strong>: Paste a recipe web address and Prism pulls in the details</Li>
        <Li><strong>Import from Paprika</strong>: Upload a Paprika export file</Li>
        <Li><strong>Paste text</strong>: Paste raw recipe text and Prism structures it</Li>
        <Li><strong>Add manually</strong>: Fill in the form, including an optional photo</Li>
        <Li><strong>Sync from Tandoor / Mealie</strong>: Connect a server with a read-only API token; the review screen pre-selects adds and updates while removals are opt-in, and re-syncing is safe to repeat</Li>
      </Ul>
      <H2>Using a Recipe</H2>
      <Ul>
        <Li><strong>Scale servings</strong>: Use the servings stepper or the quick multiplier buttons (½×, 1×, 2×…); ingredient amounts rescale automatically</Li>
        <Li><strong>Add to shopping list</strong>: Send the (scaled) ingredients straight to a shopping list</Li>
        <Li><strong>Add to Meal Plan</strong>: Pick a day on the two-week mini-calendar and a meal type (defaults to Dinner) to place it on the planner</Li>
        <Li><strong>Favorite</strong> and search across name, description, cuisine, and category; filter by cuisine or category</Li>
      </Ul>
    </>
  );
}

function WeekendHelp() {
  return (
    <>
      <P>A shared board of places and activities to try together on weekends.</P>
      <Ul>
        <Li><strong>Want to Try / Been There</strong>: Switch between the two status tabs; add places with the Add Place button</Li>
        <Li><strong>Favorites</strong>: Star places and filter to just your favorites</Li>
        <Li><strong>Tags</strong>: Pick from a fixed preset list (Outdoor, Nature, Hike, Food, Museum, Park, Playground…); the board groups places by tag, and you can filter by one or more tags</Li>
        <Li><strong>Mark as Visited</strong>: One tap bumps the visit count (shown as pips) and records the last-visited date, moving the place to Been There</Li>
      </Ul>
    </>
  );
}

function TravelHelp() {
  return (
    <>
      <P>A 3D globe and list of places your family has been or wants to go.</P>
      <Ul>
        <Li><strong>Globe &amp; Places tabs</strong>: Spin the globe to see your pins, or switch to the Places list. A dark-mode toggle restyles the globe</Li>
        <Li><strong>Pins</strong>: Add locations, trip stops, or national parks; each pin is either <strong>Want to Go</strong> or <strong>Been There</strong> and can hold photos</Li>
        <Li><strong>Search</strong>: Type a place name to look it up and drop a pin at the right spot</Li>
        <Li><strong>Trips</strong>: Group multiple stops into a trip</Li>
      </Ul>
      <P>For satellite-quality globe imagery you can add a Mapbox token in Settings; the globe still works without one.</P>
    </>
  );
}

function BusHelp() {
  return (
    <>
      <P>Track school-bus arrival times from FirstView email alerts and show them on the dashboard.</P>
      <Ul>
        <Li><strong>Connect Gmail</strong>: In Settings &gt; Bus Tracking, connect the Gmail account that receives FirstView emails (optionally set a Gmail label to narrow the search)</Li>
        <Li><strong>Discover routes</strong>: Prism scans for FirstView emails and creates the routes it finds, each with its stop</Li>
        <Li><strong>Bus Tracker widget</strong>: Add the Bus Tracker widget to a dashboard to see predicted arrival times</Li>
      </Ul>
    </>
  );
}

function InputHelp() {
  return (
    <>
      <P>Kiosk-friendly input options for touchscreens and shared displays. Configure these in Settings &gt; Input.</P>
      <Ul>
        <Li><strong>On-screen keyboard</strong>: A touch keyboard appears automatically when you tap a text field</Li>
        <Li><strong>Voice-to-text</strong>: Tap the mic key on the keyboard to dictate instead of typing</Li>
        <Li><strong>Barcode scanning</strong>: Add shopping items with a USB barcode scanner, or use the camera scanner on the Shopping page</Li>
      </Ul>
    </>
  );
}

function CalDAVHelp() {
  return (
    <>
      <P>Connect Apple iCloud, or any CalDAV / CardDAV server (e.g. Nextcloud), for private calendars, Reminders, and contact birthdays.</P>
      <H2>Setup</H2>
      <Ul>
        <Li>Create an <strong>app-specific password</strong> at appleid.apple.com (your normal Apple password won&apos;t work)</Li>
        <Li>In <strong>Settings &gt; Integrations</strong>, open the <strong>Apple iCloud / CalDAV</strong> card and choose <strong>Connect server</strong></Li>
        <Li>Server URL is <code>caldav.icloud.com</code> for iCloud; enter your Apple ID and the app-specific password</Li>
      </Ul>
      <H2>What syncs</H2>
      <Ul>
        <Li>Calendars and events; Reminders (as tasks); optional contact <strong>birthdays</strong></Li>
        <Li>Read-only for creates and edits, but <strong>deleting a single (non-recurring) synced event in Prism removes it from the source too</strong>. This is destructive upstream. Recurring series only delete locally.</Li>
      </Ul>
    </>
  );
}

function KrogerHelp() {
  return (
    <>
      <P>Push your shopping list to your online Kroger or Mariano&apos;s cart.</P>
      <Ul>
        <Li><strong>Connect</strong>: In Settings &gt; Integrations, open the <strong>Kroger</strong> card, add your API credentials, connect your account (per-user OAuth), and pick your store</Li>
        <Li><strong>Send to Kroger</strong>: From the Shopping page, tap Send to Kroger to push unchecked items; match each item to a product (SKU) and set a quantity</Li>
        <Li>This is a one-way push to your cart on demand. It is not a two-way list sync</Li>
      </Ul>
    </>
  );
}

function VoiceApiHelp() {
  return (
    <>
      <P>Control and read Prism by voice through Home Assistant, Alexa skills, or Node-RED via the built-in Voice API.</P>
      <Ul>
        <Li><strong>Generate a token</strong> in Settings &gt; Security</Li>
        <Li><strong>Pick a scope</strong>: Choose <strong>Voice API only (recommended)</strong> for Alexa / Home Assistant; it reaches the Voice API plus read-only REST sensors, not writes. Full access (legacy) is broader</Li>
        <Li>Point your automation platform at the Voice API with the token; see the Home Assistant and Voice API docs for endpoints</Li>
      </Ul>
    </>
  );
}
