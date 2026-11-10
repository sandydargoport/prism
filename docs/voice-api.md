# Voice and automation API

Ask Prism what is on today, or add to the shopping list, from a voice assistant or a script.

The API lives under `/api/v1/voice/*` and needs a token. It works with Alexa skills, Home Assistant and your own scripts. It is separate from the routes the app itself uses, and it is stable: it will not change under you.

## Auth

Every Voice API endpoint requires `Authorization: Bearer <token>`, where the token's scopes include `voice` or `*`. Session cookies are rejected, because the API is for machines, so a stolen browser session can't reach voice endpoints.

Tokens are issued by `POST /api/auth/tokens` (parents only), stored as SHA-256 hashes, and never shown again after creation. Use the scope `['voice']` for voice integrations, so a leaked token cannot read or change anything outside `/api/v1/voice/*`.

```bash
curl -X POST http://localhost:3000/api/auth/tokens \
  -H "Cookie: prism_session=<your-parent-session>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Alexa skill", "scopes": ["voice"] }'
```

The response includes `token`. Store it at once, because it cannot be retrieved later.

### Known scopes

| Scope | Grants |
|---|---|
| `voice` | Read + write across `/api/v1/voice/*` only |
| `*` | Full account access (legacy default; avoid for new tokens) |

## Response shape

Every endpoint returns:

```json
{
  "ok": true,
  "spoken": "Today you have Soccer Practice at 4 PM.",
  "data": { "...endpoint-specific..." }
}
```

- `ok`: boolean. `false` for errors.
- `spoken`: a plain-language sentence the caller reads back to the user. The server formats it, so callers need no templating.
- `data`: optional structured payload, present on success and omitted on error.

Errors return the same shape with `ok: false`, an HTTP error status, and a friendly `spoken` apology with no stack traces or IDs.

## Rate limiting

Each token gets 60 requests per 60 seconds. Past that, the API returns `429` with an error body in the shape above.

## Versioning

The path prefix `/api/v1/` is the contract version. Breaking changes ship under `/api/v2/`, and `/api/v1/` keeps working. New endpoints that break nothing can be added to `v1` at any time.

## Endpoints

### `GET /api/v1/voice/family`

Lists family members, leaving out guest accounts. Use it to sync Alexa custom slot types (`FAMILY_MEMBER`).

**Response data**: `{ count, members: [{ id, name, role, color }] }`

**Spoken**: `"Your family has Alex, Jordan, Emma, and Sophie."`

### `GET /api/v1/voice/calendar/today`

Returns events whose `startTime` falls within today (server local time).

**Response data**:

```json
{
  "count": 1,
  "events": [
    {
      "id": "uuid",
      "title": "Soccer Practice",
      "startTime": "2026-05-02T21:00:00.000Z",
      "endTime": "2026-05-02T22:30:00.000Z",
      "allDay": false,
      "location": "Community Park"
    }
  ]
}
```

**Spoken examples**:

- `"You have no events today."`
- `"Today you have Soccer Practice at 4 PM."`
- `"Today you have Standup at 9 AM and Lunch at 12:30 PM."`
- `"Today you have A at 8 AM, B at 10 AM, and C at 2 PM."` (Oxford comma)

### `GET /api/v1/voice/calendar/upcoming?count=N`

Returns the next `N` events ordered by start time (default 3, clamped to 1..10).

**Response data**: same shape as `calendar/today`.

**Spoken**: `"Coming up: Soccer today at 4 PM, Dentist tomorrow on Sunday at 9 AM, and Movie on Tuesday at 6 PM."`

### `GET /api/v1/voice/tasks/today`

Incomplete tasks due today in the household time zone.

**Response data**: `{ count, tasks: [{ id, title, dueDate, dueTime, priority, assignedTo }] }`. `dueDate` is `YYYY-MM-DD`; `dueTime` is `HH:mm`, or null for a task due any time that day.

**Spoken**: `"You have 2 tasks today: Fix leaky faucet, and Practice piano."`

### `POST /api/v1/voice/shopping/add`

**Body**: `{ item: string, list?: string, quantity?: number, unit?: string }`

Fuzzy-matches the list by name when `list` is given, and otherwise adds to the first list (by `sortOrder`). Clears the `shopping-lists` cache on success.

**Spoken**: `"Added milk to Grocery."`

### `POST /api/v1/voice/chore/complete`

**Body**: `{ chore: string, assignee?: string }`

Fuzzy-matches the chore name (case-insensitive substring on `title`). See "Security model" below for the disambiguation rule and the no-approval guarantee.

**Spoken (success)**: `"Marked feed the dog complete."`
**Spoken (pending approval)**: `"Marked feed the dog complete. A parent will need to approve in the app."`
**Spoken (ambiguous, ok:false)**: `"Multiple chores match 'feed the dog'. Which family member: Emma, Sophie?"`. `data.candidates` lists each option; caller resends with `assignee`.

### `POST /api/v1/voice/message/post`

**Body**: `{ message: string }`

The author is the first parent (by `sortOrder`). Voice has no way to check which family member is speaking, so posting as one set parent keeps the audit trail honest. A future `voiceUser` setting could let a household pick a different default.

**Spoken**: `"Posted message: 'soccer practice moved to 4pm today.'"`

### `GET /api/v1/voice/weather/today`

Returns current conditions and today's high and low, using the active weather provider (`WEATHER_PROVIDER=meteo|pirate|openweather`) and the household location setting.

**Response data**: `{ location, currentTemp, feelsLike, description, condition, humidity, high, low, precipProbability }`

**Spoken example**: `"Chicago: currently 65 degrees. Partly cloudy. high 72, low 58."`

### `GET /api/v1/voice/bus/status?student=Emma`

Returns today's active bus routes with arrival predictions. The optional `student` filter narrows by `studentName` (case-insensitive substring). Each route's `activeDays` array decides whether it is active today.

**Response data**: `{ count, routes: [{ id, label, studentName, direction, scheduledTime, prediction }] }`

**Spoken examples**:

- `"No bus routes are scheduled today."`
- `"Emma AM: 5 minutes away."`
- `"Emma AM: arrived at the stop and Sophie PM: scheduled 15:25, no live data yet."`

### `GET /api/v1/voice/birthdays/upcoming?days=N`

Returns birthdays and anniversaries in the next `N` days (default 30, clamped to 1..365). It compares month and day only, so old birth years work, and reports the age the person is turning when the year is known.

**Response data**: `{ count, birthdays: [{ id, name, eventType, nextOccurrence, turning }] }`

**Spoken examples**:

- `"No upcoming birthdays."`
- `"Coming up: Emma's birthday on Saturday, turning 8."`

### `GET /api/v1/voice/meals/today`

Returns meals planned for today (breakfast, lunch, dinner, snack), ordered by meal type. It reads meal entries within ±7 days of today, so weeks that start on Sunday or Monday both work.

**Response data**: `{ count, meals: [{ id, name, mealType, mealTime }] }`

**Spoken examples**:

- `"No meals are planned for today."`
- `"Today's plan is dinner: Tacos."`
- `"Today's meals: breakfast: Oatmeal, lunch: Salad, and dinner: Tacos."`

### `GET /api/v1/voice/chores/today?assignee=Emma`

Returns enabled chores that are due today or overdue. With `assignee` set, it returns that family member's chores (case-insensitive name match) and chores with no assignee, which anyone can do. Without `assignee`, it returns all chores due today.

**Response data**: `{ count, chores: [{ id, title, assignedTo, nextDue, pointValue }], assigneeName }`

**Spoken examples**:

- `"No chores are due today."`
- `"Emma has one chore today: Feed the dog."`
- `"You have 3 chores today: Take out trash, Vacuum, and Wipe counters."`

### `GET /api/v1/voice/message/recent?count=N`

Returns the most recent (non-expired) family messages, newest first. `count` defaults to 3, clamped to 1..10.

**Response data**: `{ count, messages: [{ id, message, authorName, createdAt }] }`

**Spoken examples**:

- `"No recent family messages."`
- `"Latest message from Alex today: soccer at 4."`
- `"Recent messages: Alex today: soccer, Jordan yesterday: groceries done, and Emma on Friday: party RSVP."`

## Security model for write operations

Voice cannot gain more rights than the app gives:

- A chore completion records the chore's `assignedTo` as the completer, so one family member cannot claim another's points by voice.
- An ambiguous chore name must be resolved. If a fuzzy name match returns multiple chores assigned to different family members (e.g. both Emma and Sophie have "Feed the dog"), the endpoint returns `ok: false` with a `spoken` prompt asking for the assignee (*"Multiple chores match 'feed the dog'. Which family member?"*) and `data.candidates: [...]`. The caller resends with `assignee` in the body. A single match completes immediately.
- A chore without `requiresApproval` is approved at once, with the assignee recorded as approver, as it is in the app. A child cannot add a second completion (HTTP 409) while one is still pending. Pending completions keep their points, which count once a parent approves.
- A chore with `requiresApproval: true` is always *pending* when completed by voice, even a parent's. The `spoken` response makes this explicit (e.g. *"Marked feed the dog complete. A parent will need to approve in the app."*).
- Approval happens only in the app, behind the Parent PIN. Voice cannot approve a pending chore, because it cannot verify that the speaker is a parent.

## Roadmap

The next phase is the Alexa skill itself, then a HACS-published Home Assistant `custom_component`, tracked in [#56](https://github.com/sandydargoport/prism/issues/56). A later "device-control intents" phase will add a server-sent command bus so voice can drive the running dashboard UI (e.g. *"pull up the lasagna recipe"*).
