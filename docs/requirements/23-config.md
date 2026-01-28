## Configuration System

### Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/family_dashboard
REDIS_URL=redis://localhost:6379

# App Settings
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000

# Authentication
SESSION_SECRET=your-super-secret-session-key
PIN_ENCRYPTION_KEY=your-pin-encryption-key

# Google Calendar
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Apple iCloud
APPLE_ID=your-apple-id
APPLE_APP_PASSWORD=your-app-specific-password

# Microsoft (To Do, OneDrive)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback

# Weather
OPENWEATHER_API_KEY=your-openweather-api-key
WEATHER_LOCATION=Springfield,IL,US

# Enphase Solar
ENPHASE_API_KEY=your-enphase-api-key
ENPHASE_SYSTEM_ID=your-system-id

# Sonos
SONOS_CLIENT_ID=your-sonos-client-id
SONOS_CLIENT_SECRET=your-sonos-client-secret
SONOS_REDIRECT_URI=http://localhost:3000/api/auth/sonos/callback

# Optional: Future integrations
# HOMEBRIDGE_URL=http://homebridge-host:port
# HOMEBRIDGE_PIN=xxx-xx-xxx
# FIRSTVIEW_USERNAME=
# FIRSTVIEW_PASSWORD=
```

### User Configuration (config/user-settings.json)

```json
{
  "family": {
    "name": "The Demo Family",
    "members": [
      {
        "id": "alex",
        "name": "Alex",
        "role": "parent",
        "color": "#3B82F6",
        "avatar": "/avatars/alex.jpg"
      },
      {
        "id": "jordan",
        "name": "Jordan",
        "role": "parent",
        "color": "#EC4899",
        "avatar": "/avatars/jordan.jpg"
      },
      {
        "id": "emma",
        "name": "Emma",
        "role": "child",
        "color": "#10B981",
        "avatar": "/avatars/emma.jpg"
      },
      {
        "id": "sophie",
        "name": "Sophie",
        "role": "child",
        "color": "#F59E0B",
        "avatar": "/avatars/sophie.jpg"
      }
    ]
  },
  "display": {
    "defaultView": "twoWeek",
    "theme": "auto",
    "seasonalThemes": true,
    "idleTimeout": 120,
    "idleMode": "photos",
    "darkModeSchedule": {
      "enabled": true,
      "mode": "sunset",
      "customTimes": {
        "darkModeStart": "19:00",
        "lightModeStart": "07:00"
      }
    }
  },
  "integrations": {
    "googleCalendar": true,
    "appleCalendar": true,
    "microsoftToDo": true,
    "appleNotes": false,
    "icloudPhotos": true,
    "onedrive": true,
    "enphase": true,
    "sonos": true,
    "homebridge": false
  },
  "notifications": {
    "eventReminders": true,
    "choreReminders": true,
    "maintenanceReminders": true,
    "weatherAlerts": true,
    "soundEnabled": false
  },
  "privacy": {
    "showLocationMap": true,
    "locationHistoryDays": 7,
    "photoFaceBlur": false,
    "hideCalendarInAwayMode": true
  }
}
```
