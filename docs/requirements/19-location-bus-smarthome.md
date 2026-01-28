### 18. Family Location Map (Future)

#### Data Source
- **Apple Find My** (no official API - requires iCloud auth simulation)
- **Alternatives:** Life360 API, Google Location Sharing

#### Technical Challenges
- **Unofficial API:** Apple doesn't provide Find My API
- **Solutions:**
  - Use pyicloud library (Python)
  - Reverse engineer iCloud authentication
  - OR use Life360 as alternative (has official API)

#### Map Display
- **Map View:** Interactive map showing family member locations
- **List View:** List of locations with addresses
- **Location History:** Timeline of movements (optional, privacy-sensitive)
- **Geofencing:** Alerts when arriving/leaving locations (home, school, work)

#### Privacy Controls
- **Opt-in:** Family members must consent
- **Limited History:** Only store recent locations
- **Dashboard Only:** Not accessible remotely by default
- **Kids:** Show on dashboard but don't allow kids to see parent locations (configurable)

#### Architecture Support
```typescript
interface LocationIntegration {
  authenticate(): Promise<void>;
  getLocations(): Promise<FamilyLocation[]>;
  setGeofence(location: Location, radius: number): Promise<void>;
}

interface FamilyLocation {
  memberId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  timestamp: Date;
  batteryLevel?: number;
}
```

---

### 19. Bus Tracking (Future)

#### Data Source
- **FirstView App** (no API - requires reverse engineering)

#### Technical Approach Options
1. **MITM Proxy:** Intercept app traffic to find API endpoints
2. **App Decompilation:** Decompile APK/IPA to find API calls
3. **Notification Parsing:** Parse push notifications (limited data)
4. **Web Scraping:** If FirstView has web portal (unlikely)

#### Implementation Strategy
1. **Research Phase:** Determine if FirstView has undocumented API
2. **Reverse Engineering:** Use tools like Charles Proxy, Burp Suite
3. **API Simulation:** Build wrapper around discovered endpoints
4. **Fallback:** If impossible, allow manual "bus is arriving" button

#### Bus Widget Display
```
┌─ EMMA'S BUS ───────────────┐
│  Bus #42 - Route to School     │
│  🚌 2.3 miles away             │
│  ⏱️ Arriving in 8 minutes      │
│                                │
│  [View on Map] [Notify Me]     │
└────────────────────────────────┘
```

#### Features
- **ETA Calculation:** Based on bus location and speed
- **Proximity Alerts:** Notification when bus is 5-10 min away
- **Route Display:** Show bus route on map
- **Delay Notifications:** Alert if bus is running late
- **Calendar Integration:** Show before school start times

#### Architecture Support
```typescript
interface BusTrackingIntegration {
  authenticate(credentials: Credentials): Promise<void>;
  getBusLocation(busId: string): Promise<BusLocation>;
  subscribeToUpdates(busId: string, callback: Function): void;
}

interface BusLocation {
  busId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  eta: number; // Minutes
  timestamp: Date;
}
```

---

### 20. Indoor Environment / Smart Home (Future)

#### Data Sources
- **Homebridge** (primary - connects to HomeKit devices)
- **Home Assistant** (alternative integration)
- **Direct Device APIs:** Ecobee, Nest, etc.

#### Homebridge Integration
- **Protocol:** HAP (HomeKit Accessory Protocol)
- **Connection:** WebSocket or HTTP API
- **Authentication:** Homebridge PIN/credentials

#### Devices to Control/Monitor
**Supported via Homebridge:**
- Lutron switches/dimmers
- TP-Link Kasa plugs/switches
- Wemo switches
- Temperature sensors
- Humidity sensors
- Motion sensors
- Door/window sensors

#### Smart Home Widget
```
┌─ SMART HOME ───────────────────┐
│  🏠 72°F  💧 45%               │
│                                │
│  Living Room                   │
│  💡 Ceiling Light    [ON] 75%  │
│  💡 Table Lamp       [OFF]     │
│                                │
│  Kitchen                       │
│  🔌 Coffee Maker     [OFF]     │
│  💡 Under Cabinet    [ON]      │
│                                │
│  [View All Rooms]              │
└────────────────────────────────┘
```

#### Smart Home Control Page
- **Room-based Organization:** Group devices by room
- **Device Controls:**
  - Lights: On/off, brightness slider
  - Switches: On/off toggle
  - Outlets: On/off toggle
  - Sensors: Read-only status
- **Scenes:** Trigger HomeKit scenes ("Good Morning", "Movie Time")
- **Automations:** View active automations (read-only)

#### Temperature/Humidity Monitoring
- **Multiple Sensors:** Show readings from different rooms
- **Trend Graphs:** Historical data
- **Alerts:** Notification if temp/humidity outside range
- **Integration:** Display on main dashboard widget

#### Architecture Support
```typescript
interface SmartHomeIntegration {
  connect(): Promise<void>;
  getDevices(): Promise<Device[]>;
  getAccessories(room?: string): Promise<Accessory[]>;
  controlDevice(deviceId: string, command: Command): Promise<void>;
  subscribeToUpdates(callback: Function): void;
}

interface Accessory {
  id: string;
  name: string;
  type: 'light' | 'switch' | 'outlet' | 'sensor';
  room: string;
  state: boolean | number;
  brightness?: number; // For lights
  temperature?: number; // For sensors
  humidity?: number; // For sensors
}
```