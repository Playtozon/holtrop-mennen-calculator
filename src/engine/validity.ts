import type { HMInputs, HMResult } from './types';

export interface ShipTypeRange {
  id: string;
  name: string;
  maxFn: number;
  CP: [number, number];
  LB: [number, number];
  BT: [number, number];
}

/** Ranges as commonly quoted from Holtrop and Mennen. */
export const SHIP_TYPES: ShipTypeRange[] = [
  { id: 'tanker', name: 'Tankers, bulk carriers', maxFn: 0.24, CP: [0.73, 0.85], LB: [5.1, 7.1], BT: [2.4, 3.2] },
  { id: 'trawler', name: 'Trawlers, coasters, tugs', maxFn: 0.38, CP: [0.55, 0.65], LB: [3.9, 6.3], BT: [2.1, 3.0] },
  { id: 'container', name: 'Container ships, destroyers', maxFn: 0.45, CP: [0.55, 0.67], LB: [6.0, 9.5], BT: [3.0, 4.0] },
  { id: 'cargo', name: 'Cargo liners', maxFn: 0.3, CP: [0.56, 0.75], LB: [5.3, 8.0], BT: [2.4, 4.0] },
  { id: 'roro', name: 'Ro-ro ships, car ferries', maxFn: 0.35, CP: [0.55, 0.67], LB: [5.3, 8.0], BT: [3.2, 4.0] },
];

export type Severity = 'error' | 'warn' | 'info';
export interface Issue {
  severity: Severity;
  message: string;
  /** Zone of the ship diagram the issue belongs to */
  zone?: string;
}

const inRange = (x: number, [a, b]: [number, number]) => x >= a && x <= b;

/** Distance of the hull from a ship-type row (0 = fully inside). */
function misfit(t: ShipTypeRange, CP: number, LB: number, BT: number) {
  const d = ([a, b]: [number, number], x: number) => (x < a ? (a - x) / a : x > b ? (x - b) / b : 0);
  return d(t.CP, CP) + d(t.LB, LB) + d(t.BT, BT);
}

export function bestShipType(CP: number, LB: number, BT: number): ShipTypeRange {
  return [...SHIP_TYPES].sort((a, b) => misfit(a, CP, LB, BT) - misfit(b, CP, LB, BT))[0];
}

/** Input checks that make the formulas undefined. Returned issues with severity 'error' block the result. */
export function checkInputs(inp: HMInputs): Issue[] {
  const out: Issue[] = [];
  const pos: [keyof HMInputs, string, string][] = [
    ['L', 'Waterline length L', 'hull'],
    ['B', 'Breadth B', 'midship'],
    ['TF', 'Draught forward TF', 'waterline'],
    ['TA', 'Draught aft TA', 'waterline'],
    ['volume', 'Displaced volume ∇', 'hull'],
    ['CM', 'Midship coefficient CM', 'midship'],
    ['CWP', 'Waterplane coefficient CWP', 'waterplane'],
    ['rho', 'Density ρ', 'environment'],
    ['nu', 'Viscosity ν', 'environment'],
    ['g', 'Gravity g', 'environment'],
  ];
  for (const [k, label, zone] of pos) {
    const v = inp[k] as number;
    if (!Number.isFinite(v) || v <= 0) out.push({ severity: 'error', message: `${label} must be a positive number.`, zone });
  }
  if (out.length) return out;

  if (inp.CM > 1) out.push({ severity: 'error', message: 'CM cannot exceed 1.', zone: 'midship' });
  if (inp.CWP >= 1) out.push({ severity: 'error', message: 'CWP must be below 1.', zone: 'waterplane' });
  const T = (inp.TF + inp.TA) / 2;
  const CB = inp.volume / (inp.L * inp.B * T);
  const CP = CB / inp.CM;
  if (CB >= 1) out.push({ severity: 'error', message: `CB = ${CB.toFixed(3)} ≥ 1: displaced volume is larger than the L·B·T box.`, zone: 'hull' });
  if (CP >= 0.95) out.push({ severity: 'error', message: `CP = ${CP.toFixed(3)}: the form-factor term (0.95 − CP) needs CP < 0.95.`, zone: 'hull' });
  if (CP <= 0.25) out.push({ severity: 'error', message: `CP = ${CP.toFixed(3)} is too small: L_R needs 4 CP − 1 > 0.`, zone: 'hull' });
  if (1 - CP + 0.0225 * inp.lcb <= 0) out.push({ severity: 'error', message: '1 − CP + 0.0225 lcb must be positive: lcb is too far aft.', zone: 'hull' });
  if (1 - CP - 0.0225 * inp.lcb <= 0) out.push({ severity: 'error', message: '1 − CP − 0.0225 lcb must be positive: lcb is too far forward.', zone: 'hull' });
  if (inp.ABT < 0 || inp.hB < 0 || inp.AT < 0) out.push({ severity: 'error', message: 'Bulb and transom areas and h_B cannot be negative.', zone: 'bow' });
  if (inp.ABT > 0 && inp.TF - 1.5 * inp.hB <= 0)
    out.push({ severity: 'error', message: 'T_F − 1.5 h_B must be positive for the bulb emergence P_B.', zone: 'bow' });
  if (inp.ABT > 0 && inp.TF - inp.hB - 0.25 * Math.sqrt(inp.ABT) < 0)
    out.push({ severity: 'warn', message: 'The bulb top reaches the waterline (T_F − h_B − 0.25√A_BT < 0).', zone: 'bow' });
  if (inp.iEOverride != null && (inp.iEOverride <= 0 || inp.iEOverride >= 90))
    out.push({ severity: 'error', message: 'Half angle of entrance i_E must be between 0° and 90°.', zone: 'waterplane' });
  if (inp.appendages.some((a) => a.area < 0 || a.onePlusK2 < 1))
    out.push({ severity: 'error', message: 'Appendage areas must be ≥ 0 and each 1 + k2 must be ≥ 1.', zone: 'appendages' });
  if (!(inp.designSpeed > 0)) out.push({ severity: 'error', message: 'Design speed must be positive.', zone: 'speed' });
  if (inp.AT > 0 && 0.8 * inp.AT >= inp.B * T * inp.CM)
    out.push({ severity: 'error', message: 'Transom area too large: c5 = 1 − 0.8 A_T/(B T C_M) would be ≤ 0.', zone: 'transom' });
  return out;
}

/** Advisory checks against the data the formulas were fitted to. */
export function checkValidity(inp: HMInputs, r: HMResult): Issue[] {
  const out: Issue[] = [];
  const LB = inp.L / inp.B;
  const BT = inp.B / r.T;
  const type = bestShipType(r.CP, LB, BT);
  const bad: string[] = [];
  if (!inRange(r.CP, type.CP)) bad.push(`CP ${r.CP.toFixed(3)} (${type.CP.join('–')})`);
  if (!inRange(LB, type.LB)) bad.push(`L/B ${LB.toFixed(2)} (${type.LB.join('–')})`);
  if (!inRange(BT, type.BT)) bad.push(`B/T ${BT.toFixed(2)} (${type.BT.join('–')})`);
  if (bad.length)
    out.push({
      severity: 'warn',
      message: `Closest fitted ship type is “${type.name}”, but ${bad.join(', ')} is outside its range. Treat the answer as a rough guide.`,
    });
  else out.push({ severity: 'info', message: `Hull fits the “${type.name}” range of the regression data.` });
  if (r.Fn > type.maxFn)
    out.push({
      severity: 'warn',
      message: `Fn = ${r.Fn.toFixed(3)} at ${r.speedKn} kn exceeds ${type.maxFn} quoted for ${type.name.toLowerCase()}.`,
      zone: 'speed',
    });
  if (inp.hB > 0.6 * inp.TF && inp.ABT > 0)
    out.push({ severity: 'warn', message: `h_B = ${inp.hB} m is above 0.6 T_F = ${(0.6 * inp.TF).toFixed(2)} m.`, zone: 'bow' });
  if (Math.abs(inp.TF - inp.TA) / r.T > 0.1)
    out.push({ severity: 'info', message: 'Large trim: the method uses mean draught T and forward draught T_F only.', zone: 'waterline' });
  return out;
}
