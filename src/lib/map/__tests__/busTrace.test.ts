import { traceCoordinates, traceStartTs, type TraceStop } from '../busTrace';

// The school at 0,0. A fix is "metres east of the school" at a clock time.
const M_PER_DEG = 111_320;
const fix = (time: string, metres: number) => ({ ts: `2030-03-04T${time}Z`, lat: 0, lng: metres / M_PER_DEG });
const ms = (time: string) => new Date(`2030-03-04T${time}Z`).getTime();

const school: TraceStop = { order: 0, kind: 'school', lat: 0, lng: 0, arrivedAt: null };
const home: TraceStop = { order: 1, kind: 'stop', lat: 0, lng: 1_300 / M_PER_DEG, arrivedAt: null };

// An afternoon run as one was really driven: twenty minutes on the road before
// the school, past the stop's point into the bus loop ~170 m from it, parked
// there for ten minutes after a short shuffle forward, a few seconds' pause at
// the gate on the way out, then off on the route, which passes the school again.
const afternoon = [
  fix('15:13:01', 2_150), fix('15:20:57', 2_087), fix('15:24:40', 2_090),
  fix('15:26:46', 2_388), fix('15:29:05', 1_405), fix('15:31:05', 441),
  fix('15:31:40', 57), fix('15:32:00', 104), fix('15:32:29', 173),
  fix('15:34:18', 174), fix('15:34:30', 174), fix('15:35:14', 140),
  fix('15:35:19', 139), fix('15:35:30', 139), fix('15:45:26', 139),
  fix('15:45:39', 138), fix('15:46:06', 166), fix('15:46:16', 161),
  fix('15:46:21', 161), fix('15:46:58', 278), fix('15:50:43', 771),
  fix('16:05:47', 2_376), fix('16:09:46', 1_309), fix('16:25:00', 73),
  fix('16:32:37', 900),
];

describe('traceStartTs', () => {
  it('starts an afternoon run where the bus left its wait at the school', () => {
    expect(traceStartTs(afternoon, [school, home])).toBe(ms('15:45:39'));
  });

  it('starts at the last fix of a visit with no wait in it', () => {
    const driveThrough = afternoon.filter((f) => !/^2030-03-04T15:(3[2-9]|4[0-6])/.test(f.ts));
    expect(traceStartTs(driveThrough, [school, home])).toBe(ms('15:31:40'));
  });

  it('draws no line before the bus reaches the school', () => {
    expect(traceStartTs(afternoon.slice(0, 6), [school, home])).toBe(Infinity);
  });

  it('starts at the newest fix while the bus is still at the school', () => {
    expect(traceStartTs(afternoon.slice(0, 15), [school, home])).toBe(ms('15:45:26'));
  });

  it('falls back to the provider arrival when no fix came within reach', () => {
    const far = { ...school, lng: 5_000 / M_PER_DEG, arrivedAt: '2030-03-04T15:32:10Z' };
    expect(traceStartTs(afternoon, [far, home])).toBe(ms('15:32:29'));
  });

  it('draws the whole of a run that does not start at the school', () => {
    const morning = [{ ...home, order: 0 }, { ...school, order: 1 }];
    expect(traceStartTs(afternoon, morning)).toBe(-Infinity);
  });

  it('goes by stop order, not array order', () => {
    expect(traceStartTs(afternoon, [home, school])).toBe(ms('15:45:39'));
  });
});

describe('traceCoordinates', () => {
  it('leaves out the drive to the school', () => {
    const line = traceCoordinates(afternoon, [school, home], ms('16:32:37'));
    expect(line[0]).toEqual([138 / M_PER_DEG, 0]);
    expect(line).toHaveLength(10);
  });

  it('still ends at the given time', () => {
    expect(traceCoordinates(afternoon, [school, home], ms('15:50:43'))).toHaveLength(6);
  });

  it('is empty before the bus reaches the school', () => {
    expect(traceCoordinates(afternoon.slice(0, 6), [school, home], ms('15:29:05'))).toEqual([]);
  });

  it('leaves a morning run as it was', () => {
    const morning = [{ ...home, order: 0 }, { ...school, order: 1 }];
    expect(traceCoordinates(afternoon, morning, ms('16:32:37'))).toHaveLength(afternoon.length);
  });
});
