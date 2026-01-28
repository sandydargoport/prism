### 15. Customizable Layouts

#### Pre-built Templates

**1. Family Central** (Default)
- Large calendar (center)
- Tasks (right sidebar)
- Weather + Clock (top)
- Messages (bottom)
- Photos (bottom right)

**2. Task Master**
- Large tasks/chores (center)
- Small calendar (left sidebar)
- Weather + Clock (top)
- Shopping list (right)

**3. Photo Frame**
- Large photo slideshow (center, 70% of screen)
- Minimal info strip (bottom 30%): Clock, Weather, Today's events

**4. Command Center**
- Grid layout with all widgets visible
- Smaller widgets (2x3 or 3x3 grid)
- Calendar, Tasks, Chores, Weather, Photos, Messages all shown

**5. Clean & Simple**
- Large clock (center)
- Weather (top right)
- Today's agenda (bottom)
- Minimal widgets, lots of whitespace

#### Widget System
```typescript
interface Widget {
  id: string;
  type: 'calendar' | 'tasks' | 'chores' | 'weather' | 'clock' | 'photos' | 'messages' | 'shopping' | 'meals' | 'birthdays' | 'solar' | 'music';
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  settings: WidgetSettings;
}

interface WidgetSettings {
  refreshInterval?: number;
  dataSource?: string;
  customColor?: string;
  // Widget-specific settings
}
```

#### Drag & Drop Customization
- **Parent Mode:** Enter edit mode to customize layout
- **Drag Widgets:** Click and drag to reposition
- **Resize:** Drag corners to resize widgets
- **Add/Remove:** Toggle widget visibility
- **Grid Snap:** Widgets snap to grid for clean alignment
- **Save Layout:** Save custom layouts with names
- **Per-Display:** Different layouts for different displays
- **Reset:** Return to default template

#### Layout Editor
```
┌─ Layout Editor (Parent Mode) ──────────────┐
│  [Save] [Cancel] [Reset to Default]        │
│  ┌──────────┬──────────┬──────────┐        │
│  │ Calendar │ Weather  │  Tasks   │ ← Drag │
│  │ (Large)  │ (Small)  │ (Medium) │        │
│  ├──────────┴──────────┼──────────┤        │
│  │ Photos (Medium)     │ Messages │        │
│  │                     │ (Small)  │        │
│  └─────────────────────┴──────────┘        │
│                                            │
│  Available Widgets:                        │
│  [+Clock] [+Chores] [+Shopping] [+Meals]  │
└────────────────────────────────────────────┘
```
