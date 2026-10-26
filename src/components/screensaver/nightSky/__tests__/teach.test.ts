import { FIGURES } from '../catalog';
import { localSiderealTime, facingFor } from '../sky';
import { pickNext, place, traceOrder } from '../teach';

const figure = (id: string) => FIGURES.find((f) => f.id === id)!;
const nameOf = (id: string, i: number) => {
  const fig = figure(id);
  for (let k = 0; k < fig.labels.length; k += 2) if (fig.labels[k] === i) return fig.labels[k + 1];
  return undefined;
};

// A fictional household somewhere mid-latitude, west of Greenwich.
const LAT = 45;
const LON = -100;
const VIEW = { width: 1920, height: 1080, facing: facingFor(LAT) };
// A mid-August night: Aquila and Lyra are up in the south, and Cygnus is so
// near overhead that it is off the top of the screen.
const AUGUST = localSiderealTime(new Date('2026-08-15T03:30:00Z'), LON);

describe('the figures', () => {
  it('has every constellation, named, with what the name means', () => {
    expect(FIGURES).toHaveLength(88);
    expect(figure('Cyg')).toMatchObject({ name: 'Cygnus', meaning: 'the Swan', rank: 1 });
    // The Latin alone, or the wrong thing, is replaced by a meaning.
    expect(figure('Ori').meaning).toBe('the Hunter');
    expect(figure('UMa').meaning).toBe('the Great Bear');
  });

  it('names a few of each figure\'s own brightest stars, and only its own', () => {
    expect(figure('Lyr').labels).toContain('Vega');
    expect(figure('Ori').labels.filter((l) => typeof l === 'string')).toEqual(['Rigel', 'Betelgeuse', 'Bellatrix']);
    // Sabik lies on the Serpens line but belongs to Ophiuchus.
    expect(figure('Ser').labels).not.toContain('Sabik');
    for (const f of FIGURES) expect(f.labels.length / 2).toBeLessThanOrEqual(3);
  });
});

describe('tracing a figure', () => {
  it('starts at its brightest star', () => {
    const first = traceOrder(figure('Cyg'))[0]!;
    expect(first.depth).toBe(0);
    expect(nameOf('Cyg', first.from)).toBe('Deneb');
    expect(nameOf('Ori', traceOrder(figure('Ori'))[0]!.from)).toBe('Rigel');
  });

  it('grows every line out of a star already drawn, and draws each line once', () => {
    for (const fig of FIGURES) {
      const strokes = traceOrder(fig);
      const reachedAt = new Map<number, number>();
      for (const s of strokes) {
        if (s.depth === 0) reachedAt.set(s.from, 0);
        // The star a line starts from was reached at its own step or before.
        expect(reachedAt.get(s.from)).toBeLessThanOrEqual(s.depth);
        if (!reachedAt.has(s.to)) reachedAt.set(s.to, s.depth + 1);
      }
      const edges = new Set<string>();
      for (let i = 0; i < fig.e.length; i += 2) {
        const [a, b] = [fig.e[i]!, fig.e[i + 1]!].sort((x, y) => x - y);
        if (a !== b) edges.add(`${a}-${b}`);
      }
      expect(strokes).toHaveLength(edges.size);
    }
  });
});

describe('choosing the next figure', () => {
  it('only offers a figure that is well up and fully on screen', () => {
    expect(place(figure('Aql'), LAT, AUGUST, VIEW)).not.toBeNull();
    expect(place(figure('Lyr'), LAT, AUGUST, VIEW)).not.toBeNull();
    // Orion is below the horizon on an August night, and Cygnus off the top.
    expect(place(figure('Ori'), LAT, AUGUST, VIEW)).toBeNull();
    expect(place(figure('Cyg'), LAT, AUGUST, VIEW)).toBeNull();
  });

  it('starts with the best known of those never shown', () => {
    // Aquila is the only one of the best known up and on screen.
    expect(pickNext(FIGURES, LAT, AUGUST, VIEW, [], {})!.fig.id).toBe('Aql');
  });

  it('moves on to the one shown longest ago', () => {
    const shown: Record<string, number> = {};
    const seen: string[] = [];
    for (let n = 1; n <= 4; n++) {
      const next = pickNext(FIGURES, LAT, AUGUST, VIEW, [], shown)!;
      expect(seen).not.toContain(next.fig.id);
      seen.push(next.fig.id);
      shown[next.fig.id] = n;
    }
    // Once everything on offer has been shown, the oldest comes back first.
    const all: Record<string, number> = {};
    FIGURES.forEach((f, i) => { all[f.id] = 1000 + i; });
    all.Lyr = 1;
    expect(pickNext(FIGURES, LAT, AUGUST, VIEW, [], all)!.fig.id).toBe('Lyr');
  });

  it('skips a figure a widget would hide', () => {
    const all: Record<string, number> = {};
    FIGURES.forEach((f, i) => { all[f.id] = 1000 + i; });
    all.Lyr = 1;
    const lyra = place(figure('Lyr'), LAT, AUGUST, VIEW)!;
    const widget = { left: lyra.box.left - 10, top: lyra.box.top - 10, right: lyra.box.right + 10, bottom: lyra.box.bottom + 10 };
    expect(pickNext(FIGURES, LAT, AUGUST, VIEW, [widget], all)!.fig.id).not.toBe('Lyr');
  });
});
