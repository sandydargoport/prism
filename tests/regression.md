# Prism v1.0 Regression Testing

## Overview
This document contains manual regression test cases for Prism v1.0.
Each section indicates the implementation status and expected behavior.

**Test Environment:**
- URL: `http://localhost:3000`
- Database: PostgreSQL (via Docker)
- Cache: Redis (via Docker)

---

## 1. API Endpoints (Backend)

### 1.1 Family/Users API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET all family members | `curl http://localhost:3000/api/family` | Returns JSON with `members` array containing 4 users (Alex, Jordan, Emma, Sophie) |
| GET single member | `curl http://localhost:3000/api/family/{id}` | Returns single user object |
| User has correct fields | Check API response | Each user has: id, name, role, color, email, avatarUrl, hasPin, createdAt |

### 1.2 Tasks API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET all tasks | `curl http://localhost:3000/api/tasks` | Returns JSON with `tasks` array |
| GET with limit | `curl "http://localhost:3000/api/tasks?limit=5"` | Returns max 5 tasks |
| GET incomplete only | `curl "http://localhost:3000/api/tasks?completed=false"` | Returns only incomplete tasks |
| POST create task | `curl -X POST -H "Content-Type: application/json" -d '{"title":"Test Task","priority":"medium"}' http://localhost:3000/api/tasks` | Returns 201 with new task |
| PATCH update task | `curl -X PATCH -H "Content-Type: application/json" -d '{"completed":true}' http://localhost:3000/api/tasks/{id}` | Returns updated task |
| DELETE task | `curl -X DELETE http://localhost:3000/api/tasks/{id}` | Returns success message |

### 1.3 Events/Calendar API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET events (requires dates) | `curl "http://localhost:3000/api/events?startDate=2026-01-27T00:00:00Z&endDate=2026-02-27T00:00:00Z"` | Returns events in date range |
| GET without dates | `curl http://localhost:3000/api/events` | Returns error: "startDate and endDate are required" |
| POST create event | `curl -X POST -H "Content-Type: application/json" -d '{"title":"Test Event","startTime":"2026-01-28T10:00:00Z","endTime":"2026-01-28T11:00:00Z"}' http://localhost:3000/api/events` | Returns 201 with new event |

### 1.4 Chores API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET all chores | `curl http://localhost:3000/api/chores` | Returns JSON with `chores` array |
| GET chore by ID | `curl http://localhost:3000/api/chores/{id}` | Returns single chore |
| POST complete chore | `curl -X POST -H "Content-Type: application/json" -d '{"completedBy":"{userId}"}' http://localhost:3000/api/chores/{id}/complete` | Returns completion record |
| PATCH update chore | `curl -X PATCH -H "Content-Type: application/json" -d '{"enabled":false}' http://localhost:3000/api/chores/{id}` | Returns updated chore |

### 1.5 Shopping Lists API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET all lists | `curl http://localhost:3000/api/shopping-lists` | Returns JSON with `lists` array |
| POST create list | `curl -X POST -H "Content-Type: application/json" -d '{"name":"Hardware Store"}' http://localhost:3000/api/shopping-lists` | Returns 201 with new list |
| GET items for list | `curl "http://localhost:3000/api/shopping-items?listId={listId}"` | Returns items for that list |
| POST add item | `curl -X POST -H "Content-Type: application/json" -d '{"listId":"{id}","name":"Milk","category":"dairy"}' http://localhost:3000/api/shopping-items` | Returns 201 with new item |
| PATCH toggle item | `curl -X PATCH -H "Content-Type: application/json" -d '{"checked":true}' http://localhost:3000/api/shopping-items/{id}` | Returns updated item |

### 1.6 Meals API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET meals | `curl http://localhost:3000/api/meals` | Returns JSON with `meals` array |
| GET meals by week | `curl "http://localhost:3000/api/meals?weekOf=2026-01-27"` | Returns meals for that week |
| POST create meal | `curl -X POST -H "Content-Type: application/json" -d '{"name":"Spaghetti","scheduledDate":"2026-01-28","mealType":"dinner"}' http://localhost:3000/api/meals` | Returns 201 with new meal |

### 1.7 Messages API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET messages | `curl http://localhost:3000/api/messages` | Returns JSON with `messages` array |
| POST create message | `curl -X POST -H "Content-Type: application/json" -d '{"content":"Hello family!","authorId":"{userId}"}' http://localhost:3000/api/messages` | Returns 201 with new message |
| DELETE message | `curl -X DELETE http://localhost:3000/api/messages/{id}` | Returns success message |

### 1.8 Weather API
**Status:** Implemented (with caching)

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET weather | `curl http://localhost:3000/api/weather` | Returns current weather + 5-day forecast for configured location |
| Response structure | Check response | Has: location, current (temp, condition, humidity), forecast array |

### 1.9 Maintenance API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET reminders | `curl http://localhost:3000/api/maintenance` | Returns maintenance reminders |
| POST complete | `curl -X POST http://localhost:3000/api/maintenance/{id}/complete` | Marks reminder as completed |

### 1.10 Birthdays API
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| GET birthdays | `curl http://localhost:3000/api/birthdays` | Returns birthdays list |

---

## 2. Dashboard UI (Frontend)

### 2.1 Page Load
**Status:** Implemented (but see known issues)

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Dashboard loads | Navigate to `http://localhost:3000` | Page renders with widget grid |
| Shows greeting | Check header | Shows "Good morning/afternoon/evening" based on time |
| Clock widget | Check clock | Shows current time, updates every second |

### 2.2 Widget Display
**Status:** Partially Implemented

**KNOWN ISSUE:** Widgets may show demo data instead of API data. This appears to be a client-side hydration issue. APIs return real data but widgets fall back to demo data.

| Widget | Expected Behavior | Current Status |
|--------|-------------------|----------------|
| Clock | Shows current time | Working |
| Weather | Shows real weather from OpenWeatherMap | May show demo data |
| Calendar | Shows events from database | May show demo data |
| Tasks | Shows tasks from database | May show demo data |
| Messages | Shows family messages | May show demo data |
| Chores | Shows chores from database | May show demo data |
| Shopping | Shows shopping lists | May show demo data |
| Meals | Shows meal plan for week | May show demo data |

### 2.3 Widget Interactions
**Status:** To Test (may not work if widgets show demo data)

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Task toggle | Click checkbox on task | Task completion toggles, syncs to API |
| Add task | Click + button on Tasks widget | Opens add task modal |
| Add message | Click + button on Messages widget | Opens add message modal |
| Calendar view change | Change dropdown on Calendar widget | View updates (3 days, week, etc.) |
| Shopping item toggle | Click checkbox on shopping item | Item checked/unchecked |

---

## 3. Full Page Views

### 3.1 Calendar Page (`/calendar`)
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/calendar` | Full calendar view displays |
| Back button | Click home icon | Returns to dashboard |
| View switching | Click day/week/month buttons | Calendar view changes |
| Event display | Check calendar | Events from database shown (or demo) |

### 3.2 Tasks Page (`/tasks`)
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/tasks` | Full tasks view displays |
| Filter by person | Use filter dropdown | Tasks filtered by assignee |
| Sort options | Use sort dropdown | Tasks reorder |
| Complete task | Click checkbox | Task marked complete |

### 3.3 Chores Page (`/chores`)
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/chores` | Full chores view displays |
| Filter options | Use filters | Chores filtered |
| Complete chore | Click complete button | Chore marked complete |
| Points display | Check UI | Point values shown |

### 3.4 Shopping Page (`/shopping`)
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/shopping` | Shopping lists display |
| List selection | Click different list | Items for that list shown |
| Check item | Click checkbox | Item marked checked |
| Category grouping | Check display | Items grouped by category |

### 3.5 Meals Page (`/meals`)
**Status:** Implemented

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/meals` | Weekly meal plan displays |
| Week navigation | Click prev/next | Different week shown |
| Day display | Check layout | Days of week with assigned meals |

### 3.6 Settings Page (`/settings`)
**Status:** Implemented (UI only, some features may not persist)

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Page loads | Navigate to `/settings` | Settings interface displays |
| Family section | Check UI | Shows family members |
| Theme toggle | Toggle dark/light | Theme changes |

---

## 4. Authentication

### 4.1 PIN Pad
**Status:** Implemented (UI exists)

| Test | Steps | Expected Result |
|------|-------|-----------------|
| PIN pad display | Check if PIN required | Shows family member selection + PIN entry |
| Select member | Click family member | PIN entry shown |
| Enter PIN | Enter 4-digit PIN | Authenticated (if correct) |

**Note:** Default PINs in seed data:
- Alex: 1234
- Jordan: 5678
- Emma: 1111
- Sophie: 2222

---

## 5. Non-Functional Requirements

### 5.1 Performance
| Test | Steps | Expected Result |
|------|-------|-----------------|
| Initial page load | Measure with DevTools | Under 3 seconds |
| API response time | Check Network tab | Under 500ms |
| Redis caching | Call weather API twice | Second call faster (cached) |

### 5.2 Responsive Design
| Test | Steps | Expected Result |
|------|-------|-----------------|
| Desktop (1920x1080) | Resize browser | Full grid layout |
| Tablet (768px) | Resize browser | Adjusted grid |
| Mobile (375px) | Resize browser | Single column layout |

### 5.3 Error Handling
| Test | Steps | Expected Result |
|------|-------|-----------------|
| Invalid API request | `curl http://localhost:3000/api/tasks/invalid-id` | Returns 404 with error message |
| Database down | Stop db container, make request | Returns 500 with graceful error |

---

## 6. Known Issues & Limitations (v1.0)

### 6.1 Not Yet Implemented
- [ ] Calendar sync with Google (OAuth flow exists but full sync not complete)
- [ ] Calendar sync with Apple iCloud
- [ ] Photo slideshow widget
- [ ] Sonos music control
- [ ] Push notifications
- [ ] Homebridge integration
- [ ] Life360 integration

### 6.2 Known Bugs
- [ ] **Widgets showing demo data**: Client-side hydration may not properly fetch API data
- [ ] Dashboard may need hard refresh after container rebuild

### 6.3 Workarounds
- Use API endpoints directly via curl to verify data exists
- Check browser DevTools Console for JavaScript errors
- Check Network tab to verify API calls are being made

---

## Test Execution Log

| Date | Tester | Section | Pass/Fail | Notes |
|------|--------|---------|-----------|-------|
| | | | | |

