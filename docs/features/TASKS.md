# Tasks System

## Overview
Tasks support list organization, priority levels, and bidirectional sync with Microsoft To-Do.

## Task Properties
- Title (required)
- Description (optional)
- Priority: high, medium, low
- Due date (optional)
- Completed status
- Assigned to (family member)
- List assignment (optional)

## Task Lists

### Creating Lists
- Settings → Task Integrations
- Click "Create List"
- Enter name, select color
- Optional: Connect to external provider

### List Features
- Color coding for visual organization
- Edit name via pencil icon
- Delete via trash icon (tasks unassigned)
- Connect/change external sync

## Filtering

### List Filter
- Dropdown in Tasks page header
- "All Lists" shows everything
- "None" shows unassigned tasks
- Specific list shows only those tasks

### View Options
- Show/hide completed tasks
- Sort by priority, due date, or creation

## Microsoft To-Do Integration

### Connection Flow
1. Click "Connect Microsoft To-Do"
2. Complete OAuth authentication
3. Select which MS To-Do list to sync
4. Choose: Create new Prism list or connect to existing

### Per-List Connection
- Each Prism list connects to one MS list
- Use "Connect" button on specific list
- "Change external list" to switch MS list

### Sync Behavior
- Bidirectional with newest-wins conflict resolution
- Fields synced: title, notes, completed, due date
- Subtasks flattened into notes
- Manual sync via button or auto-sync

### Auto-Sync
- Triggers on dashboard mount if stale (>5 min)
- Background sync every 5 minutes
- Pauses when tab hidden
- Also syncs on screensaver with Tasks widget

## Task UI

### Task Item Display
- Title with strikethrough when completed
- Priority indicator (color coded)
- Due date (if set)
- List tag with color dot (if assigned)
- Assigned user avatar

### Task Modal
- Title input
- Description textarea
- Priority selector
- Due date picker
- List selector dropdown
- Assigned to selector

## Authentication
- Creating tasks requires login
- Edit/delete requires ownership or parent role
- `requireAuth()` prompt on add button

## Files
- `src/app/tasks/TasksView.tsx` - Main page
- `src/app/tasks/useTasksViewData.ts` - Data hook
- `src/app/tasks/TaskModal.tsx` - Add/edit modal
- `src/lib/hooks/useTasks.ts` - Tasks data hook
- `src/lib/hooks/useTaskLists.ts` - Lists hook
- `src/lib/integrations/tasks/microsoft-todo.ts` - MS provider
- `src/app/settings/sections/TaskIntegrationsSection.tsx` - Settings UI
