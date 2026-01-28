## Project Structure

```
family-dashboard/
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
│
├── docs/
│   ├── setup-guide.md
│   ├── api-integration.md
│   ├── customization-guide.md
│   ├── troubleshooting.md
│   └── architecture.md
│
├── public/
│   ├── fonts/
│   ├── images/
│   │   └── themes/
│   │       ├── january/
│   │       ├── february/
│   │       └── ...
│   └── icons/
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Dashboard home
│   │   ├── api/                  # API routes
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   ├── calendar/
│   │   │   │   ├── events/route.ts
│   │   │   │   ├── sync/route.ts
│   │   │   │   └── sources/route.ts
│   │   │   ├── tasks/route.ts
│   │   │   ├── chores/route.ts
│   │   │   ├── shopping/route.ts
│   │   │   ├── meals/route.ts
│   │   │   ├── maintenance/route.ts
│   │   │   ├── messages/route.ts
│   │   │   ├── weather/route.ts
│   │   │   ├── photos/route.ts
│   │   │   ├── solar/route.ts
│   │   │   ├── music/route.ts
│   │   │   └── settings/route.ts
│   │   ├── calendar/
│   │   │   └── page.tsx          # Calendar full page
│   │   ├── tasks/
│   │   │   └── page.tsx          # Tasks full page
│   │   ├── chores/
│   │   │   └── page.tsx          # Chores full page
│   │   ├── shopping/
│   │   │   └── page.tsx          # Shopping list page
│   │   ├── meals/
│   │   │   └── page.tsx          # Meal planning page
│   │   ├── map/
│   │   │   └── page.tsx          # Family location map
│   │   ├── smarthome/
│   │   │   └── page.tsx          # Smart home controls
│   │   ├── settings/
│   │   │   └── page.tsx          # Settings page
│   │   └── away-mode/
│   │       └── page.tsx          # Away mode screen
│   │
│   ├── components/
│   │   ├── widgets/              # Dashboard widgets
│   │   │   ├── CalendarWidget.tsx
│   │   │   ├── TasksWidget.tsx
│   │   │   ├── ChoresWidget.tsx
│   │   │   ├── WeatherWidget.tsx
│   │   │   ├── ClockWidget.tsx
│   │   │   ├── PhotoWidget.tsx
│   │   │   ├── MessagesWidget.tsx
│   │   │   ├── ShoppingWidget.tsx
│   │   │   ├── MealsWidget.tsx
│   │   │   ├── BirthdaysWidget.tsx
│   │   │   ├── SolarWidget.tsx
│   │   │   ├── MusicWidget.tsx
│   │   │   └── WidgetContainer.tsx
│   │   ├── calendar/             # Calendar components
│   │   │   ├── DayView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── TwoWeekView.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventDialog.tsx
│   │   │   └── CalendarToolbar.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   └── TaskDialog.tsx
│   │   ├── chores/
│   │   │   ├── ChoreList.tsx
│   │   │   ├── ChoreCard.tsx
│   │   │   └── ChoreCompletionDialog.tsx
│   │   ├── shopping/
│   │   │   ├── ShoppingList.tsx
│   │   │   ├── ShoppingItem.tsx
│   │   │   └── CategorySection.tsx
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── GridLayout.tsx
│   │   │   ├── LayoutEditor.tsx
│   │   │   └── WidgetPicker.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── PinPad.tsx
│   │   ├── ui/                   # Reusable UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── switch.tsx
│   │   │   └── ...
│   │   └── themes/
│   │       ├── ThemeProvider.tsx
│   │       └── SeasonalTheme.tsx
│   │
│   ├── lib/                      # Utilities and helpers
│   │   ├── integrations/         # Third-party API integrations
│   │   │   ├── google-calendar.ts
│   │   │   ├── apple-calendar.ts
│   │   │   ├── microsoft-todo.ts
│   │   │   ├── icloud-photos.ts
│   │   │   ├── onedrive.ts
│   │   │   ├── enphase.ts
│   │   │   ├── sonos.ts
│   │   │   ├── weather.ts
│   │   │   └── base-integration.ts
│   │   ├── db/                   # Database utilities
│   │   │   ├── client.ts         # PostgreSQL client
│   │   │   ├── migrations/       # DB migrations
│   │   │   └── seed.ts           # Seed data
│   │   ├── auth/
│   │   │   ├── session.ts        # Session management
│   │   │   └── permissions.ts    # Permission checks
│   │   ├── utils/
│   │   │   ├── date.ts           # Date formatting/parsing
│   │   │   ├── colors.ts         # Color utilities
│   │   │   ├── validation.ts     # Input validation
│   │   │   └── encryption.ts     # Credential encryption
│   │   └── constants.ts          # App constants
│   │
│   ├── hooks/                    # React hooks
│   │   ├── useCalendar.ts
│   │   ├── useTasks.ts
│   │   ├── useChores.ts
│   │   ├── useWeather.ts
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   └── useIdleDetection.ts
│   │
│   ├── types/                    # TypeScript types
│   │   ├── calendar.ts
│   │   ├── tasks.ts
│   │   ├── chores.ts
│   │   ├── shopping.ts
│   │   ├── user.ts
│   │   ├── widget.ts
│   │   └── integration.ts
│   │
│   ├── styles/                   # Global styles
│   │   ├── globals.css
│   │   └── themes/
│   │       ├── light.css
│   │       ├── dark.css
│   │       └── seasonal/
│   │           ├── january.css
│   │           ├── february.css
│   │           └── ...
│   │
│   └── middleware.ts             # Next.js middleware (auth, etc.)
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```
