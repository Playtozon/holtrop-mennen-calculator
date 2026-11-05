/** One appendage with its wetted area and form factor (1 + k2). */
export interface Appendage {
  id: string;
  name: string;
  /** Wetted area S_APP, m² */
  area: number;
  /** Form factor 1 + k2 (not k2 itself) */
  onePlusK2: number;
}

/**
 * All inputs for the Holtrop–Mennen (1982) estimate.
 * Units: SI (m, m², m³, kg/m³, m²/s, m/s²) except speeds in knots and lcb in % of L.
 */
export interface HMInputs {
  /** Waterline length L, m */
  L: number;
  /** Moulded breadth B, m */
  B: number;
  /** Draught forward T_F, m */
  TF: number;
  /** Draught aft T_A, m */
  TA: number;
  /** Displaced volume ∇, m³ */
  volume: number;
  /** Longitudinal centre of buoyancy, % of L from L/2, positive forward */
  lcb: number;
  /** Midship section coefficient C_M */
  CM: number;
  /** Waterplane area coefficient C_WP */
  CWP: number;
  /** Transverse bulb area at FP, A_BT, m² */
  ABT: number;
  /** Height of centre of A_BT above keel, h_B, m */
  hB: number;
  /** Immersed transom area at rest, A_T, m² */
  AT: number;
  /** Afterbody form parameter C_stern: −25 pram+gondola, −10 V, 0 normal, +10 U (Hogner) */
  Cstern: number;
  /** Appendages (rudder, brackets, bilge keels, …) */
  appendages: Appendage[];
  /** Bow-thruster tunnel diameter d, m (0 = none) */
  thrusterD: number;
  /** Bow-thruster tunnel opening coefficient C_BTO (0.003 – 0.012) */
  thrusterCBTO: number;
  /** Half angle of entrance i_E, degrees. null = estimate from the regression */
  iEOverride: number | null;
  /** Wetted surface S, m². null = estimate from the regression */
  SOverride: number | null;
  /** Hull roughness k_S, µm (method assumes 150 µm) */
  ksMicron: number;
  /** Sea water density ρ, kg/m³ */
  rho: number;
  /** Kinematic viscosity ν, m²/s */
  nu: number;
  /** Acceleration due to gravity g, m/s² */
  g: number;
  /** Design speed, knots */
  designSpeed: number;
  /** Speed range for the curve, knots */
  speedMin: number;
  speedMax: number;
  speedStep: number;
}

export type BranchNote = string;

export interface StepRow {
  symbol: string;
  value: number;
  unit?: string;
  note?: BranchNote;
  digits?: number;
}

export interface HMResult {
  speedKn: number;
  // Step 1 — hull form
  V: number;
  T: number;
  CB: number;
  CP: number;
  Fn: number;
  LR: number;
  // Step 2 — friction
  S: number;
  SFromRegression: number;
  Rn: number;
  CF: number;
  q: number;
  RF: number;
  // Step 3 — form factor
  TL: number;
  c12: number;
  c12Branch: string;
  c13: number;
  onePlusK1: number;
  RFk1: number;
  // Step 4 — appendages
  SApp: number;
  onePlusK2eq: number;
  RBT: number;
  RAPP: number;
  // Step 5 — waves
  BL: number;
  c7: number;
  c7Branch: string;
  iE: number;
  iEFromRegression: number;
  c1: number;
  c3: number;
  c2: number;
  c5: number;
  L3V: number;
  c15: number;
  c15Branch: string;
  c16: number;
  c16Branch: string;
  m1: number;
  m2: number;
  lambda: number;
  lambdaBranch: string;
  d: number;
  weight: number;
  waveExponent: number;
  RW: number;
  // Step 6 — bulb & transom
  PB: number;
  Fni: number;
  RB: number;
  FnT: number;
  c6: number;
  c6Branch: string;
  RTR: number;
  // Step 7 — correlation
  c4: number;
  c4Branch: string;
  CA: number;
  dCAks: number;
  RA: number;
  // Step 8 — totals
  RT: number;
  PE: number;
}
