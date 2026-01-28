# Prism v1.0 Integration Testing

## Overview
This document contains integration test cases for Prism v1.0.
These tests verify that components work together correctly.

**Prerequisites:**
- Docker containers running (app, db, redis)
- Database seeded with test data
- All regression tests passing

---

## 1. Data Flow Tests

### 1.1 Task Lifecycle
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create task via API | Task exists in database |
| 2 | Refresh dashboard | Task appears in Tasks widget |
| 3 | Toggle task complete via UI | API called, database updated |
| 4 | Refresh page | Task shows as completed |
| 5 | Delete task via API | Task removed from database |
| 6 | Refresh dashboard | Task no longer appears |

### 1.2 Chore Completion Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View chore in widget | Chore displayed with point value |
| 2 | Click complete | Completion modal/action triggered |
| 3 | Check database | chore_completions record created |
| 4 | Check points | Points awarded to user |

### 1.3 Shopping List Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new list | List appears in dropdown |
| 2 | Add items to list | Items appear grouped by category |
| 3 | Check items off | Items marked checked, count updates |
| 4 | Delete list | List and items removed |

---

## 2. Cache Integration

### 2.1 Weather Caching
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call weather API | Data returned, cached in Redis |
| 2 | Call again within 30 min | Cached data returned (faster) |
| 3 | Wait 30+ minutes | Fresh data fetched |

### 2.2 Event Cache Invalidation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fetch events | Events cached |
| 2 | Create new event | Cache invalidated |
| 3 | Fetch events again | Includes new event |

---

## 3. Database Integration

### 3.1 Foreign Key Relationships
| Test | Query | Expected Result |
|------|-------|-----------------|
| Task with user | GET task with assignedTo | User details included |
| Event with calendar source | GET event | Calendar source details included |
| Chore completion with user | GET completion | User who completed included |

### 3.2 Cascade Deletes
| Test | Action | Expected Result |
|------|--------|-----------------|
| Delete shopping list | DELETE list | All items in list also deleted |
| Delete chore | DELETE chore | All completions also deleted |

---

## 4. Authentication Integration

### 4.1 Session Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select user on PIN pad | User selection stored |
| 2 | Enter correct PIN | Session created, dashboard shown |
| 3 | Refresh page | Session persists |
| 4 | Logout | Session cleared |

---

## 5. External Service Integration

### 5.1 OpenWeatherMap
| Test | Expected Result |
|------|-----------------|
| Valid API key | Weather data returned |
| Invalid API key | Graceful error, widget shows fallback |
| Rate limited | Cached data used |

### 5.2 Google Calendar (Future)
| Test | Expected Result |
|------|-----------------|
| OAuth flow | Redirects to Google, returns with code |
| Token exchange | Access token stored |
| Event sync | Events imported to database |

---

## 6. End-to-End Scenarios

### 6.1 Morning Routine
1. Dashboard loads automatically (kiosk mode)
2. Weather shows current conditions
3. Calendar shows today's events
4. Chores show tasks due today
5. User completes morning chores
6. Points are awarded

### 6.2 Family Coordination
1. Parent adds calendar event
2. Event syncs to calendar source
3. Dashboard shows event for all family members
4. Reminder triggers before event

### 6.3 Shopping Trip
1. View shopping list on dashboard
2. Open full shopping page on phone (via QR)
3. Check items as shopping
4. Dashboard updates in real-time

---

## Test Execution Log

| Date | Tester | Scenario | Pass/Fail | Notes |
|------|--------|----------|-----------|-------|
| | | | | |

