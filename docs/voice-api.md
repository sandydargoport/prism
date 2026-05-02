# Voice API (`/api/v1/voice/*`)

The Voice API is a versioned, token-authenticated surface designed for voice and home-automation integrations (Alexa skills, Home Assistant components, Google Assistant via HA, scripting hooks). It is intentionally separate from the internal session-cookie-authenticated routes the dashboard uses — the contract here is **stable** and external callers can rely on it.

## Auth

Every Voice API endpoint requires `Authorization: Bearer <token>` where the token's scopes include either `voice` or `*`. **Session cookies are rejected** — this is intentionally a machine-to-machine surface, so a stolen browser session can't reach voice endpoints.

Tokens are issued via `POST /api/auth/tokens` (parent-only), SHA-256 hashed at rest, and never re-displayed after creation. The recommended scope for voice integrations is `['voice']` so a token leak cannot read or modify anything outside `/api/v1/voice/*`.

```bash
curl -X POST http://localhost:3000/api/auth/tokens \
  -H "Cookie: prism_session=<your-parent-session>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Alexa skill", "scopes": ["voice"] }'
```

The response includes `token` — store it immediately, it is not retrievable later.

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

- `ok` — boolean. `false` for errors.
- `spoken` — natural-language string the caller speaks back to the user. Pre-formatted on the server so callers don't need templating.
- `data` — optional structured payload. Present on success; omitted on error.

Errors return the same shape with `ok: false`, an HTTP error status, and a user-friendly `spoken` apology (no stack traces or IDs).

## Rate limiting

Per-token, 60 requests per 60 seconds. Returns `429` with a `voice`-shaped error body when exceeded.

## Versioning

The path prefix `/api/v1/` is the contract version. Breaking changes ship under `/api/v2/` with `/api/v1/` continuing to function. New non-breaking endpoints can be added to `v1` freely.

## Endpoints

### `GET /api/v1/voice/family`

Lists family members, excluding guest accounts. Useful for syncing Alexa custom slot types (`FAMILY_MEMBER`).

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

Incomplete tasks whose `dueDate` falls within today (server local time).

**Response data**: `{ count, tasks: [{ id, title, dueDate, priority, assignedTo }] }`

**Spoken**: `"You have 2 tasks today: Fix leaky faucet, and Practice piano."`

### `POST /api/v1/voice/shopping/add`

**Body**: `{ item: string, list?: string, quantity?: number, unit?: string }`

Fuzzy-matches the list by name when `list` is given; otherwise adds to the first list (by `sortOrder`). Invalidates the `shopping-lists` cache on success.

**Spoken**: `"Added milk to Grocery."`

### `POST /api/v1/voice/chore/complete`

**Body**: `{ chore: string, assignee?: string }`

Fuzzy-matches the chore name (case-insensitive substring on `title`). See "Security model" below for the disambiguation rule and the no-approval guarantee.

**Spoken (success)**: `"Marked feed the dog complete."`
**Spoken (pending approval)**: `"Marked feed the dog complete. A parent will need to approve in the app."`
**Spoken (ambiguous, ok:false)**: `"Multiple chores match 'feed the dog'. Which family member: Emma, Sophie?"` — `data.candidates` lists each option; caller resends with `assignee`.

### `POST /api/v1/voice/message/post`

**Body**: `{ message: string }`

Author defaults to the first parent (by `sortOrder`). Voice has no way to verify which family member is speaking, so attributing posts to a designated parent keeps the audit trail honest. A future `voiceUser` setting could let households pick a different default.

**Spoken**: `"Posted message: 'soccer practice moved to 4pm today.'"`

## Security model for write operations

Voice cannot escalate privileges. Specifically:

- **Chore completions inherit the chore's `assignedTo`** as the completer — voice does not let one family member claim another's points.
- **Ambiguous chore names require disambiguation.** If a fuzzy name match returns multiple chores assigned to different family members (e.g. both Emma and Sophie have "Feed the dog"), the endpoint returns `ok: false` with a `spoken` prompt asking for the assignee (*"Multiple chores match 'feed the dog' — which family member?"*) and `data.candidates: [...]`. The caller resends with `assignee` in the body. A single match completes immediately.
- **Chores with `requiresApproval: true` create *pending* completions** when completed via voice, just like the in-app flow. The `spoken` response makes this explicit (e.g. *"Marked feed the dog complete. A parent will need to approve in the app."*).
- **Approval is in-app only**, behind the Parent PIN. Voice has no way to approve a pending chore — there is no way to verify the speaker is a parent.

## Roadmap

The next phase is the Alexa skill itself, then a HACS-published Home Assistant `custom_component` (see `memory/alexa-voice-api-feature.md`). A later "device-control intents" phase will add a server-sent command bus so voice can drive the running dashboard UI (e.g. *"pull up the lasagna recipe"*).
