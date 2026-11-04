import { splitDay } from '../useDayPaging';

const day = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('splitDay (#801)', () => {
  it('shows everything, unpaged, when it all fits', () => {
    expect(splitDay(day, 7, 6, true, 3)).toEqual({ shown: day, rest: [], page: null });
  });

  it('folds into "+N more" when paging is off', () => {
    const r = splitDay(day, 4, 3, false, 5);
    expect(r).toEqual({ shown: ['a', 'b', 'c'], rest: ['d', 'e', 'f', 'g'], page: null });
  });

  it('pages through a busy day, each event on exactly one page, then wraps', () => {
    const pages = [0, 1, 2].map((tick) => splitDay(day, 4, 3, true, tick));
    expect(pages.map((p) => p.page)).toEqual([
      { index: 0, count: 3 }, { index: 1, count: 3 }, { index: 2, count: 3 },
    ]);
    expect(pages.flatMap((p) => p.shown)).toEqual(day);
    for (const p of pages) expect([...p.shown, ...p.rest].sort()).toEqual(day);
    expect(splitDay(day, 4, 3, true, 3).page).toEqual({ index: 0, count: 3 });
  });

  it('keeps "+N more" when not even one event fits beside the label', () => {
    expect(splitDay(day, 0, 0, true, 1)).toEqual({ shown: [], rest: day, page: null });
  });
});
