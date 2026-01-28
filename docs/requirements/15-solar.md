### 16. Solar Panel Monitoring

#### Data Source
- **Enphase Enlighten API** (official API)
- **Authentication:** OAuth 2.0 or API key
- **Rate Limits:** 10,000 calls/day (free tier)

#### Metrics Displayed
- **Current Production:** Real-time watts (W) or kilowatts (kW)
- **Today's Production:** Total kWh produced today
- **This Week:** Total kWh for current week
- **This Month:** Total kWh for current month
- **All-Time:** Lifetime production (optional)
- **System Status:** Online, offline, or issues
- **Panel Performance:** Individual panel output (if available)

#### Time Periods
- **Real-time:** Updated every 5-15 minutes
- **Hourly:** Production by hour (today)
- **Daily:** Production by day (last 7 days, last 30 days)
- **Monthly:** Production by month (last 12 months)
- **Yearly:** Annual production comparison

#### Solar Widget Display
```
┌─ SOLAR PRODUCTION ─────────────┐
│  🔆 Currently Producing        │
│     3.2 kW                     │
│                                │
│  Today: 18.5 kWh ▲ 12%        │
│  This Week: 142 kWh           │
│  This Month: 580 kWh          │
│  YTD: 4,250 kWh ▲ 8%          │
│                                │
│  [View Details] [View Graph]   │
└────────────────────────────────┘
```

#### Solar Details Page
- **Production Graph:** Line chart showing production over time
- **Weather Correlation:** Overlay weather on production graph
- **Efficiency:** Compare to expected production
- **Savings:** Calculate $ saved based on utility rate
- **Environmental Impact:**
  - CO2 offset (yearly and YTD)
  - Trees equivalent
  - Miles driven equivalent
- **YTD Metrics:**
  - Total kWh produced year-to-date
  - Comparison to last year (if available)
  - Monthly breakdown graph
  - Best production day this year

#### Configuration
- **System Size:** Total panel capacity (kW)
- **Utility Rate:** $/kWh for savings calculation
- **Expected Production:** Monthly averages for comparison
- **Alerts:** Notification if production drops unexpectedly

---