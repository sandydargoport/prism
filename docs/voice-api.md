# Voice API (`/api/v1/voice/*`)

The Voice API is a versioned, token-authenticated surface designed for voice and home-automation integrations (Alexa skills, Home Assistant components, Google Assistant via HA, scripting hooks). It is intentionally separate from the internal session-cookie-authenticated routes the dashboard uses — the contract here is **stable** and external callers can rely on it.

## Auth

Every endpoint accepts:

- `Authorization: Bearer <token>` — long-lived API token issued via `POST /api/auth/tokens` (parent-only). **Recommended for external integrations.**
- A valid `prism_session` cookie — also works, useful for browser-based debugging.

Tokens are SHA-256 hashed at rest and never re-displayed after creation.

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

## Issuing a token

```bash
curl -X POST http://localhost:3000/api/auth/tokens \
  -H "Cookie: prism_session=<your-parent-session>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Alexa skill" }'
```

The response includes `token` — store it immediately, it is not retrievable later.

## Roadmap

The following endpoints are planned but not yet implemented (see `memory/alexa-voice-api-feature.md`):

- `GET /api/v1/voice/calendar/upcoming` — next N events
- `POST /api/v1/voice/shopping/add` — add item to a list
- `POST /api/v1/voice/chore/complete` — mark a chore done by fuzzy name
- `GET /api/v1/voice/tasks/today` — tasks due today
- `POST /api/v1/voice/message/post` — post a family message
- `GET /api/v1/voice/family` — family member names (for Alexa slot type sync)
