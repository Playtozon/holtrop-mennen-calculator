import type { HMInputs, HMResult } from './engine/types';

export type ComponentKey = 'RFk1' | 'RW' | 'RA' | 'RAPP' | 'RB' | 'RTR';

/** Resistance components in fixed categorical order (stack order = colour slot order). */
export const COMPONENTS: { key: ComponentKey; label: string; tex: string; name: string; color: string; zones: ZoneId[] }[] = [
  { key: 'RFk1', label: 'RF(1+k1)', tex: 'R_F(1+k_1)', name: 'Friction with form', color: 'var(--color-c-rf)', zones: ['hull', 'midship', 'waterline'] },
  { key: 'RW', label: 'RW', tex: 'R_W', name: 'Wave making', color: 'var(--color-c-rw)', zones: ['speed', 'waterplane', 'hull'] },
  { key: 'RA', label: 'RA', tex: 'R_A', name: 'Correlation', color: 'var(--color-c-ra)', zones: ['environment'] },
  { key: 'RAPP', label: 'RAPP', tex: 'R_{APP}', name: 'Appendages', color: 'var(--color-c-rapp)', zones: ['appendages'] },
  { key: 'RB', label: 'RB', tex: 'R_B', name: 'Bulbous bow', color: 'var(--color-c-rb)', zones: ['bow'] },
  { key: 'RTR', label: 'RTR', tex: 'R_{TR}', name: 'Immersed transom', color: 'var(--color-c-rtr)', zones: ['transom'] },
];

export type ZoneId =
  | 'hull'
  | 'midship'
  | 'waterline'
  | 'waterplane'
  | 'bow'
  | 'transom'
  | 'appendages'
  | 'environment'
  | 'speed';

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
  short: string;
  blurb: string;
  drives: ComponentKey[];
  /** Extra formula terms this zone feeds */
  terms: string;
  fields: FieldDef[];
  /** Key values shown in the hover card */
  summary: (i: HMInputs, r: HMResult | null) => [string, string][];
}

const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—');

export const ZONES: ZoneDef[] = [
  {
    id: 'hull',
    title: 'Hull body',
    short: 'Hull',
    blurb: 'Main dimensions and the underwater volume. They set CB, CP, the length of run LR and the wetted surface S.',
    drives: ['RFk1', 'RW'],
    terms: 'C_B, C_P, L_R, S, 1+k_1, m_1',
    fields: [
      { key: 'L', label: 'Waterline length', sym: 'L', unit: 'm', step: 1 },
      { key: 'volume', label: 'Displaced volume', sym: '\\nabla', unit: 'm³', step: 100 },
      { key: 'lcb', label: 'Centre of buoyancy from L/2', sym: 'lcb', unit: '% L', step: 0.05, hint: 'Percent of L, positive forward of midship.' },
      {
        key: 'SOverride', label: 'Wetted surface (optional)', sym: 'S', unit: 'm²', step: 10, optional: true,
        hint: 'Leave empty to use the regression. Enter the hydrostatic value if you have it.', auto: (r) => r.SFromRegression,
      },
    ],
    summary: (i, r) => [
      ['L', `${f(i.L)} m`],
      ['∇', `${f(i.volume, 0)} m³`],
      ['lcb', `${f(i.lcb)} % L`],
      ['CB / CP', r ? `${f(r.CB, 4)} / ${f(r.CP, 4)}` : '—'],
      ['S', r ? `${f(r.S, 1)} m²` : '—'],
    ],
  },
  {
    id: 'midship',
    title: 'Midship section',
    short: 'Midship',
    blurb: 'Breadth and the fullness of the midship section. CM converts CB into the prismatic coefficient CP = CB/CM.',
    drives: ['RFk1', 'RW'],
    terms: 'C_P, B/L_R, c_7, c_5',
    fields: [
      { key: 'B', label: 'Moulded breadth', sym: 'B', unit: 'm', step: 0.1 },
      { key: 'CM', label: 'Midship coefficient', sym: 'C_M', step: 0.005, hint: 'Midship section area ÷ (B·T). Typically 0.95–0.995.' },
    ],
    summary: (i, r) => [
      ['B', `${f(i.B)} m`],
      ['CM', f(i.CM, 3)],
      ['L/B', f(i.L / i.B)],
      ['B/T', r ? f(i.B / r.T) : '—'],
    ],
  },
  {
    id: 'waterline',
    title: 'Draughts',
    short: 'Draught',
    blurb: 'Forward and aft draught. The mean draught T = (TF + TA)/2 enters the form factor and wave terms; TF drives the bulb terms and c4.',
    drives: ['RFk1', 'RW', 'RB', 'RA'],
    terms: 'T, c_{12}, c_1, c_3, P_B, c_4',
    fields: [
      { key: 'TF', label: 'Draught forward', sym: 'T_F', unit: 'm', step: 0.1 },
      { key: 'TA', label: 'Draught aft', sym: 'T_A', unit: 'm', step: 0.1 },
    ],
    summary: (i, r) => [
      ['TF / TA', `${f(i.TF)} / ${f(i.TA)} m`],
      ['T (mean)', r ? `${f(r.T)} m` : '—'],
      ['T/L', r ? f(r.TL, 4) : '—'],
    ],
  },
  {
    id: 'waterplane',
    title: 'Waterplane & entrance',
    short: 'Waterplane',
    blurb: 'Waterplane fullness and the half angle of entrance at the bow. A fine entrance (small iE) gives a small c1 and less wave making.',
    drives: ['RW', 'RTR'],
    terms: 'S, i_E, c_1, F_{nT}',
    fields: [
      { key: 'CWP', label: 'Waterplane coefficient', sym: 'C_{WP}', step: 0.005 },
      {
        key: 'iEOverride', label: 'Half angle of entrance (optional)', sym: 'i_E', unit: '°', step: 0.1, optional: true,
        hint: 'Leave empty to use the Holtrop–Mennen regression for iE.', auto: (r) => r.iEFromRegression,
      },
    ],
    summary: (i, r) => [
      ['CWP', f(i.CWP, 3)],
      ['iE', r ? `${f(r.iE)}°${i.iEOverride == null ? ' (regression)' : ''}` : '—'],
    ],
  },
  {
    id: 'bow',
    title: 'Bulbous bow',
    short: 'Bulb',
    blurb: 'Transverse bulb area at the forward perpendicular and the height of its centre. A deep bulb cancels part of the bow wave (c2 < 1); near the surface it adds RB.',
    drives: ['RB', 'RW', 'RA'],
    terms: 'c_3, c_2, P_B, F_{ni}',
    fields: [
      { key: 'ABT', label: 'Bulb section area at FP', sym: 'A_{BT}', unit: 'm²', step: 0.5, hint: 'Enter 0 for a ship without a bulb.' },
      { key: 'hB', label: 'Bulb centre above keel', sym: 'hB', unit: 'm', step: 0.1, hint: 'At most 0.6 TF.' },
    ],
    summary: (i, r) => [
      ['ABT', `${f(i.ABT)} m²`],
      ['hB', `${f(i.hB)} m`],
      ['c2', r ? f(r.c2, 4) : '—'],
      ['PB', r ? f(r.PB, 4) : '—'],
    ],
  },
  {
    id: 'transom',
    title: 'Transom & stern shape',
    short: 'Transom',
    blurb: 'Immersed transom area at rest and the afterbody section shape. The transom adds RTR until the flow clears it (FnT ≥ 5); Cstern scales the form factor.',
    drives: ['RTR', 'RW', 'RFk1'],
    terms: 'c_5, c_6, F_{nT}, c_{13}',
    fields: [{ key: 'AT', label: 'Immersed transom area', sym: 'A_T', unit: 'm²', step: 0.5, hint: 'Enter 0 for a stern clear of the water.' }],
    summary: (i, r) => [
      ['AT', `${f(i.AT)} m²`],
      ['Cstern', `${i.Cstern > 0 ? '+' : ''}${i.Cstern}`],
      ['FnT', r ? f(r.FnT, 3) : '—'],
      ['c5', r ? f(r.c5, 4) : '—'],
    ],
  },
  {
    id: 'appendages',
    title: 'Rudder & appendages',
    short: 'Appendages',
    blurb: 'Each appendage has its own form factor 1 + k2; they are combined as an area-weighted (1 + k2)eq. A bow-thruster tunnel adds RBT.',
    drives: ['RAPP'],
    terms: 'S_{APP}, (1+k_2)_{eq}, R_{BT}',
    fields: [
      { key: 'thrusterD', label: 'Bow-thruster tunnel diameter', sym: 'd', unit: 'm', step: 0.1, hint: '0 = no tunnel.' },
      { key: 'thrusterCBTO', label: 'Tunnel opening coefficient', sym: 'C_{BTO}', step: 0.001, hint: '0.003 to 0.012.' },
    ],
    summary: (i, r) => [
      ['Appendages', `${i.appendages.length}`],
      ['SAPP', r ? `${f(r.SApp, 1)} m²` : '—'],
      ['(1+k2)eq', r ? f(r.onePlusK2eq, 3) : '—'],
    ],
  },
  {
    id: 'environment',
    title: 'Correlation & sea water',
    short: 'Water',
    blurb: 'Hull roughness and still-air drag are lumped into the correlation allowance CA. Water properties apply to every component.',
    drives: ['RA'],
    terms: 'C_A, \\rho, \\nu, g',
    fields: [
      { key: 'ksMicron', label: 'Hull roughness', sym: 'k_S', unit: 'µm', step: 10, hint: 'The method assumes 150 µm; other values add (0.105 kS^(1/3) − 0.005579)/L^(1/3).' },
      { key: 'rho', label: 'Sea water density', sym: '\\rho', unit: 'kg/m³', step: 1 },
      { key: 'nu', label: 'Kinematic viscosity', sym: '\\nu', unit: 'm²/s', step: 1e-8, hint: '1.1883 × 10⁻⁶ m²/s at 15 °C.' },
      { key: 'g', label: 'Gravity', sym: 'g', unit: 'm/s²', step: 0.01 },
    ],
    summary: (i, r) => [
      ['ρ', `${f(i.rho, 1)} kg/m³`],
      ['ν', `${i.nu.toExponential(4)} m²/s`],
      ['CA', r ? r.CA.toExponential(3) : '—'],
    ],
  },
  {
    id: 'speed',
    title: 'Speed',
    short: 'Speed',
    blurb: 'Design speed for the detailed breakdown and the range for the resistance curve. Every formula takes V in m/s (1 kn = 0.5144 m/s).',
    drives: ['RW', 'RFk1', 'RB', 'RTR'],
    terms: 'V, F_n, R_n',
    fields: [
      { key: 'designSpeed', label: 'Design speed', sym: 'V_s', unit: 'kn', step: 0.5 },
      { key: 'speedMin', label: 'Curve from', sym: 'V_{min}', unit: 'kn', step: 1 },
      { key: 'speedMax', label: 'Curve to', sym: 'V_{max}', unit: 'kn', step: 1 },
      { key: 'speedStep', label: 'Step', sym: '\\Delta V', unit: 'kn', step: 0.5 },
    ],
    summary: (i, r) => [
      ['Design', `${f(i.designSpeed)} kn = ${f(i.designSpeed * 0.5144, 2)} m/s`],
      ['Fn', r ? f(r.Fn, 4) : '—'],
      ['Range', `${f(i.speedMin)}–${f(i.speedMax)} kn`],
    ],
  },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
