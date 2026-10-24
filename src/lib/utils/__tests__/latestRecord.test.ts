import { latestRecord } from '../latestRecord';

describe('latestRecord', () => {
  const opened = { id: 'r1', name: 'Soup', isFavorite: false };

  it('returns the list copy, so an edit or favourite shows in the open panel', () => {
    const list = [{ id: 'r1', name: 'Tomato soup', isFavorite: true }];
    expect(latestRecord(list, opened)).toBe(list[0]);
  });

  it('keeps the opened copy once the record has left the list', () => {
    expect(latestRecord([], opened)).toBe(opened);
  });
});
