# Mobile PWA

## Overview
Prism is a Progressive Web App (PWA) optimized for mobile devices with installable app support.

## Installation

### iOS (Safari)
1. Open Prism in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. App opens without browser chrome

### Android (Chrome)
1. Open Prism in Chrome
2. Tap menu (three dots)
3. Select "Add to Home Screen" or "Install"
4. App opens in standalone mode

## Web Manifest

### Configuration (`/manifest.json`)
- App name: "Prism"
- Theme color and background
- Display: standalone
- Icons: 192x192 and 512x512

### Shortcuts
Quick access from app icon long-press:
- Shopping
- Tasks
- Messages

## Service Worker

### Caching Strategy (`/sw.js`)
- Static assets cached on install
- Network-first for API routes
- 5-minute cache for API responses

### Offline Support
- Cached pages available offline
- API requests queue when offline
- Sync when connection restored

## Navigation

### Mobile (Small Screens)
`MobileNav` component:
- Fixed bottom bar
- Primary: Shopping, Tasks, Meals, Messages
- "More" expands to: Goals, Settings
- Person icon for login/logout

### Portrait (Tablets)
`PortraitNav` component:
- Fixed bottom bar with drawer
- Primary: Dashboard, Calendar, Tasks, Chores, Shopping
- Drawer expands for: Goals, Meals, Recipes, Messages, Photos, Settings
- User info and theme toggle in drawer

### Landscape (Desktop/Tablets)
`SideNav` component:
- Collapsible left sidebar
- Full navigation with icons and labels
- Logo in header

## Responsive Behavior

### View Restrictions
- Calendar: Forced to day view on mobile
- View switcher hidden on mobile

### Hidden Elements
- SideNav hidden on mobile
- Home button hidden in subpage headers
- Calendar, Recipes, Photos, Settings removed from mobile nav

### Safe Areas
- Bottom padding for iOS home indicator
- Safe area insets respected

## Responsive Font Sizes

### Device Detection
Uses `pointer: fine` vs `pointer: coarse` media queries:

```css
/* Phones (default) */
html { font-size: 16px; }

/* Desktop (mouse) */
@media (pointer: fine) { font-size: 18px; }

/* Tablets (touch, 768px+) */
@media (min-width: 768px) and (pointer: coarse) { font-size: 20px; }

/* Large tablets (1024px+) */
@media (min-width: 1024px) and (pointer: coarse) { font-size: 22px; }

/* Kiosks (1400px+) */
@media (min-width: 1400px) and (pointer: coarse) { font-size: 24px; }
```

## Touch Gestures

### Swipe Navigation
- Calendar views: Swipe left/right to navigate
- 50px threshold required
- Ignores vertical swipes (for scrolling)
- Ignores slow swipes (>500ms)

### Tap Interactions
- Shopping items: Tap to strikethrough
- Recipe ingredients: Tap to strikethrough
- No long-press required for primary actions

## Orientation Detection

### useOrientation Hook
- Detects landscape vs portrait
- Listens to resize and orientationchange events
- Used for layout switching

### Layout Switching
- `AppShell` selects navigation based on:
  - Screen size (mobile vs larger)
  - Orientation (portrait vs landscape)

## Files
- `public/manifest.json` - PWA manifest
- `public/sw.js` - Service worker
- `public/icons/icon-192.png` - Small icon
- `public/icons/icon-512.png` - Large icon
- `src/components/layout/MobileNav.tsx` - Mobile navigation
- `src/components/layout/PortraitNav.tsx` - Portrait navigation
- `src/components/layout/AppShell.tsx` - Layout orchestration
- `src/lib/hooks/useOrientation.ts` - Orientation detection
- `src/lib/hooks/useIsMobile.ts` - Mobile detection
- `src/lib/hooks/useSwipeNavigation.ts` - Swipe gestures
- `src/styles/globals.css` - Responsive font sizes
