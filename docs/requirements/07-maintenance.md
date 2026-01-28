### 6. Maintenance Reminders (Internal)

#### Purpose
Track recurring home, car, and appliance maintenance

#### Reminder Structure
```typescript
interface MaintenanceReminder {
  id: string;
  title: string;
  category: 'car' | 'home' | 'appliance' | 'yard' | 'other';
  description?: string;
  schedule: 'monthly' | 'quarterly' | 'annually' | 'custom';
  customInterval?: number; // Days
  lastCompleted?: Date;
  nextDue: Date;
  assignedTo?: string;
  completed: boolean;
  completions: MaintenanceCompletion[];
  notes?: string;
  cost?: number; // Optional cost tracking
  vendor?: string; // Who did the work
  createdAt: Date;
}

interface MaintenanceCompletion {
  id: string;
  completedDate: Date;
  completedBy: string;
  cost?: number;
  vendor?: string;
  notes?: string;
}
```

#### Examples
- **Car:** Oil change every 3 months, tire rotation every 6 months
- **Home:** Replace HVAC filter monthly, clean gutters quarterly
- **Appliances:** Clean dryer vent annually, replace water filter quarterly
- **Yard:** Fertilize lawn quarterly, winterize sprinklers

#### Display
- **Low-Priority Widget:** Collapsible section showing upcoming items
- **Notifications:** Reminder 1 week before due, day of due
- **Dedicated Page:** Full maintenance log with history
- **Calendar Integration:** Optionally show on calendar

#### Features
- **History Tracking:** See when last completed and by whom
- **Cost Tracking:** Optional cost field for budgeting
- **Vendor Notes:** Track who did the work
- **Export:** CSV export for record keeping
