## Data Architecture

### Database Schema

#### Core Tables

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('parent', 'child', 'guest')),
  color VARCHAR(7) NOT NULL, -- Hex color code
  pin VARCHAR(255), -- Hashed PIN
  email VARCHAR(255),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**calendar_sources**
```sql
CREATE TABLE calendar_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'apple', 'microsoft'
  source_calendar_id VARCHAR(255) NOT NULL, -- External calendar ID
  dashboard_calendar_name VARCHAR(100) NOT NULL, -- Maps to dashboard calendar
  display_name VARCHAR(100),
  color VARCHAR(7),
  enabled BOOLEAN DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  last_synced TIMESTAMP,
  sync_errors JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**events**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_source_id UUID REFERENCES calendar_sources(id) ON DELETE CASCADE,
  external_event_id VARCHAR(255), -- ID from Google/Apple/etc.
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT false,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- iCal RRULE format
  created_by UUID REFERENCES users(id),
  color VARCHAR(7),
  reminder_minutes INTEGER,
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_start_time (start_time),
  INDEX idx_calendar_source (calendar_source_id)
);
```

**tasks**
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMP,
  priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')),
  category VARCHAR(100),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  source VARCHAR(50) DEFAULT 'internal', -- 'internal', 'microsoft-todo', etc.
  source_id VARCHAR(255), -- External task ID
  last_synced TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_due_date (due_date)
);
```

**chores**
```sql
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  schedule VARCHAR(20) CHECK (schedule IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_days INTEGER[], -- [0,2,4] for Sun, Tue, Thu
  points INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**chore_completions**
```sql
CREATE TABLE chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  points INTEGER,
  photo_url TEXT,
  notes TEXT
);
```

**shopping_items**
```sql
CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2),
  unit VARCHAR(50),
  category VARCHAR(100),
  checked BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'internal',
  source_id VARCHAR(255),
  recurring BOOLEAN DEFAULT false,
  recurrence_interval VARCHAR(20), -- 'weekly', 'monthly'
  added_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**shopping_lists**
```sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- 'Grocery', 'Hardware', etc.
  icon VARCHAR(50),
  color VARCHAR(7),
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**meals**
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  day_of_week INTEGER, -- 0-6 (Sun-Sat), NULL if unassigned
  recipe_url TEXT,
  notes TEXT,
  cooked BOOLEAN DEFAULT false,
  cooked_at TIMESTAMP,
  week_of DATE NOT NULL, -- Week this meal is planned for
  source VARCHAR(50) DEFAULT 'internal',
  source_id VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_week_of (week_of)
);
```

**maintenance_reminders**
```sql
CREATE TABLE maintenance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) CHECK (category IN ('car', 'home', 'appliance', 'yard', 'other')),
  description TEXT,
  schedule VARCHAR(20) CHECK (schedule IN ('monthly', 'quarterly', 'annually', 'custom')),
  custom_interval_days INTEGER,
  last_completed TIMESTAMP,
  next_due DATE NOT NULL,
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_next_due (next_due)
);
```

**maintenance_completions**
```sql
CREATE TABLE maintenance_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES maintenance_reminders(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  completed_by UUID REFERENCES users(id),
  cost DECIMAL(10,2),
  vendor VARCHAR(255),
  notes TEXT
);
```

**family_messages**
```sql
CREATE TABLE family_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  author_id UUID REFERENCES users(id),
  pinned BOOLEAN DEFAULT false,
  important BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_created_at (created_at DESC)
);
```

**birthdays**
```sql
CREATE TABLE birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  user_id UUID REFERENCES users(id), -- If family member
  gift_ideas TEXT,
  send_card_days_before INTEGER DEFAULT 7,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_birth_month_day (EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
);
```

**settings**
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**layouts**
```sql
CREATE TABLE layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  display_id VARCHAR(100), -- For multi-display setups
  widgets JSONB NOT NULL, -- Array of widget configurations
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**api_credentials**
```sql
CREATE TABLE api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(100) UNIQUE NOT NULL, -- 'google', 'enphase', 'sonos', etc.
  encrypted_credentials TEXT NOT NULL, -- Encrypted JSON
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### API Integrations

#### Google Calendar

**Authentication:** OAuth 2.0
**Scopes:** `https://www.googleapis.com/auth/calendar`
**API Docs:** https://developers.google.com/calendar

**Key Endpoints:**
```
GET /calendars/{calendarId}/events - List events
POST /calendars/{calendarId}/events - Create event
PUT /calendars/{calendarId}/events/{eventId} - Update event
DELETE /calendars/{calendarId}/events/{eventId} - Delete event
```

**Sync Strategy:**
- Initial sync: Fetch all events from past 6 months to future 12 months
- Incremental sync: Use syncToken for changes since last sync
- Frequency: Every 10 minutes
- Webhooks: Set up push notifications for real-time updates

**Implementation:**
```typescript
class GoogleCalendarIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async syncCalendar(calendarId: string): Promise<Event[]>
  async createEvent(calendarId: string, event: Event): Promise<Event>
  async updateEvent(calendarId: string, eventId: string, event: Event): Promise<Event>
  async deleteEvent(calendarId: string, eventId: string): Promise<void>
  async subscribeToChanges(calendarId: string, webhookUrl: string): Promise<void>
}
```

---

#### Apple iCal (CalDAV)

**Protocol:** CalDAV (WebDAV extension)
**Authentication:** Apple ID + App-Specific Password
**Server:** `https://caldav.icloud.com`

**Key Operations:**
```xml
<!-- PROPFIND: List calendars -->
PROPFIND /12345678/calendars/
<!-- REPORT: Query events -->
REPORT /12345678/calendars/calendar-name/
<!-- PUT: Create/Update event -->
PUT /12345678/calendars/calendar-name/event-uid.ics
<!-- DELETE: Delete event -->
DELETE /12345678/calendars/calendar-name/event-uid.ics
```

**Sync Strategy:**
- Use CalDAV sync-collection REPORT
- Track ctag (calendar collection tag) for change detection
- Parse iCalendar (.ics) format
- Frequency: Every 10 minutes

**Implementation:**
```typescript
class AppleCalendarIntegration {
  async authenticate(appleId: string, appPassword: string): Promise<void>
  async listCalendars(): Promise<Calendar[]>
  async syncCalendar(calendarUrl: string): Promise<Event[]>
  async createEvent(calendarUrl: string, event: Event): Promise<void>
  async updateEvent(calendarUrl: string, eventId: string, event: Event): Promise<void>
  async deleteEvent(calendarUrl: string, eventId: string): Promise<void>
}
```

---

#### Microsoft To Do

**Authentication:** Microsoft Graph API OAuth 2.0
**Scopes:** `Tasks.ReadWrite`
**API Docs:** https://learn.microsoft.com/en-us/graph/api/resources/todo-overview

**Key Endpoints:**
```
GET /me/todo/lists - Get task lists
GET /me/todo/lists/{listId}/tasks - Get tasks
POST /me/todo/lists/{listId}/tasks - Create task
PATCH /me/todo/lists/{listId}/tasks/{taskId} - Update task
DELETE /me/todo/lists/{listId}/tasks/{taskId} - Delete task
```

**Sync Strategy:**
- Delta query for incremental sync
- Frequency: Every 15 minutes
- Map To Do lists to family members

**Implementation:**
```typescript
class MicrosoftToDoIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async listTaskLists(): Promise<TaskList[]>
  async syncTasks(listId: string): Promise<Task[]>
  async createTask(listId: string, task: Task): Promise<Task>
  async updateTask(listId: string, taskId: string, task: Task): Promise<Task>
  async deleteTask(listId: string, taskId: string): Promise<void>
}
```

---

#### iCloud Photos

**Authentication:** iCloud login (unofficial)
**Library:** `pyicloud` (Python) or `icloud-api` (Node.js)
**Challenge:** No official API - use reverse-engineered libraries

**Approach:**
```typescript
class iCloudPhotosIntegration {
  async authenticate(appleId: string, password: string, mfa?: string): Promise<void>
  async listAlbums(): Promise<Album[]>
  async getPhotosFromAlbum(albumId: string, limit?: number): Promise<Photo[]>
  async getRecentPhotos(days: number): Promise<Photo[]>
  async downloadPhoto(photoId: string): Promise<Buffer>
}
```

**Sync Strategy:**
- Fetch album list daily
- Download new photos from selected albums
- Cache locally for slideshow
- Frequency: Every 6-12 hours

---

#### OneDrive

**Authentication:** Microsoft Graph API OAuth 2.0
**Scopes:** `Files.Read`
**API Docs:** https://learn.microsoft.com/en-us/graph/api/resources/onedrive

**Key Endpoints:**
```
GET /me/drive/root/children - List root items
GET /me/drive/items/{itemId}/children - List folder items
GET /me/drive/items/{itemId}/content - Download file
```

**Implementation:**
```typescript
class OneDrivePhotosIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async listFolders(path?: string): Promise<Folder[]>
  async getPhotosFromFolder(folderId: string): Promise<Photo[]>
  async downloadPhoto(photoId: string): Promise<Buffer>
}
```

---

#### Enphase Enlighten API

**Authentication:** API Key or OAuth 2.0
**API Docs:** https://developer-v4.enphase.com/docs
**Rate Limits:** 10,000 requests/day (free tier)

**Key Endpoints:**
```
GET /api/v4/systems - List systems
GET /api/v4/systems/{systemId}/summary - System summary
GET /api/v4/systems/{systemId}/telemetry/production_meter - Real-time production
GET /api/v4/systems/{systemId}/energy_lifetime - Lifetime production
GET /api/v4/systems/{systemId}/stats - Daily/weekly/monthly stats
```

**Data Points:**
- Current production (W)
- Today's energy (Wh)
- Lifetime energy (Wh)
- System status
- Per-panel production (if available)

**Implementation:**
```typescript
class EnphaseIntegration {
  async authenticate(apiKey: string): Promise<void>
  async getSystemSummary(systemId: string): Promise<SystemSummary>
  async getCurrentProduction(systemId: string): Promise<ProductionData>
  async getEnergyStats(systemId: string, period: 'day'|'week'|'month'): Promise<EnergyStats>
}
```

**Sync Frequency:** Every 10-15 minutes during daylight hours

---

#### Sonos API

**Authentication:** OAuth 2.0
**API Docs:** https://developer.sonos.com/reference/
**Requires:** Sonos developer account approval

**Key Endpoints:**
```
GET /control/api/v1/groups - Get speaker groups
GET /control/api/v1/groups/{groupId}/playback - Get playback state
POST /control/api/v1/groups/{groupId}/playback/play - Play
POST /control/api/v1/groups/{groupId}/playback/pause - Pause
POST /control/api/v1/groups/{groupId}/groupVolume - Set volume
```

**Alternative:** Local network control via node-sonos library (no OAuth required, but limited to local network)

**Implementation:**
```typescript
class SonosIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async discoverSpeakers(): Promise<Speaker[]>
  async getGroups(): Promise<SpeakerGroup[]>
  async getPlaybackState(groupId: string): Promise<PlaybackState>
  async play(groupId: string): Promise<void>
  async pause(groupId: string): Promise<void>
  async skip(groupId: string): Promise<void>
  async setVolume(groupId: string, volume: number): Promise<void>
  async groupSpeakers(speakerIds: string[]): Promise<void>
}
```

**Sync Frequency:** Real-time via WebSocket or polling every 5 seconds

---

#### OpenWeatherMap API

**Authentication:** API Key
**API Docs:** https://openweathermap.org/api
**Free Tier:** 1,000 calls/day

**Key Endpoints:**
```
GET /data/2.5/weather?q={city} - Current weather
GET /data/2.5/forecast?q={city} - 5-day forecast
```

**Implementation:**
```typescript
class WeatherIntegration {
  async getCurrentWeather(location: string): Promise<CurrentWeather>
  async getForecast(location: string, days: number): Promise<ForecastDay[]>
}
```

**Sync Frequency:** Every 30-60 minutes
