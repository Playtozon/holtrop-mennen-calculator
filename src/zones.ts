import type { HMInputs, HMResult } from './engine/types';

export type ComponentKey = 'RFk1' | 'RW' | 'RA' | 'RAPP' | 'RB' | 'RTR';

/** The eight steps of the Holtrop–Mennen procedure double as the clickable zones of the ship. */
export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Resistance components in fixed categorical order (stack order = colour slot order). */
export const COMPONENTS: { key: ComponentKey; label: string; tex: string; name: string; color: string; zones: ZoneId[] }[] = [
  { key: 'RFk1', label: 'RF(1+k1)', tex: 'R_F(1+k_1)', name: 'Friction with form', color: 'var(--color-c-rf)', zones: [2, 3] },
  { key: 'RW', label: 'RW', tex: 'R_W', name: 'Wave making', color: 'var(--color-c-rw)', zones: [5] },
  { key: 'RA', label: 'RA', tex: 'R_A', name: 'Correlation', color: 'var(--color-c-ra)', zones: [7] },
  { key: 'RAPP', label: 'RAPP', tex: 'R_{APP}', name: 'Appendages', color: 'var(--color-c-rapp)', zones: [4] },
  { key: 'RB', label: 'RB', tex: 'R_B', name: 'Bulbous bow', color: 'var(--color-c-rb)', zones: [6] },
  { key: 'RTR', label: 'RTR', tex: 'R_{TR}', name: 'Immersed transom', color: 'var(--color-c-rtr)', zones: [6] },
];

export type NumericKey = {
  [K in keyof HMInputs]: HMInputs[K] extends number | null ? K : never;
}[keyof HMInputs];

export interface FieldDef {
  key: NumericKey;
  label: string;
  /** TeX symbol */
  sym: string;
  unit?: string;
  step?: number;
  hint?: string;
  /** Nullable field: empty means "estimate from regression" */
  optional?: boolean;
  /** Regression value shown as the placeholder for optional fields */
  auto?: (r: HMResult) => number;
}

export interface ZoneDef {
  id: ZoneId;
  title: string;
  /** Where the step sits on the ship */
  where: string;
  blurb: string;
  drives: ComponentKey[];
  fields: FieldDef[];
  /** Key values shown in the hover card */
  summary: (i: HMInputs, r: HMResult | null) => [string, string][];
}

const f = (x: number, d = 2) =>
  Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';
const kN = (x: number, d = 1) => `${f(x / 1e3, d)} kN`;

export const ZONES: ZoneDef[] = [
  {
    id: 1,
    title: 'Hull form',
    where: 'Main hull',
    blurb: 'Main dimensions and displacement. They give CB, CP, the Froude number and the length of run LR.',
    drives: ['RFk1', 'RW'],
    fields: [
      { key: 'L', label: 'Waterline length', sym: 'L', unit: 'm', step: 1 },
      { key: 'B', label: 'Moulded breadth', sym: 'B', unit: 'm', step: 0.1 },
      { key: 'TF', label: 'Draught forward', sym: 'T_F', unit: 'm', step: 0.1 },
      { key: 'TA', label: 'Draught aft', sym: 'T_A', unit: 'm', step: 0.1 },
      { key: 'volume', label: 'Displaced volume', sym: '\\nabla', unit: 'm³', step: 100 },
      { key: 'lcb', label: 'Centre of buoyancy from L/2', sym: 'lcb', unit: '% L', step: 0.05, hint: 'Percent of L, positive forward of midship.' },
      { key: 'CM', label: 'Midship coefficient', sym: 'C_M', step: 0.005, hint: 'Midship section area ÷ (B·T). Typically 0.95–0.995.' },
    ],
    summary: (i, r) => [
      ['L × B', `${f(i.L)} × ${f(i.B)} m`],
      ['TF / TA', `${f(i.TF)} / ${f(i.TA)} m`],
      ['∇', `${f(i.volume, 0)} m³`],
      ['CB / CP', r ? `${f(r.CB, 4)} / ${f(r.CP, 4)}` : '—'],
      ['Fn', r ? f(r.Fn, 3) : '—'],
    ],
  },
  {
    id: 2,
    title: 'Friction',
    where: 'Wetted hull',
    blurb: 'The ITTC-1957 friction line applied to the wetted surface. S comes from the regression unless you have the hydrostatic value.',
    drives: ['RFk1'],
    fields: [
      { key: 'CWP', label: 'Waterplane coefficient', sym: 'C_{WP}', step: 0.005 },
      {
        key: 'SOverride', label: 'Wetted surface (optional)', sym: 'S', unit: 'm²', step: 10, optional: true,
        hint: 'Leave empty to use the regression.', auto: (r) => r.SFromRegression,
      },
      { key: 'rho', label: 'Sea water density', sym: '\\rho', unit: 'kg/m³', step: 1 },
      { key: 'nu', label: 'Kinematic viscosity', sym: '\\nu', unit: 'm²/s', step: 1e-8, hint: '1.1883 × 10⁻⁶ m²/s at 15 °C.' },
      { key: 'g', label: 'Gravity', sym: 'g', unit: 'm/s²', step: 0.01 },
    ],
    summary: (i, r) => [
      ['S', r ? `${f(r.S, 1)} m²` : '—'],
      ['Rn', r ? r.Rn.toExponential(3) : '—'],
      ['CF', r ? r.CF.toExponential(3) : '—'],
      ['RF', r ? kN(r.RF) : '—'],
      ['ρ', `${f(i.rho, 1)} kg/m³`],
    ],
  },
  {
    id: 3,
    title: 'Form factor',
    where: 'Afterbody run',
    blurb: 'Viscous drag above flat-plate friction, set by hull proportions, the length of run and the afterbody section shape.',
    drives: ['RFk1'],
    fields: [],
    summary: (i, r) => [
      ['Cstern', `${i.Cstern > 0 ? '+' : ''}${i.Cstern}`],
      ['c12', r ? f(r.c12, 4) : '—'],
      ['1 + k1', r ? f(r.onePlusK1, 4) : '—'],
      ['RF(1+k1)', r ? kN(r.RFk1) : '—'],
    ],
  },
  {
    id: 4,
    title: 'Appendages',
    where: 'Rudder & propeller',
    blurb: 'Each appendage has its own form factor 1 + k2, combined as an area-weighted (1 + k2)eq. A bow-thruster tunnel adds RBT.',
    drives: ['RAPP'],
    fields: [
      { key: 'thrusterD', label: 'Bow-thruster tunnel diameter', sym: 'd', unit: 'm', step: 0.1, hint: '0 = no tunnel.' },
      { key: 'thrusterCBTO', label: 'Tunnel opening coefficient', sym: 'C_{BTO}', step: 0.001, hint: '0.003 to 0.012.' },
    ],
    summary: (i, r) => [
      ['Appendages', `${i.appendages.length}`],
      ['SAPP', r ? `${f(r.SApp, 1)} m²` : '—'],
      ['(1+k2)eq', r ? f(r.onePlusK2eq, 3) : '—'],
      ['RAPP', r ? kN(r.RAPP, 2) : '—'],
    ],
  },
  {
    id: 5,
    title: 'Waves',
    where: 'Bow wave',
    blurb: 'Wave making and breaking, from c1, c2, c5, m1, m2 and λ. A fine entrance (small iE) gives a small c1.',
    drives: ['RW'],
    fields: [
      {
        key: 'iEOverride', label: 'Half angle of entrance (optional)', sym: 'i_E', unit: '°', step: 0.1, optional: true,
        hint: 'Leave empty to use the Holtrop–Mennen regression for iE.', auto: (r) => r.iEFromRegression,
      },
    ],
    summary: (i, r) => [
      ['iE', r ? `${f(r.iE)}°${i.iEOverride == null ? ' (regression)' : ''}` : '—'],
      ['c1 · c2 · c5', r ? f(r.c1 * r.c2 * r.c5, 4) : '—'],
      ['m1 / m2', r ? `${f(r.m1, 3)} / ${f(r.m2, 3)}` : '—'],
      ['RW', r ? kN(r.RW) : '—'],
    ],
  },
  {
    id: 6,
    title: 'Bulb & transom',
    where: 'Bulbous bow · transom stern',
    blurb: 'A deep bulb cancels part of the bow wave (c2 < 1); near the surface it adds RB. An immersed transom adds RTR until the flow clears it (FnT ≥ 5).',
    drives: ['RB', 'RTR'],
    fields: [
      { key: 'ABT', label: 'Bulb section area at FP', sym: 'A_{BT}', unit: 'm²', step: 0.5, hint: 'Enter 0 for a ship without a bulb.' },
      { key: 'hB', label: 'Bulb centre above keel', sym: 'h_B', unit: 'm', step: 0.1, hint: 'At most 0.6 TF.' },
      { key: 'AT', label: 'Immersed transom area', sym: 'A_T', unit: 'm²', step: 0.5, hint: 'Enter 0 for a stern clear of the water.' },
    ],
    summary: (i, r) => [
      ['ABT / hB', `${f(i.ABT)} m² / ${f(i.hB)} m`],
      ['AT', `${f(i.AT)} m²`],
      ['RB', r ? kN(r.RB, 3) : '—'],
      ['FnT', r ? f(r.FnT, 3) : '—'],
      ['RTR', r ? kN(r.RTR, 2) : '—'],
    ],
  },
  {
    id: 7,
    title: 'Correlation',
    where: 'Superstructure · hull roughness',
    blurb: 'The model–ship correlation allowance CA covers hull roughness (150 µm standard) and the still-air drag of the ship.',
    drives: ['RA'],
    fields: [
      { key: 'ksMicron', label: 'Hull roughness', sym: 'k_S', unit: 'µm', step: 10, hint: 'The method assumes 150 µm; other values add (0.105 kS^(1/3) − 0.005579)/L^(1/3).' },
    ],
    summary: (i, r) => [
      ['kS', `${f(i.ksMicron, 0)} µm`],
      ['c4', r ? f(r.c4, 4) : '—'],
      ['CA', r ? r.CA.toExponential(3) : '—'],
      ['RA', r ? kN(r.RA) : '—'],
    ],
  },
  {
    id: 8,
    title: 'Total & power',
    where: 'Engine · speed',
    blurb: 'Add the six components and multiply by speed for the effective power PE = RT V. Every formula takes V in m/s (1 kn = 0.5144 m/s).',
    drives: ['RFk1', 'RW', 'RA', 'RAPP', 'RB', 'RTR'],
    fields: [
      { key: 'designSpeed', label: 'Design speed', sym: 'V_s', unit: 'kn', step: 0.5 },
      { key: 'speedMin', label: 'Curve from', sym: 'V_{min}', unit: 'kn', step: 1 },
      { key: 'speedMax', label: 'Curve to', sym: 'V_{max}', unit: 'kn', step: 1 },
      { key: 'speedStep', label: 'Step', sym: '\\Delta V', unit: 'kn', step: 0.5 },
    ],
    summary: (i, r) => [
      ['Speed', `${f(i.designSpeed)} kn = ${f(i.designSpeed * 0.5144, 2)} m/s`],
      ['RT', r ? kN(r.RT) : '—'],
      ['PE', r ? `${f(r.PE / 1e3, 0)} kW` : '—'],
    ],
  },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
