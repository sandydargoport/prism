import { todayAgenda } from '../agenda';

const at = (h: number, m = 0) => new Date(2026, 10, 6, h, m);
const ev = (id: string, s: Date, e: Date, allDay = false) => ({ id, startTime: s, endTime: e, allDay });
const always = () => true;

describe('todayAgenda (#1030)', () => {
  const day = [
    ev('dentist', at(9), at(10)),
    ev('soccer', at(17), at(18, 30)),
    ev('date', at(19), at(21)),
    ev('bath', at(20, 30), at(21)),
    ev('grandma', at(0), at(23, 59), true),
  ];

  it('next is the one under way or about to start; later is the rest in order; done is what ended', () => {
    const a = todayAgenda(day, at(16, 12), always);
    expect(a.next?.id).toBe('soccer');
    expect(a.later.map((e) => e.id)).toEqual(['date', 'bath', 'grandma']);
    expect(a.done.map((e) => e.id)).toEqual(['dentist']);
  });

  it('an event under way is next', () => {
    expect(todayAgenda(day, at(17, 30), always).next?.id).toBe('soccer');
  });

  it('with only all-day events left, the first all-day one is next', () => {
    const a = todayAgenda(day, at(22), always);
    expect(a.next?.id).toBe('grandma');
    expect(a.later).toEqual([]);
    expect(a.done.map((e) => e.id)).toEqual(['bath', 'date', 'soccer', 'dentist']);
  });

  it('a clear day has nothing', () => {
    expect(todayAgenda([], at(9), always)).toEqual({ next: undefined, later: [], done: [] });
  });
});
