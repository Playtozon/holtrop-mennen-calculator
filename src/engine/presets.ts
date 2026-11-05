import type { HMInputs } from './types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  inputs: HMInputs;
}

const base = {
  rho: 1025,
  nu: 1.1883e-6,
  g: 9.81,
  ksMicron: 150,
  thrusterD: 0,
  thrusterCBTO: 0.003,
  iEOverride: null,
  SOverride: null,
} satisfies Partial<HMInputs>;

/** The worked example from the reference notes (Holtrop & Mennen 1982). */
export const WORKED_EXAMPLE: HMInputs = {
  ...base,
  L: 205,
  B: 32,
  TF: 10,
  TA: 10,
  volume: 37500,
  lcb: -0.75,
  CM: 0.98,
  CWP: 0.75,
  ABT: 20,
  hB: 4,
  AT: 16,
  Cstern: 10,
  appendages: [{ id: 'a1', name: 'Rudder behind stern', area: 50, onePlusK2: 1.5 }],
  designSpeed: 25,
  speedMin: 15,
  speedMax: 29,
  speedStep: 2,
};

/**
 * A typical full-form bulk carrier. Values are illustrative, chosen to sit in the
 * tanker / bulk-carrier validity row; they are not measured from any lines plan.
 */
export const BULK_CARRIER: HMInputs = {
  ...base,
  L: 180,
  B: 32.2,
  TF: 11.5,
  TA: 11.5,
  volume: 54600,
  lcb: 2.5,
  CM: 0.995,
  CWP: 0.88,
  ABT: 12,
  hB: 4.5,
  AT: 2,
  Cstern: 0,
  appendages: [{ id: 'a1', name: 'Rudder behind stern', area: 40, onePlusK2: 1.4 }],
  designSpeed: 14,
  speedMin: 8,
  speedMax: 16,
  speedStep: 1,
};

export const PRESETS: Preset[] = [
  {
    id: 'example',
    name: 'Worked example (1982 paper)',
    description: '205 m single-screw ship, 25 kn. Reproduces 1792 kN / 23 040 kW.',
    inputs: WORKED_EXAMPLE,
  },
  {
    id: 'bulk',
    name: 'Bulk carrier (typical values)',
    description: 'Illustrative 180 m full-form bulk carrier, CB ≈ 0.82, 14 kn.',
    inputs: BULK_CARRIER,
  },
];

/** Appendage form factors 1 + k2 from Holtrop and Mennen (1982). */
export const APPENDAGE_TYPES: { name: string; onePlusK2: number; range: string }[] = [
  { name: 'Rudder behind skeg', onePlusK2: 1.75, range: '1.5 – 2.0' },
  { name: 'Rudder behind stern', onePlusK2: 1.4, range: '1.3 – 1.5' },
  { name: 'Twin-screw balance rudders', onePlusK2: 2.8, range: '2.8' },
  { name: 'Shaft brackets', onePlusK2: 3.0, range: '3.0' },
  { name: 'Skeg', onePlusK2: 1.75, range: '1.5 – 2.0' },
  { name: 'Strut bossings', onePlusK2: 3.0, range: '3.0' },
  { name: 'Hull bossings', onePlusK2: 2.0, range: '2.0' },
  { name: 'Shafts', onePlusK2: 3.0, range: '2.0 – 4.0' },
  { name: 'Stabiliser fins', onePlusK2: 2.8, range: '2.8' },
  { name: 'Dome', onePlusK2: 2.7, range: '2.7' },
  { name: 'Bilge keels', onePlusK2: 1.4, range: '1.4' },
];
