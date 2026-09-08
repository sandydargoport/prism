export const TAG_PRESETS = [
  { value: 'outdoor', label: 'Outdoor', emoji: '🌳' },
  { value: 'indoor', label: 'Indoor', emoji: '🏠' },
  { value: 'nature', label: 'Nature', emoji: '🍃' },
  { value: 'city', label: 'City', emoji: '🏙️' },
  { value: 'hike', label: 'Hike', emoji: '🥾' },
  { value: 'food', label: 'Food', emoji: '🍽️' },
  { value: 'museum', label: 'Museum', emoji: '🏛️' },
  { value: 'farm', label: 'Farm', emoji: '🌾' },
  { value: 'park', label: 'Park', emoji: '⛲' },
  { value: 'playground', label: 'Playground', emoji: '🛝' },
  { value: 'market', label: 'Market', emoji: '🛍️' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'arts', label: 'Arts', emoji: '🎨' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
  { value: 'seasonal', label: 'Seasonal', emoji: '🍂' },
] as const;

export const STATUS_CONFIG = {
  backlog: { label: 'Want to Try', color: '#6B7280', bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
  visited: { label: 'Been There', color: '#10B981', bgClass: 'bg-success/10', textClass: 'text-success' },
} as const;

// Max visits shown as individual pips before collapsing to a number
export const MAX_PIPS = 15;
export const PIP_GROUP_SIZE = 5;
