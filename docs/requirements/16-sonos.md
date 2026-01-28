### 17. Sonos/Music Control

#### Data Source
- **Sonos API** (official Sonos Control API)
- **Authentication:** OAuth 2.0
- **Alternative:** Local network discovery (node-sonos library)

#### Features
- **Now Playing:** Show what's playing on each Sonos speaker/group
- **Playback Controls:** Play, pause, skip, volume
- **Multi-Room:** Control multiple speakers/rooms
- **Grouping:** View and modify speaker groups
- **Source Info:** Album art, artist, song title, source (Spotify, Apple Music, etc.)

#### Music Widget Display
```
┌─ NOW PLAYING ──────────────────────┐
│  Living Room                       │
│  ♫ "Bohemian Rhapsody" - Queen    │
│  🎵 Greatest Hits                  │
│  [⏮] [⏸] [⏭]  🔊 ━━━━●─── 65%   │
│                                    │
│  Kitchen (Grouped with Living)     │
│  ♫ Same as Living Room            │
│  🔊 ━━━━━●─ 72%                   │
│                                    │
│  Bedroom                           │
│  🔇 Not Playing                    │
└────────────────────────────────────┘
```

#### Music Control Page (Dedicated)
- **Room Selection:** Tap room to expand controls
- **Playback Control:** Play, pause, skip, previous
- **Volume Control:** Per-room volume sliders
- **Speaker Grouping:** Group/ungroup speakers
- **Favorites:** Quick access to favorite playlists/stations
- **Browse:** Browse music sources (if API supports)

#### Integration Notes
- **Apple Music Control:** Via Sonos (if playing through Sonos)
- **Direct Apple Music API:** May require separate integration (future)
- **Spotify:** Also controlled via Sonos
- **Local Music:** If stored on Sonos library
