### 7. Weather Widget

#### Data Source
- **Primary:** OpenWeatherMap API (free tier: 1,000 calls/day)
- **Backup:** Weather.gov API (free, US only)

#### Display Information
- **Current Conditions:**
  - Temperature (°F or °C)
  - "Feels like" temperature
  - Conditions (sunny, cloudy, rainy, etc.)
  - Humidity %
  - Wind speed and direction

- **4-5 Day Forecast:**
  - High/Low temperatures
  - Precipitation chance
  - Weather icon
  - Brief description

#### Widget Design
```
┌─ WEATHER ──────────────────────┐
│  Currently in Springfield, IL   │
│  ☀️ 72°F (Feels like 70°F)     │
│  Sunny • Humidity 45%          │
│                                │
│  Tue  Wed  Thu  Fri  Sat       │
│  ☀️   ⛅   🌧️   ☁️   ☀️        │
│  75°  68°  62°  65°  70°       │
│  58°  52°  48°  50°  55°       │
└────────────────────────────────┘
```

#### Configuration
- **Location:** Auto-detect or manual entry (city, zip code, coordinates)
- **Units:** Fahrenheit or Celsius
- **Update Frequency:** Every 30-60 minutes
- **Alerts:** Severe weather notifications

---

### 8. Clock Widget

#### Display Elements
- **Time:** Large, readable format (12hr or 24hr)
- **Date:** Day of week, month, day, year
- **Optional:** Seconds display (configurable)
- **Optional:** Sunrise/sunset times

#### Clock Formats
```
┌─ Standard ─────────────────┐    ┌─ Detailed ─────────────────┐
│  2:34 PM                   │    │  Tuesday, January 20       │
│  Tuesday, Jan 20           │    │  2:34:15 PM                │
└────────────────────────────┘    │  Sunrise: 7:12 AM          │
                                  │  Sunset:  5:48 PM          │
                                  └────────────────────────────┘
```

#### Features
- **Time Zone:** Auto-detect or manual selection
- **DST Awareness:** Automatically adjust for daylight saving
- **World Clocks:** Optional additional time zones (for travel/family)
- **Countdown Timers:** Optional countdown to events ("2 days until vacation")
