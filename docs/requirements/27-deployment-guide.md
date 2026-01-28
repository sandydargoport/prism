## Easy Deployment Guide for Non-Coders

### Prerequisites Setup

#### 1. Install Docker Desktop
**What it is:** Software that runs the dashboard in a container (like a mini computer)

**Windows:**
1. Go to: https://www.docker.com/products/docker-desktop
2. Click "Download for Windows"
3. Run installer (requires restart)
4. Open Docker Desktop, accept terms
5. Wait for "Docker Desktop is running" message

**Mac:**
1. Go to: https://www.docker.com/products/docker-desktop
2. Click "Download for Mac"
3. Open .dmg file, drag Docker to Applications
4. Open Docker from Applications
5. Wait for "Docker Desktop is running" message

**Verify Installation:**
1. Open Terminal (Mac) or Command Prompt (Windows)
2. Type: `docker --version`
3. Should see: "Docker version 24.x.x"

---

#### 2. Get API Keys & Accounts

**Google Calendar** (Required for calendar sync)
1. Go to: https://console.cloud.google.com
2. Create new project: "Home Dashboard"
3. Enable "Google Calendar API"
4. Create credentials → OAuth 2.0 Client ID
5. Application type: "Web application"
6. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. Copy Client ID and Client Secret
8. Save for later

**Microsoft Account** (Required for To Do, OneDrive)
1. Go to: https://portal.azure.com
2. Register new application: "Home Dashboard"
3. Platform: "Web", Redirect URI: `http://localhost:3000/api/auth/microsoft/callback`
4. API Permissions: Add "Tasks.ReadWrite", "Files.Read"
5. Certificates & Secrets → New client secret
6. Copy Application (client) ID and client secret
7. Save for later

**OpenWeatherMap** (Required for weather)
1. Go to: https://openweathermap.org/api
2. Sign up for free account
3. API Keys → Copy your API key
4. Save for later

**Enphase Enlighten** (Optional, for solar monitoring)
1. Go to: https://developer-v4.enphase.com
2. Register for API access
3. Create application
4. Copy API key
5. Find your System ID in Enlighten app
6. Save for later

**Sonos** (Optional, for music control)
1. Go to: https://developer.sonos.com
2. Apply for developer access (may take 1-2 days)
3. Create integration
4. Copy Client ID and Client Secret
5. Authorized redirect URI: `http://localhost:3000/api/auth/sonos/callback`
6. Save for later

**Apple ID App-Specific Password** (Required for iCloud/iCal)
1. Go to: https://appleid.apple.com
2. Sign in
3. Security → App-Specific Passwords → Generate Password
4. Name it: "Home Dashboard"
5. Copy generated password (not your regular password)
6. Save for later

---

### Installation Steps (Copy & Paste)

#### Step 1: Download Dashboard
```bash
# Open Terminal (Mac) or Command Prompt (Windows)
# Copy and paste each line, press Enter after each

# Create folder for dashboard
mkdir Prism
cd Prism

# Download Prism code
# You'll get this link from the GitHub repository
git clone https://github.com/[username]/prism.git .
```

#### Step 2: Configure Settings
1. Find file named `.env.example`
2. Rename it to `.env` (remove ".example")
3. Open `.env` in Notepad (Windows) or TextEdit (Mac)
4. Fill in your API keys from above:

```bash
# Database (leave as-is)
DATABASE_URL=postgresql://prism:secure_password_here@db:5432/prism
DB_PASSWORD=secure_password_here  # Change this!

# App Settings (leave as-is)
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000

# Security (change these!)
SESSION_SECRET=generate_random_string_here_min_32_chars
PIN_ENCRYPTION_KEY=generate_another_random_string_32_chars

# Google Calendar (paste your values)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Apple iCloud (paste your values)
APPLE_ID=your-apple-id-email@icloud.com
APPLE_APP_PASSWORD=your-app-specific-password-here

# Microsoft (paste your values)
MICROSOFT_CLIENT_ID=your-microsoft-client-id-here
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret-here
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback

# Weather (paste your value)
OPENWEATHER_API_KEY=your-openweather-api-key-here
WEATHER_LOCATION=Springfield,IL,US  # Change to your city

# Solar (optional - leave blank if you don't have solar)
ENPHASE_API_KEY=your-enphase-api-key-or-leave-blank
ENPHASE_SYSTEM_ID=your-system-id-or-leave-blank

# Sonos (optional - leave blank if you don't have Sonos)
SONOS_CLIENT_ID=your-sonos-client-id-or-leave-blank
SONOS_CLIENT_SECRET=your-sonos-client-secret-or-leave-blank
SONOS_REDIRECT_URI=http://localhost:3000/api/auth/sonos/callback
```

5. Save file

**Generate Random Strings:**
- Go to: https://www.random.org/strings/
- Length: 32 characters
- Generate 2 strings (one for SESSION_SECRET, one for PIN_ENCRYPTION_KEY)
- Copy and paste into `.env`

#### Step 3: Configure Family Settings
1. Find file: `config/user-settings.json`
2. Open in Notepad/TextEdit
3. Change family member names and colors:

```json
{
  "family": {
    "name": "The Demo Family",  // Change to your family name
    "members": [
      {
        "id": "parent1",
        "name": "Alex",           // Change to parent 1 name
        "role": "parent",
        "color": "#3B82F6"        // Blue - change if desired
      },
      {
        "id": "parent2",
        "name": "Jordan",            // Change to parent 2 name
        "role": "parent",
        "color": "#EC4899"        // Pink - change if desired
      },
      {
        "id": "child1",
        "name": "Emma",       // Change to child 1 name
        "role": "child",
        "color": "#10B981"        // Green - change if desired
      },
      {
        "id": "child2",
        "name": "Sophie",           // Change to child 2 name
        "role": "child",
        "color": "#F59E0B"        // Orange - change if desired
      }
    ]
  }
}
```

4. Save file

#### Step 4: Start Dashboard
```bash
# In Terminal/Command Prompt, run:
docker-compose up -d

# Wait 1-2 minutes for everything to start
# You'll see: "Container prism started"
```

#### Step 5: Open Dashboard
1. Open web browser (Chrome recommended)
2. Go to: http://localhost:3000
3. Follow setup wizard

---

### Setup Wizard (First Time)

When you first open the dashboard, you'll see a setup wizard:

**Screen 1: Welcome**
- Click "Get Started"

**Screen 2: Create Parent Accounts**
- Enter PIN for each parent (4-6 digits)
- Confirm PINs
- Click "Next"

**Screen 3: Connect Calendars**
- Click "Connect Google Calendar"
- Sign in with Google
- Allow permissions
- Select which calendars to sync
- Click "Connect Apple Calendar" (if using)
- Enter Apple ID and app-specific password
- Select calendars
- Click "Next"

**Screen 4: Configure Integrations**
- Toggle on/off optional integrations:
  - Microsoft To Do
  - iCloud Photos
  - OneDrive
  - Solar Monitoring
  - Music Control
- Click "Connect" for each enabled integration
- Follow prompts to authenticate
- Click "Next"

**Screen 5: Choose Layout**
- Select a template:
  - Family Central (recommended)
  - Task Master
  - Photo Frame
  - Command Center
  - Clean & Simple
- Click "Next"

**Screen 6: Done!**
- Click "Go to Dashboard"
- You're ready!
