### 3. Chores System (Hybrid Model)

#### Internal Chores System (Primary)
**Why Internal is Better:**
- Touch-optimized for kids
- Parent approval workflow
- Allowance/points tracking
- Custom recurring schedules
- Gamification features

**Chore Structure:**
```typescript
interface Chore {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduleDays?: number[]; // [0,2,4] = Sun, Tue, Thu
  points?: number; // For allowance tracking
  requiresApproval: boolean;
  lastCompleted?: Date;
  completions: ChoreCompletion[];
  source: 'internal' | 'external';
  createdAt: Date;
}

interface ChoreCompletion {
  id: string;
  choreId: string;
  completedBy: string;
  completedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  points?: number;
  photoProof?: string; // Optional: kid takes photo of completed chore
}
```

#### Features
- **Recurring Schedules:** Daily, weekly, biweekly, monthly, custom interval (N days)
- **Assignments:** Assign to specific family members or leave unassigned (anyone can complete)
- **Points/Allowance:** Optional point system for allowance tracking
- **Parent Approval:** Child completions always require parent approval; parents self-approve
- **Photo Proof:** Kids can take photo of completed chore (optional)
- **Progress Tracking:** Weekly/monthly completion rates
- **Reminders:** Notification when chore is due
- **Chore Rotation:** Auto-rotate assignments weekly/monthly
- **Next Due Calculation:** After completion/approval, chore hides until next due date based on frequency

#### Permission Logic (Implemented)
- **Children can only complete their own assigned chores** - If a chore is assigned to Sophie, Emma cannot complete it (and vice versa). Unassigned chores can be completed by any family member.
- **Children cannot complete each other's tasks** - Same ownership rules apply to tasks.
- **Duplicate completion prevention** - If a chore is already pending parental approval, children see "This chore is already pending parental approval" instead of creating duplicate completions.
- **Parent approval workflow:**
  - When a child completes a chore, it enters "pending" state
  - Parents can approve via dedicated approve button OR by clicking "complete" on a pending chore (which auto-approves)
  - Only after approval does the chore's `nextDue` date update and the chore disappears until next due

#### Dedicated Chores Page
```
┌─ CHORES ───────────────────────────────────┐
│  Emma's Chores (5 points earned)       │
│  ☑️ Make bed (approved) ............. 1pt   │
│  ☑️ Feed dog (pending approval) .... 2pts  │
│  ⬜ Empty dishwasher ............... 2pts   │
│  ⬜ Homework (30 min) .............. 0pts   │
│                                            │
│  Sophie's Chores (3 points earned)           │
│  ☑️ Brush teeth (approved) ......... 0pts   │
│  ☑️ Put away toys (approved) ....... 1pt    │
│  ⬜ Set table ...................... 2pts   │
└────────────────────────────────────────────┘
```

#### CSV Import/Export
- Export chores list to CSV
- Import from CSV (for users syncing with other systems)
- Template CSV for easy creation

#### Future Integrations (Optional)
- OurHome (if API becomes available)
- Homey (if API available)
- ChoreMonster (if API available)

---
