/**
 * The event sheet says when and where as one sentence (#836).
 */
import { eventSentence } from '../EventSheet';

const words = { allDayLabel: 'all day', to: 'to', at: 'at' };

describe('eventSentence', () => {
  it('reads day, time span and place', () => {
    expect(eventSentence({ ...words, day: 'Thursday, November 5', start: '4', end: '5:30', location: 'Community Park' }))
      .toBe('Thursday, November 5, 4 to 5:30, at Community Park');
  });
  it('leaves out what it does not have', () => {
    expect(eventSentence({ ...words, day: 'Friday, November 6', start: '7 pm', end: '7 pm' })).toBe('Friday, November 6, 7 pm');
    expect(eventSentence({ ...words, day: 'Saturday, November 7' })).toBe('Saturday, November 7, all day');
  });
});
