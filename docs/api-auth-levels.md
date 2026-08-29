# API Auth Levels

Documents the authentication requirement for each API route. There are three access levels:

| Level | Mechanism | Description |
|---|---|---|
| **Public** | None | No auth needed — open to all requests |
| **Display** | `getDisplayAuth()` | Guest-accessible; supports kiosk/display mode via `displayUserId` setting. Returns guest-scoped data when unauthenticated. |
| **Auth** | `requireAuth()` | Requires active PIN session or API token. Returns 401 otherwise. |
| **Parent** | `requireAuth()` + `requireRole('canX')` | Requires auth AND a specific parent permission. Returns 401/403 otherwise. |

---

## Route Reference

### Auth & Session
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/auth/login` | — | Public |
| `/api/auth/logout` | — | Auth |
| `/api/auth/session` | Public | — |
| `/api/api-tokens` | Auth | Auth / Parent |

### Calendar
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/calendars` | Display | Auth |
| `/api/calendars/sync` | — | Auth |
| `/api/calendar-groups` | Display | Auth |
| `/api/calendar-notes` | Display | Auth |
| `/api/events` | Display | Auth |

### Tasks & Chores
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/tasks` | Display | Auth |
| `/api/chores` | Display | Auth (complete), Parent (approve) |
| `/api/chore-completions` | Display | Auth |

### Shopping & Meals
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/shopping-lists` | Display | Auth |
| `/api/shopping-items` | Display | Auth |
| `/api/meals` | Display | Auth |
| `/api/recipes` | Display | Auth |
| `/api/recipes/import-url` | — | Auth |
| `/api/recipes/import-paprika` | — | Auth |

### People & Family
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/family` | Public ¹ | Parent |
| `/api/points` | Display | Auth |
| `/api/goals` | Display | Auth (create), Parent (redeem) |
| `/api/birthdays` | Display | Auth |
| `/api/gift-ideas` | Auth | Auth |
| `/api/wish-items` | Display | Auth |

> ¹ `/api/family` GET is public so the PinPad can list members for login.

### Photos & Media
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/photos` | Display | Auth |
| `/api/photos/[id]/file` | Display | — |
| `/api/photo-sources` | Auth | Auth |
| `/api/photos/sync` | — | Auth |

### Messages & Notifications
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/messages` | Auth | Auth |

### Modes & Overlays
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/away-mode` | Public | Auth (manual), Public (auto-activate same-origin) |
| `/api/babysitter-mode` | Public | Auth |
| `/api/babysitter-info` | Display (non-sensitive) / Auth (sensitive) | Auth |

### Bus Tracking
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/bus-tracking/routes` | Display | Auth |
| `/api/bus-tracking/arrivals` | Display | — |
| `/api/bus-tracking/sync` | — | Auth |

### Integrations & Settings
| Route | GET | POST/PATCH/DELETE |
|---|---|---|
| `/api/integrations/google` | Auth | Auth |
| `/api/integrations/microsoft` | Auth | Auth |
| `/api/settings` | Display | Parent |
| `/api/settings/wifi` | Auth | Parent |
| `/api/layouts` | Display | Auth |
| `/api/maintenance` | Auth | Auth |

### Admin
| Route | GET | POST |
|---|---|---|
| `/api/admin/backups` | Auth + Parent | Auth + Parent |
| `/api/admin/restore` | — | Auth + Parent |
| `/api/admin/seed` | — | Auth + Parent |
| `/api/audit-logs` | Auth + Parent | — |
| `/api/health` | Public | — |

### Setup
`/api/setup/credentials/*` are reached from **Settings**, not the setup wizard,
so they all require an authenticated parent. `/api/setup/complete` and
`/api/setup/status` run before any account exists and are necessarily public.

| Route | GET | POST |
|---|---|---|
| `/api/setup/status` | Public | — |
| `/api/setup/complete` | — | Public ¹ |
| `/api/setup/credentials/google` | — | Auth + Parent |
| `/api/setup/credentials/microsoft` | — | Auth + Parent |
| `/api/setup/credentials/kroger` | — | Auth + Parent |
| `/api/setup/credentials/weather` | — | Auth + Parent |

> ¹ Writes the `setupComplete` marker during first-time setup, before any user
> exists to authenticate as.

### Voice / Alexa
| Route | GET | POST |
|---|---|---|
| `/api/v1/voice/*` | Auth (token, scope `voice` or `*`) | Auth (token, scope `voice` or `*`) |
| `/api/alexa` | — | Alexa-signed (verifies SignatureCertChainUrl + body sig) |

---

## Notes

- **CSRF protection**: All mutation endpoints (POST/PATCH/DELETE) are protected by `src/middleware.ts` which validates the `Origin` header against the request `Host`. The `/api/away-mode` path is exempt to support auto-activation from display clients that may not send an `Origin` header.
- **Rate limiting**: Login attempts are rate-limited via Redis. Admin backup creation is rate-limited to 5/hour.
- **API tokens**: Bearer token auth (`Authorization: Bearer <token>`) is accepted in place of session cookies on all `requireAuth` routes. Tokens are scoped per-user and stored hashed.
