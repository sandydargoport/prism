### 10. Family Messaging Board

#### Purpose
Leave quick messages for family members (e.g., "Dad at gym, back at 9am")

#### Message Structure
```typescript
interface FamilyMessage {
  id: string;
  message: string;
  author: string;
  color: string; // Author's color
  createdAt: Date;
  expiresAt?: Date; // Auto-delete after date
  pinned: boolean;
  important: boolean; // Red flag icon
}
```

#### Features
- **Quick Post:** Tap "+" to add message
- **Voice Input:** Speech-to-text for quick messages
- **Pin Important:** Pin critical messages to top
- **Auto-Expire:** Messages auto-delete after X hours/days
- **Color Coded:** Each family member's messages in their color
- **Emojis:** Quick emoji picker
- **Templates:** Common messages ("At gym", "Running late", "Dinner ready")

#### Message Board Display
```
┌─ FAMILY MESSAGES ──────────────────────┐
│ 📌 Emma: Swim practice canceled    │
│    (pinned by Jordan • 2 hours ago)       │
│                                        │
│ Alex: At gym, back at 9am 💪           │
│    (8:15 AM)                           │
│                                        │
│ Jordan: Picked up dry cleaning ✓          │
│    (Yesterday 4:30 PM)                 │
│                                        │
│ Sophie: Can I have a playdate Friday?    │
│    (Yesterday 3:00 PM)                 │
└────────────────────────────────────────┘
```

#### Message Management
- **Parents:** Can delete any message
- **Children:** Can only delete their own messages
- **Auto-Delete:** Messages older than 7 days (configurable)
- **Archive:** Option to archive old messages
