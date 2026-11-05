import { describe, expect, it } from 'vitest';
import { holtropMennen, resistanceCurve } from './holtrop';
import { WORKED_EXAMPLE } from './presets';
import { checkInputs } from './validity';

const r = holtropMennen(WORKED_EXAMPLE, 25);
const close = (a: number, b: number, rel: number) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel);

describe('Holtrop–Mennen worked example, 25 kn', () => {
  it('step 1: hull form', () => {
    close(r.V, 12.86, 1e-3);
    close(r.CB, 0.5716, 1e-3);
    close(r.CP, 0.5833, 1e-3);
    close(r.Fn, 0.2868, 1e-3);
    close(r.LR, 81.39, 1e-3);
  });
  it('step 2: friction', () => {
    close(r.S, 7381.5, 1e-3);
    close(r.Rn, 2.219e9, 1e-3);
    close(r.CF, 0.00139, 2e-3);
    close(r.RF / 1e3, 869.5, 2e-3);
  });
  it('step 3: form factor', () => {
    expect(r.c12Branch).toContain('0.02 < T/L < 0.05');
    close(r.c12, 0.5102, 1e-3);
    close(r.c13, 1.03, 1e-9);
    close(r.onePlusK1, 1.156, 1e-3);
    close(r.RFk1 / 1e3, 1005.5, 2e-3);
  });
  it('step 4: appendages', () => close(r.RAPP / 1e3, 8.83, 3e-3));
  it('step 5: waves', () => {
    close(r.c7, 0.1561, 1e-3);
    close(r.iE, 12.08, 2e-3);
    close(r.c1, 1.398, 2e-3);
    close(r.c3, 0.02119, 2e-3);
    close(r.c2, 0.7595, 1e-3);
    close(r.c5, 0.9592, 1e-3);
    close(r.c16, 1.3809, 1e-3);
    close(r.m1, -2.1274, 1e-3);
    close(r.m2, -0.1708, 3e-3);
    close(r.lambda, 0.6513, 1e-3);
    close(r.RW / 1e3, 556.7, 3e-3);
  });
  it('step 6: bulb and transom', () => {
    close(r.PB, 0.6261, 1e-3);
    close(r.Fni, 1.508, 2e-3);
    expect(r.RB / 1e3).toBeCloseTo(0.049, 2);
    close(r.FnT, 5.432, 2e-3);
    expect(r.c6).toBe(0);
    expect(r.RTR).toBe(0);
  });
  it('step 7: correlation', () => {
    close(r.CA, 0.000352, 3e-3);
    close(r.RA / 1e3, 220.5, 3e-3);
  });
  it('step 8: total and power', () => {
    close(r.RT / 1e3, 1791.6, 2e-3);
    close(r.PE / 1e3, 23040, 2e-3);
  });
  it('reproduces the 15–29 kn resistance curve', () => {
    const expected: Record<number, [number, number]> = {
      15: [514, 3966], 17: [663, 5794], 19: [846, 8264], 21: [1080, 11666],
      23: [1433, 16952], 25: [1792, 23040], 27: [2144, 29778], 29: [2645, 39451],
    };
    for (const p of resistanceCurve(WORKED_EXAMPLE)) {
      const [rt, pe] = expected[p.speedKn];
      close(p.RT / 1e3, rt, 3e-3);
      close(p.PE / 1e3, pe, 3e-3);
    }
  });
  it('accepts the worked example inputs', () => {
    expect(checkInputs(WORKED_EXAMPLE).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('handles a hull with no bulb, no transom and no appendages', () => {
    const p = holtropMennen({ ...WORKED_EXAMPLE, ABT: 0, AT: 0, appendages: [] }, 20);
    expect(p.RB).toBe(0);
    expect(p.RTR).toBe(0);
    expect(p.RAPP).toBe(0);
    expect(p.c2).toBe(1);
    expect(Number.isFinite(p.RT)).toBe(true);
  });
});
