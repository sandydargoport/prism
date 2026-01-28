### 2. Task Management (Hybrid Model)

#### Internal Task System (Always Available)
**Features:**
- Create, edit, delete tasks
- Assign to family members
- Due dates and priorities (High, Medium, Low)
- Categories/tags (Work, School, Home, Personal)
- Subtasks/checklists
- Notes/descriptions
- Mark complete/incomplete
- Archive completed tasks

**Task Structure:**
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // Family member ID
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  category: string;
  completed: boolean;
  completedDate?: Date;
  subtasks?: SubTask[];
  source: 'internal' | 'microsoft-todo' | 'apple-reminders';
  sourceId?: string; // External ID if synced
  lastSynced?: Date;
  createdBy: string;
  createdAt: Date;
}
```

#### Microsoft To Do Integration (Optional)
- **Authentication:** Microsoft Graph API OAuth 2.0
- **Sync Direction:** Bi-directional (read & write)
- **Sync Interval:** 10-15 minutes
- **List Mapping:** Map To Do lists to family members
- **Conflict Resolution:** Dashboard changes take precedence for internal tasks

#### Future Integrations (Architecture Ready)
- Apple Reminders (CalDAV or iCloud API)
- Todoist (REST API)
- Google Tasks (Google Tasks API)
- TickTick
- Any.do

#### Task Display
- **Widget:** "Today's Tasks" on main dashboard
- **Dedicated Page:** Full task list with filters
- **Filters:** By person, priority, due date, category
- **Sort:** Due date, priority, alphabetical
- **Color Coding:** By assigned person (matches calendar colors)
- **Source Indicator:** Small icon showing task source
