import { transformWeather } from '../useWeather';

describe('transformWeather', () => {
  it("turns the eclipse's times back into Dates, as the arc needs", () => {
    const data = transformWeather({
      lastUpdated: '2026-07-17T12:00:00.000Z',
      forecast: [],
      eclipse: {
        body: 'sun',
        kind: 'partial',
        begin: '2026-07-17T17:00:00.000Z',
        peak: '2026-07-17T18:00:00.000Z',
        end: '2026-07-17T19:00:00.000Z',
        obscuration: 0.6,
      },
    });
    expect(data.eclipse?.peak).toBeInstanceOf(Date);
    expect(data.eclipse?.peak.toISOString()).toBe('2026-07-17T18:00:00.000Z');
    expect(data.eclipse?.begin).toBeInstanceOf(Date);
    expect(data.eclipse?.end).toBeInstanceOf(Date);
    expect(data.eclipse).toMatchObject({ body: 'sun', kind: 'partial', obscuration: 0.6 });
  });

  it('leaves the eclipse out on a day without one', () => {
    expect(transformWeather({ lastUpdated: '2026-07-17T12:00:00.000Z', forecast: [] }).eclipse).toBeUndefined();
  });
});
