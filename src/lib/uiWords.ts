/**
 * The words the UI uses for screens, dashboards and their states (#1337).
 *
 * One table, so the editor, Settings, Help and the docs name each thing the
 * same way. `RETIRED_UI_WORDS` is what `scripts/check-ui-words.ts` looks for
 * in UI text and the docs; each entry says what to write instead.
 */

/** Words and labels to use. */
export const UI_WORDS = [
  'In use',
  'Idle',
  'Day',
  'Night',
  'When idle',
  'Idle after 2 min',
  'Normally',
  'Editing',
  'The dashboard, quieter',
  'A photo frame',
  'The night sky',
  'Darker at night',
  'New and unnamed screens show',
  'Stays',
  'Fades',
  'This phone',
  'Edit a screen',
] as const;

export type RetiredUiWord = {
  /** The retired word, as the baseline and the report name it. */
  word: string;
  /** What to write instead. */
  use: string;
  /**
   * How to find it. Whole word, and case-insensitive unless a note says why
   * not. Must carry the `g` flag.
   */
  pattern: RegExp;
};

export const RETIRED_UI_WORDS: readonly RetiredUiWord[] = [
  { word: 'Resting', use: 'Idle', pattern: /\bresting\b/gi },
  { word: 'screensaver', use: 'Idle, or "A photo frame" / "The night sky" for what shows', pattern: /\bscreen[ -]?savers?\b/gi },
  {
    word: 'calm',
    use: 'Idle, or "The dashboard, quieter"',
    // Only calm as the name of the state: "a calm dashboard", "calm mode",
    // "goes calm". Plain English ("one calm list") is left alone.
    pattern: /\bcalm(?=\s+(?:dashboards?|mode|state|idle|screens?|display)\b)|\b(?:goes|go|going|went|is|stays?|turns?) calm\b/gi,
  },
  { word: 'Idle screen', use: 'Idle', pattern: /\bidle screens?\b/gi },
  { word: 'Rest after', use: '"Idle after 2 min", in the When idle row', pattern: /\brest after\b/gi },
  { word: 'Activate after', use: '"Idle after 2 min", in the When idle row', pattern: /\bactivate after\b/gi },
  { word: 'Start after', use: '"Idle after 2 min", in the When idle row', pattern: /\bstart after\b/gi },
  { word: 'How dark', use: '"Darker at night: 50%"', pattern: /\bhow dark\b/gi },
  { word: 'Dim this dashboard', use: '"Darker at night: 50%"', pattern: /\bdim this dashboard\b/gi },
  {
    word: 'See it',
    use: 'say where it opens, for example "Edit a screen"',
    // The retired button label. Case-sensitive, so prose ("if you still see
    // it") passes, and "See it at a screen size" is a different control.
    pattern: /\bSee it\b(?! at a screen size)/g,
  },
  {
    word: 'Through the day',
    use: 'Screen (the tab that holds time, idle and night)',
    // The retired tab name. Capital T only, so "partway through the day" passes.
    pattern: /\bThrough the [Dd]ay\b/g,
  },
  { word: 'Base dashboard', use: 'Normally', pattern: /\bbase dashboard\b/gi },
  { word: 'Make the default', use: '"New and unnamed screens show"', pattern: /\bmake the default\b/gi },
];
