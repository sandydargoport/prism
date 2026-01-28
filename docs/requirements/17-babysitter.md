### 21. Babysitter Info Screen (V1.0)

#### Purpose
Quick reference screen for babysitters with essential family information

#### Information Displayed

**Emergency Contacts:**
- Parents' cell phones (click to call on mobile)
- Backup contacts (grandparents, neighbors)
- Pediatrician name and number
- Nearest hospital/urgent care
- Poison control
- Address for emergency services

**House Information:**
- WiFi network and password
- WiFi QR code (scan to connect)
- Alarm code (if applicable)
- Thermostat instructions
- Emergency shut-offs (water, gas, electric)

**Kids' Information:**
- Bedtimes (by child)
- Dietary restrictions/allergies
- Medications and dosages
- Favorite snacks/comfort items
- Bedtime routines
- Screen time rules

**House Rules:**
- TV/tablet time limits
- Approved snacks
- Approved activities
- Outdoor play rules
- Visitor policies

**Important Locations:**
- First aid kit
- Flashlights
- Fire extinguisher
- Snacks
- Kids' rooms
- Bathroom supplies

**Pet Care (if applicable):**
- Feeding times and amounts
- Walking schedule
- Behavioral notes
- Vet contact

#### Babysitter Screen Design
```
┌─ BABYSITTER INFO ──────────────────────────┐
│  🚨 EMERGENCY: 911                         │
│                                            │
│  📱 Parents                                │
│  Alex: (555) 555-0101 [Call]              │
│  Jordan: (555) 555-0102 [Call]               │
│  We'll be back by: 10:00 PM               │
│                                            │
│  🏥 Pediatrician                           │
│  Dr. Smith: (555) 555-0200                │
│                                            │
│  📶 WiFi                                   │
│  Network: SmithFamily5G                   │
│  Password: ••••••••• [Show] [QR Code]    │
│                                            │
│  😴 Bedtimes                               │
│  Emma: 8:30 PM                        │
│  Sophie: 8:00 PM                            │
│                                            │
│  [View Full Info] [Emergency Details]     │
└────────────────────────────────────────────┘
```

#### Access Control
- **Quick Access:** Dedicated button on main screen or "Babysitter Mode"
- **No Authentication Required:** Should be accessible without PIN
- **Optional PIN:** Parents can optionally require PIN for sensitive info
- **Printable:** Export to PDF for paper backup

#### Babysitter Mode
- **Simplified View:** Only shows relevant widgets
- **Hides:** Family messages, financial info, location tracking
- **Shows:** Clock, weather, babysitter info, emergency contacts
- **Easy Exit:** Parents can disable with PIN
