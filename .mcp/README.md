# Prism MCP Server

Exposes the Prism family dashboard API as MCP tools so AI agents (Claude Desktop, Cursor, VS Code Copilot Chat, etc.) can read and write family data.

- **SDK**: [`@modelcontextprotocol/sdk` v1.29+](https://github.com/modelcontextprotocol/typescript-sdk)
- **Transport**: stdio (local subprocess launched by the AI client)
- **Spec**: 2025-06-18 — returns `structuredContent` alongside `content` on every tool, so modern clients can use parsed objects without re-parsing JSON
- **Auth**: bearer token from Prism's Settings → Security → API Tokens, passed via env vars in the client config

A future remote/hosted variant (Streamable HTTP + OAuth 2.1, per spec 2025-11-25) would let users plug Prism into AI clients without running a local Node process — not built yet.

## Setup

```bash
cd .mcp
npm install
npm run build
```

## Configuration

Set two environment variables before running:

| Variable | Value |
|---|---|
| `PRISM_BASE_URL` | Base URL of your Prism instance — e.g. `https://prism.example.com` |
| `PRISM_API_TOKEN` | Bearer token from **Settings → Security → API Tokens** |

## Running

```bash
# Build + run
npm run build && npm start

# Development (no build step)
PRISM_BASE_URL=https://prism.example.com PRISM_API_TOKEN=yourtoken npm run dev
```

## Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prism": {
      "command": "node",
      "args": ["/absolute/path/to/prism/.mcp/dist/index.js"],
      "env": {
        "PRISM_BASE_URL": "https://prism.example.com",
        "PRISM_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## VS Code / Cursor config (`.cursor/mcp.json` or workspace MCP config)

```json
{
  "mcpServers": {
    "prism": {
      "command": "node",
      "args": [".mcp/dist/index.js"],
      "env": {
        "PRISM_BASE_URL": "https://prism.example.com",
        "PRISM_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## Gemini CLI / Gemini Code Assist config

Gemini CLI (free with a Google account) and Gemini Code Assist (agent mode) share the same MCP config. Edit `~/.gemini/settings.json` — on Windows, `%USERPROFILE%\.gemini\settings.json`:

```json
{
  "mcpServers": {
    "prism": {
      "command": "node",
      "args": ["/absolute/path/to/prism/.mcp/dist/index.js"],
      "env": {
        "PRISM_BASE_URL": "https://prism.example.com",
        "PRISM_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

In Gemini Code Assist, enable **agent mode** in chat. Use `/mcp` to confirm Prism is connected.

> The Gemini web app at `gemini.google.com` does **not** support custom MCP servers — Gemini CLI / Code Assist / Enterprise are the supported surfaces.

## Available tools

| Tool | Description |
|---|---|
| `get_household_time` | The household time zone, today's date there, the local time and the week start |
| `list_chores` | List all chores (filter by user, enabled status) |
| `create_chore` | Create a new chore |
| `update_chore` | Update a chore (title, frequency, assignment, etc.) |
| `delete_chore` | Delete a chore |
| `complete_chore` | Mark a chore complete for a user |
| `list_tasks` | List tasks (filter by user, priority, due date) |
| `create_task` | Create a task |
| `update_task` | Update a task (including marking complete) |
| `delete_task` | Delete a task |
| `list_events` | List calendar events in a date range |
| `create_event` | Create a calendar event |
| `update_event` | Update an event |
| `delete_event` | Delete an event |
| `list_shopping_lists` | List all shopping lists |
| `list_shopping_items` | List items in a shopping list |
| `add_shopping_item` | Add an item to a shopping list |
| `update_shopping_item` | Update an item (e.g. check it off) |
| `delete_shopping_item` | Remove an item |
| `list_messages` | List family message board posts |
| `post_message` | Post a message to the board |
| `delete_message` | Delete a message |
| `list_family` | List family members with their UUIDs and roles |
| `list_meals` | List meal plan entries between two dates |
| `create_meal` | Add a meal to the plan on a date |
| `delete_meal` | Remove a meal |
| `list_goals` | List family goals (rewards bought with chore points) |
| `create_goal` | Create a goal (name and point cost) |
| `get_weather` | Get current weather and today's forecast |
| `list_recipes` | List saved recipes |
| `import_recipe_url` | Import a recipe from a URL |
| `list_maintenance` | List home maintenance reminders |
| `create_maintenance_item` | Create a maintenance reminder |
| `get_points` | Get chore point totals for all family members |

## Dates and times

Times are read in the household time zone, the one set in Prism's settings. `get_household_time` returns it along with today's date there, so a client can work out "3 PM tomorrow" without guessing.

Anywhere a tool takes a date-time (`startTime`, `endTime`, `startDate`, `endDate`, `expiresAt`), it accepts:

| Form | Example | Read as |
|---|---|---|
| Wall time, no offset | `2026-10-04T15:00` | 3 PM in the household time zone |
| ISO date-time with offset | `2026-10-04T15:00:00-05:00`, `...Z` | that exact instant |
| Date | `2026-10-04` | the whole household day (`list_events` range), or a day of an all-day event |

For an all-day event pass `allDay: true` with dates: `startTime` is the first day and `endTime` the last day, inclusive (omit it for a one-day event). Events come back with `startTime`/`endTime` in UTC plus `localStart`/`localEnd` in the household zone.

Task, chore and meal dates are already plain `YYYY-MM-DD` with an `HH:mm` time where they have one, both in the household zone.

A Prism server older than `/api/household-time` cannot report its zone: send times with an explicit offset to it.

## Tests

```bash
npm run build && npm test
```

`npm test` calls every tool through an MCP client against a recording fake of the API, checking the fields each one sends against its route, and covers the time conversion, including daylight-saving changes.

## Finding user UUIDs

Many tools require a user UUID (e.g. `assignedTo`, `authorId`). Use `list_family` first to get them:

```
list_family → returns array of { id, name, role, color }
```

## Token scope

The API token must have the `*` scope (full access) or the relevant scope for the operations you want. Generate tokens in **Settings → Security → API Tokens**.

## Response shape

Every tool returns both legacy and structured forms:

- `content[0].text` — the API response serialized as JSON text (works with any MCP client).
- `structuredContent` — the parsed object. Arrays are wrapped under `items`; primitives under `value`; objects are passed through. Modern clients that consume `structuredContent` directly skip the parse step.

Per-tool `outputSchema` declarations are intentionally omitted — Prism's REST responses vary by endpoint and we don't want to drift from upstream silently. Clients that need strict typing can validate against the documented API.
