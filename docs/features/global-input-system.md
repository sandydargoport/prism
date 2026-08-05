# Global Input System: Implementation Spec

## Prism v1.3 | Date: 2026-04-02

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [GlobalInputProvider](#2-globalinputprovider)
3. [Virtual On-Screen Keyboard](#3-virtual-on-screen-keyboard)
4. [Voice-to-Text](#4-voice-to-text)
5. [Barcode Scanner](#5-barcode-scanner)
6. [Floating Keyboard Toggle Button](#6-floating-keyboard-toggle-button)
7. [Scroll-into-View](#7-scroll-into-view)
8. [Mobile Exclusion](#8-mobile-exclusion)
9. [Physical Keyboard Auto-Dismiss](#9-physical-keyboard-auto-dismiss)
10. [Settings](#10-settings)
11. [File Manifest](#11-file-manifest)
12. [Open Questions / Deferred](#12-open-questions-deferred)

---

## 1. Architecture Overview

```
src/app/layout.tsx (Server Component)
  └── <Providers> (client boundary: ThemeProvider, FamilyProvider, AuthProvider)
        └── <GlobalInputProvider>          ← NEW: wraps all pages once
              ├── <VirtualKeyboard />      ← NEW: portals to document.body
              ├── <KeyboardToggleButton /> ← NEW: portals to document.body
              └── {children}              ← all pages via AppShell

GlobalInputProvider (Context + Logic)
  ├── activeInputRef            → currently focused input element
  ├── lastPointerType           → "touch" | "mouse" | "keyboard"
  ├── keyboardVisible           → boolean
  ├── isListening               → boolean (voice)
  ├── isSuppressedForScan       → boolean (barcode in flight)
  ├── isMobile                  → boolean (never show keyboard)
  │
  ├── event listeners (document-level)
  │     ├── pointerdown         → set lastPointerType
  │     ├── focusin             → detect new active input
  │     ├── focusout            → clear active input, hide toggle btn
  │     └── keydown             → auto-dismiss keyboard; feed barcode buffer
  │
  ├── injectText(text)          → shared React-safe value injection
  ├── dispatchScan(barcode)     → barcode POST + result handling
  └── useGlobalInput() hook     → exposes context to consumers

VirtualKeyboard (Component)
  └── uses simple-keyboard npm package
  └── calls injectText() on key press

KeyboardToggleButton (Component)
  └── reads keyboardVisible + activeInput from context
  └── calls setKeyboardVisible(true) on tap

useSpeechRecognition (Hook)
  └── wraps webkitSpeechRecognition
  └── appends final results via injectText()
```

**Why `GlobalInputProvider` mounts inside `Providers` (not inside `AppShell`):**
`AppShell` can be used with `hideNav` for the login page, and login PIN inputs must NOT trigger the virtual keyboard. Mounting inside `Providers` keeps the provider tree clean and avoids per-page suppression props.

**Event delegation pattern:**
All listeners attached once to `document` using `focusin`/`focusout` which bubble. Consistent with how `useAutoHideUI` and `useIdleDetection` work in the existing codebase.

---

## 2. GlobalInputProvider

### File: `src/lib/hooks/useGlobalInput.tsx`

### Context Shape

```ts
interface GlobalInputContextValue {
  keyboardVisible: boolean;
  isListening: boolean;
  lastPointerType: 'touch' | 'mouse' | 'keyboard';
  isMobile: boolean;
  activeInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  setKeyboardVisible: (visible: boolean) => void;
  setIsListening: (listening: boolean) => void;
  injectText: (text: string) => void;
}
```

### Input Selector

Only these inputs trigger the virtual keyboard:

```
input[type="text"], input[type="search"], input[type="email"], textarea, [contenteditable]
```

`contentEditable` (rich-text) elements are also supported: the provider tracks an `activeContentEditableRef`, and both keyboard and voice inject into them via `document.execCommand('insertText', …)` rather than the native value setter.

Password inputs: keyboard appears but mic button is hidden (see §3).

Excluded (never trigger): `input[type="time"]`, `input[type="date"]`, `input[type="number"]`, `select`

```ts
function shouldShowKeyboard(el: Element): boolean {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement) {
    return ['text', 'search', 'email', 'password'].includes(el.type.toLowerCase());
  }
  return true; // textarea
}

function isPasswordInput(el: Element): boolean {
  return el instanceof HTMLInputElement && el.type.toLowerCase() === 'password';
}
```

### Event Listeners

All registered with `{ passive: true }` unless noted.

**`pointerdown`:** sets `lastPointerType = e.pointerType` ("touch" | "mouse" | "pen")

**`focusin`:**
```ts
const target = e.target as Element;
if (!shouldShowKeyboard(target)) { activeInputRef.current = null; setKeyboardVisible(false); return; }
activeInputRef.current = target as HTMLInputElement | HTMLTextAreaElement;
if (lastPointerType === 'touch' && !isMobile && !suppressedForScan && virtualKeyboardEnabled) {
  setKeyboardVisible(true);
  scrollInputIntoView(target);
}
```

**`focusout`:**
```ts
const next = e.relatedTarget as Element | null;
if (next && isInsideKeyboard(next)) return; // keyboard buttons stole focus, ignore
activeInputRef.current = null;
setKeyboardVisible(false);
restoreScroll();
```

`isInsideKeyboard(el)` checks `el.closest('[data-virtual-keyboard]')`.

**`keydown`:** physical keyboard auto-dismiss (§9) + barcode buffer (§5).

### `injectText(text: string)`

Shared injection for keyboard and voice. Handles React controlled inputs via native value setter:

```ts
function injectText(text: string): void {
  const input = activeInputRef.current;
  if (!input) return;
  const proto = input instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) return;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
```

- Keyboard: passes the full `simple-keyboard` state string (its `onChange` provides the complete value)
- Voice: passes `existingValue + ' ' + recognizedText`

### Barcode Scan Suppression

When a scan fires, set `suppressedForScan = true` for 500ms. During this window, `focusin` does not open the keyboard. Prevents the keyboard from popping after a scan into a search field.

---

## 3. Virtual On-Screen Keyboard

### File: `src/components/input/VirtualKeyboard.tsx`

### Package

```
npm install simple-keyboard
```

Pin to a specific minor version (e.g., `"simple-keyboard": "3.7.x"`). The library has breaking changes between minor versions.

### Layout

```ts
const layout = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{lock} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '{space} {mic} {dismiss}',
  ],
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '{space} {mic} {dismiss}',
  ],
};
```

Custom button labels: `{bksp}` → "⌫", `{enter}` → "↵", `{shift}` → "⇧", `{lock}` → "⇪", `{tab}` → "⇥", `{mic}` → mic icon, `{dismiss}` → ↓ icon.

`{mic}` is hidden (opacity 0, pointer-events none) when `isPasswordInput(activeInputRef.current)` is true.

### Positioning

Fixed overlay, portalled to `document.body`:

```
position: fixed
bottom: 0
left: 0
right: 0
z-index: 9000
height: 32vh
min-height: 320px
max-height: 480px
```

> Note: the scroll math (§7) and the `--keyboard-height` CSS var both use **32vh**. The `VirtualKeyboard.tsx` container style still hardcodes `38vh`, so the visual height and scroll math don't yet agree. Reconcile to 32vh.

Key height ≥ 52px, key font size 18px. Sized for comfortable use on 24" 1080p display.

### Theming

Override simple-keyboard's CSS variables in `globals.css` scoped to `[data-virtual-keyboard]`. Reads Prism's CSS custom properties for automatic dark/light mode support. Import `simple-keyboard/build/css/index.css` only inside the component file (not globally).

### simple-keyboard Integration

```ts
const keyboardRef = useRef<Keyboard | null>(null);

// On mount:
keyboardRef.current = new Keyboard(containerRef.current, {
  onChange: (input) => injectText(input),
  onKeyPress: (button) => {
    if (button === '{shift}' || button === '{lock}') handleShift();
    if (button === '{dismiss}') setKeyboardVisible(false);
    if (button === '{mic}') startListening();
  },
  layout,
  physicalKeyboardHighlight: false,
  syncInstanceInputs: false,
});

// When active input changes, sync keyboard state to existing value:
keyboardRef.current?.setInput(activeInputRef.current?.value ?? '');
```

### Animation

Slide in from bottom on open, slide out on close. `translateY(100%) → translateY(0)` over 200ms ease-out. Use a controlled `isExiting` state to trigger exit animation before unmounting.

---

## 4. Voice-to-Text

### File: `src/lib/hooks/useSpeechRecognition.ts`

### Extensibility Interface

```ts
export interface SpeechRecognizer {
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}
```

v1 implements with `webkitSpeechRecognition`. To swap to cloud (Azure/Whisper/Deepgram) in v2: implement the same interface in a new file, update the import in `useGlobalInput.tsx`. No callers change.

### Configuration

```ts
rec.continuous = false;    // single utterance per tap
rec.interimResults = true; // v1: ignored; v2: display as interim chip above input
rec.lang = 'en-US';        // v1 hardcoded; v2: read from speech.language setting
```

### Append Behavior

```ts
const handleSpeechResult = (transcript: string) => {
  const input = activeInputRef.current;
  if (!input) return;
  const current = input.value;
  const separator = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
  injectText(current + separator + transcript);
};
```

### Error Toasts

| Error | Toast message |
|---|---|
| `no-speech` | "No speech detected. Tap the mic to try again." |
| `not-allowed` | "Microphone permission denied. Check browser settings." |
| `network` | "Speech recognition needs an internet connection." |
| `audio-capture` | "No microphone found." |
| `aborted` | Silent |

### Mic Button Visual State

Apply a class to the keyboard container (`is-listening`) when `isListening` is true. CSS targets `.is-listening .key-mic { animation: pulse 1s infinite; }`.

---

## 5. Barcode Scanner

### 5.1 Detection Algorithm

Lives inside `GlobalInputProvider`'s `keydown` handler:

```ts
const barcodeBuffer = useRef<{ char: string; time: number }[]>([]);

// In keydown handler:
if (e.key === 'Enter') {
  const buf = barcodeBuffer.current;
  if (buf.length >= 10) {
    const elapsed = buf[buf.length - 1].time - buf[0].time;
    if (elapsed < 100) {
      const barcode = buf.map(b => b.char).join('');
      barcodeBuffer.current = [];
      e.preventDefault();
      dispatchScan(barcode);
      return;
    }
  }
  barcodeBuffer.current = [];
  return;
}
if (e.key.length === 1) {
  barcodeBuffer.current.push({ char: e.key, time: Date.now() });
  // Trim: keep only chars in last 200ms
  const cutoff = Date.now() - 200;
  barcodeBuffer.current = barcodeBuffer.current.filter(b => b.time >= cutoff);
} else {
  barcodeBuffer.current = [];
}
```

**Threshold:** 10+ characters in <100ms ending with Enter. Well above human typing speed, well below scanner speed.

### 5.2 Server API

**File:** `src/app/api/shopping/scan/route.ts`

```
POST /api/shopping/scan
Body: { barcode: string, dryRun?: boolean, listId?: string, category?: ShoppingCategory }

200 found:    { found: true, item: { name, brand?, category?, imageUrl? }, action: "added"|"updated_existing", listId, itemId }
200 missing:  { found: false, barcode }
200 dryRun:   { found: true, product: { name, brand?, suggestedCategory }, existingInLists: [...] }  // nothing is written
400:          { error: "barcode is required" }
401:          { error: "Unauthorized" }       // no display session
403:          { error: ... }                  // scanner.enabled is false
```

Requires a display session: `getDisplayAuth()` returns 401 if absent. Returns 403 when `scanner.enabled` is `false`. Optional body fields: `dryRun` (look up and report without adding), `listId` (override target list), `category` (override resolved category). Otherwise reads the `scanner.defaultListId` setting to determine the target list.

### 5.3 Product Lookup Cascade

**File:** `src/lib/integrations/product-lookup.ts`

```ts
export interface ProductLookupResult {
  name: string;
  brand?: string;
  category: ShoppingCategory;
  imageUrl?: string;
  source: 'open-food-facts' | 'upcitemdb' | 'cache';
}

export async function lookupBarcode(barcode: string): Promise<ProductLookupResult | null>
```

**Provider order:**
1. **Redis cache**: key `barcode:{barcode}`, TTL 7 days, check first
2. **Open Food Facts**: free, no key, best grocery coverage
3. **UPCitemdb**: free tier (100/day), good US coverage, handles non-food pantry items

3-second timeout per provider via `AbortController`. (Nutritionix/Edamam were considered but are not implemented: no `integrations.nutritionix.*` / `integrations.edamam.*` settings exist.)

### 5.4 Route Logic

```
1. Validate barcode (non-empty, max 20 chars, alphanumeric + hyphens)
2. Check Redis cache
3. Call lookupBarcode()
4. If not found: return { found: false }
5. Resolve target list: scanner.defaultListId → "Groceries" list → first list
6. Duplicate check: SELECT WHERE listId=? AND name ILIKE ? AND checked=false
7. Duplicate: update source='scan', return action:"updated_existing"
8. New: INSERT with source='scan', trigger MS To-Do sync, return action:"added"
```

### 5.5 Client-Side `dispatchScan`

```ts
async function dispatchScan(barcode: string) {
  suppressedForScan.current = true;
  setTimeout(() => { suppressedForScan.current = false; }, 500);
  playBeep();

  const res = await fetch('/api/shopping/scan', { method: 'POST', ... });
  const data = await res.json();

  if (!data.found) {
    // Unknown barcode: show a toast and add NOTHING (no placeholder item is created).
    toast({ title: 'Unknown barcode', description: `No product found for ${barcode}` });
    return;
  }

  const isOnShopping = window.location.pathname.startsWith('/shopping');
  if (isOnShopping) {
    window.dispatchEvent(new CustomEvent('prism:scan-result', { detail: data }));
  }

  toast({
    title: data.action === 'updated_existing' ? `${data.item.name} already on list` : `${data.item.name} added`,
    action: !isOnShopping ? { label: 'View', onClick: () => router.push('/shopping') } : undefined,
  });
}
```

### 5.6 Database

`shopping_items.source` column already exists with `default('internal')`. Add `'scan'` as a new valid value. No migration needed. Document in a schema comment.

### 5.7 Audio Feedback

Beeps are **synthesized with the Web Audio API**. No MP3 assets are bundled. `playBeep()` builds an `AudioContext` oscillator and plays a short tone: **1800 Hz** for the `"scan"` (Scanner chirp) style, **1200 Hz** for the `"beep"` (Short beep) style.

```ts
function playBeep() {
  if (!settings['scanner.soundEnabled']) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.frequency.value = settings['scanner.soundStyle'] === 'scan' ? 1800 : 1200;
  // …gain envelope, then osc.start()/osc.stop() for a brief chirp
}
```

### 5.8 Scan Icon on Shopping Items

```tsx
{item.source === 'scan' && (
  <ScanBarcode className="h-3 w-3 text-muted-foreground/60" aria-label="Added by scanner" />
)}
```

Rendered inline before quantity badge in `ShoppingItemRow`.

### 5.9 Scroll-to and Highlight on /shopping

`ShoppingView` listens for `prism:scan-result`:
```ts
const el = document.getElementById(`shopping-item-${data.itemId}`);
el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
el?.classList.add('scan-highlight');
setTimeout(() => el?.classList.remove('scan-highlight'), 1500);
```

Each item row gets `id={`shopping-item-${item.id}`}`. Add `scan-highlight` keyframe in `globals.css` (300ms yellow background flash).

### 5.10 Camera Scanner (shipped)

Besides USB/Bluetooth keyboard-wedge (HID) scanners, the Shopping page ships a **camera-based scanner** for phones/tablets with no dedicated hardware.

**Files:** `src/components/input/CameraScannerOverlay.tsx`, `src/lib/hooks/useCameraScanner.ts`.

- **Trigger:** a camera icon in the Shopping page header. It's opened by dispatching the `prism:open-barcode-scanner` event; `ShoppingView` lazy-loads the overlay (dynamic import) and toggles `showCameraScanner`.
- **Full-screen overlay:** the camera viewfinder fills the screen and self-dismisses on a successful read.
- **Two decode paths:**
  - **`BarcodeDetector`** (native, Android/Chrome): continuous live scanning of the video stream.
  - **`@zxing/browser` photo-capture fallback** (iOS/Safari, where `BarcodeDetector` is unavailable): captures a still frame and decodes it.
- **Feedback:** haptic buzz + the same synthesized beep (§5.7) on a hit.
- A decoded barcode is handed to the same `dispatchScan` flow (§5.5), so lookup/dedup/add behavior is identical to the HID path.

---

## 6. Floating Keyboard Toggle Button

### File: `src/components/input/KeyboardToggleButton.tsx`

### Visibility

Show when ALL: `activeInputRef.current !== null` AND `keyboardVisible === false` AND `isMobile === false` AND `lastPointerType === 'touch'`.

### Positioning

```
position: fixed
bottom: 1.5rem
right: 1.5rem
z-index: 8500
size: 48×48px
```

shadcn `Button` variant `secondary`, rounded-xl, `Keyboard` icon from lucide-react, `aria-label="Open keyboard"`.

Tapping calls `setKeyboardVisible(true)`. Fade in/out 150ms.

---

## 7. Scroll-into-View

### Algorithm

```ts
const KEYBOARD_HEIGHT_VH = 32;
const SCROLL_MARGIN_PX = 16;
let originalScrollY: number | null = null;

function scrollInputIntoView(el: Element) {
  const rect = el.getBoundingClientRect();
  const keyboardTop = window.innerHeight * (1 - KEYBOARD_HEIGHT_VH / 100);
  if (rect.bottom + SCROLL_MARGIN_PX > keyboardTop) {
    originalScrollY = window.scrollY;
    const scrollNeeded = rect.bottom + SCROLL_MARGIN_PX - keyboardTop;
    getScrollParent(el).scrollBy({ top: scrollNeeded, behavior: 'smooth' });
  }
}

function restoreScroll() {
  if (originalScrollY !== null) {
    window.scrollTo({ top: originalScrollY, behavior: 'smooth' });
    originalScrollY = null;
  }
}

function getScrollParent(el: Element): Element | Window {
  let parent = el.parentElement;
  while (parent) {
    if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return window;
}
```

Uses `getScrollParent` to handle pages with `overflow: hidden` on the body (dashboard, shopping).

**`AppShell` padding:** Consider exposing `--keyboard-height: 32vh` as a CSS custom property on `:root` (set when keyboard is open, `0px` otherwise) so inner scroll containers can consume it directly rather than relying on padding on `<main>`.

---

## 8. Mobile Exclusion

**Detection:** `useIsMobile()` (existing hook, `window.innerWidth < 768`). No user-agent sniffing.

**Provider behavior:** Provider mounts on all devices (owns barcode scanner). When `isMobile` is true: `focusin` never sets `keyboardVisible = true`.

**Component behavior:** `VirtualKeyboard` and `KeyboardToggleButton` both return `null` when `isMobile` is true from context (safety net).

**Laptop touchscreens:** Handled correctly by pointer type detection. Tap → keyboard appears. Physical keypress → keyboard auto-dismisses. Trackpad click → keyboard never appears.

---

## 9. Physical Keyboard Auto-Dismiss

```ts
function isRealKeyboardEvent(e: KeyboardEvent): boolean {
  if (!e.isTrusted) return false; // programmatic events (simple-keyboard does not dispatch these)
  if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return false;
  return true;
}

// In keydown handler:
if (isRealKeyboardEvent(e) && keyboardVisible) {
  setKeyboardVisible(false);
}
```

Auto-dismiss is synchronous and runs before the barcode buffer check, so USB barcode scanners (which appear as keyboard input) still trigger barcode detection correctly.

---

## 10. Settings

### New Settings Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `scanner.enabled` | boolean | `true` | Master switch for barcode scanning |
| `scanner.defaultListId` | string\|null | `null` | UUID of default list; null = auto-select "Groceries" |
| `scanner.soundEnabled` | boolean | `true` | Audio feedback on scan |
| `scanner.soundStyle` | `"beep"\|"scan"` | `"beep"` | Which tone to play |
| `input.virtualKeyboardEnabled` | boolean | `true` | Master switch for virtual keyboard |

### Settings UI

New section: `{ id: 'input', label: 'Input', icon: Keyboard }`. Add to sections array in `SettingsView.tsx` after `'display'`.

**File:** `src/app/settings/sections/InputSection.tsx`

**Card 1: Barcode Scanner**
- Enable scanner (Switch)
- Default list (Select from shopping lists)
- Scanner sound (Switch)
- Sound style (Select: Short beep / Scanner chirp, disabled when sound off)

**Card 2: Virtual Keyboard**
- Enable on-screen keyboard (Switch)
- Description: "Shows a touch keyboard when tapping text fields. Disable if using a physical keyboard."

---

## 11. File Manifest

### New Files

| File | Responsibility |
|---|---|
| `src/lib/hooks/useGlobalInput.tsx` | `GlobalInputProvider` + `useGlobalInput()`. All state, all document listeners, `injectText`, `dispatchScan`, `playBeep`, scroll helpers, barcode buffer. Instantiates `useSpeechRecognition`. |
| `src/lib/hooks/useSpeechRecognition.ts` | `webkitSpeechRecognition` wrapper. Returns `SpeechRecognizer` interface. Swap this file's implementation for cloud STT in v2 without changing any callers. |
| `src/components/input/VirtualKeyboard.tsx` | Keyboard UI. `simple-keyboard`. Portalled to `document.body`. Reads context via `useGlobalInput()`. |
| `src/components/input/KeyboardToggleButton.tsx` | Fixed bottom-right button. Returns `null` when `isMobile` or `keyboardVisible`. |
| `src/components/input/index.ts` | Re-exports above two components. |
| `src/lib/integrations/product-lookup.ts` | `lookupBarcode()`. Cascade + Redis cache + category mapping + per-provider timeouts. |
| `src/app/api/shopping/scan/route.ts` | `POST /api/shopping/scan`. Validate → lookup → deduplicate → insert → sync. |
| `src/app/settings/sections/InputSection.tsx` | Scanner + keyboard settings UI. |
| `src/components/input/CameraScannerOverlay.tsx` | Full-screen camera scanner UI (`BarcodeDetector` + `@zxing/browser` fallback). |
| `src/lib/hooks/useCameraScanner.ts` | Camera-scan decode loop / stream management. |

### Modified Files

| File | Changes |
|---|---|
| `src/components/providers/Providers.tsx` | Add `<GlobalInputProvider>` wrapping `{children}`. |
| `src/components/layout/AppShell.tsx` | Add `--keyboard-height` CSS custom property on `:root` based on `keyboardVisible`. |
| `src/app/shopping/ShoppingView.tsx` | Add `prism:scan-result` event listener. Scroll + highlight on scan. |
| `src/app/shopping/ShoppingItemRow.tsx` | Render `ScanBarcode` icon when `item.source === 'scan'`. Add `id` prop. |
| `src/types/models.ts` | Add `source?: string` to `ShoppingItem`. |
| `src/app/settings/SettingsView.tsx` | Add Input section to nav + render tree. |
| `src/styles/globals.css` | simple-keyboard CSS overrides. `scan-highlight` animation. Mic pulse animation. `--keyboard-height` consumer patterns. |
| `tailwind.config.js` | Add `animate-slide-up` / `animate-slide-down` keyframes. |
| `package.json` | Add `simple-keyboard` (pinned minor version). |

---

## 12. Open Questions / Deferred

| # | Item |
|---|---|
| 1 | **simple-keyboard CSS isolation**: import scoped to `[data-virtual-keyboard]` via PostCSS to prevent class bleed |
| 2 | **Voice language**: hardcoded `en-US` in v1; add `speech.language` setting in v2 |
| 3 | **Interim speech results**: suppressed in v1; v2 can show as floating chip above active input (`interimText` state already in context shape) |
| 4 | **Caps lock behavior**: double-tap `{shift}` activates caps lock; requires careful state tracking in `handleShift()` |
| 5 | **MS To-Do sync on scan**: verify `microsoft-todo.ts` sync function is callable server-side from route handler; if not, queue the sync |
| 6 | **Camera-based scanning on mobile**: ✅ SHIPPED (see §5.10): `BarcodeDetector` with a `@zxing/browser` + `getUserMedia` photo-capture fallback, triggered from the Shopping page header |
| 7 | **PIN entry on login page**: verify PIN pad uses buttons (not `input[type=text]`) and is excluded from keyboard trigger |
| 8 | **Accessibility**: add `role="application"` and `aria-label="Virtual keyboard"` to keyboard container; `aria-hidden` if AT should skip |
| 9 | **Hardware mic availability**: ViewSonic TD2465 has audio I/O ports but no built-in mic; USB mic needed; test before voice goes live |
| 10 | **`AppShell` bottom padding**: pages with fixed-height layouts (Shopping, Tasks) need inner scroll container to consume `--keyboard-height` var directly rather than relying on padding on `<main>` |
