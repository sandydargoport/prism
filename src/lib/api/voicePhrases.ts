/**
 * Pure functions that turn structured data into natural-language strings
 * for the Voice API's `spoken` field. Kept separate from route handlers so
 * they can be unit-tested without HTTP/DB plumbing.
 */

type SpeakableEvent = {
  title: string;
  startTime: Date;
  allDay: boolean;
};

export function phraseEventList(items: SpeakableEvent[]): string {
  if (items.length === 0) return 'You have no events today.';

  const parts = items.map((e) => {
    if (e.allDay) return `${e.title}, all day`;
    const time = e.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: e.startTime.getMinutes() === 0 ? undefined : '2-digit',
    });
    return `${e.title} at ${time}`;
  });

  if (parts.length === 1) return `Today you have ${parts[0]}.`;
  if (parts.length === 2) return `Today you have ${parts[0]} and ${parts[1]}.`;

  const last = parts.pop();
  return `Today you have ${parts.join(', ')}, and ${last}.`;
}
