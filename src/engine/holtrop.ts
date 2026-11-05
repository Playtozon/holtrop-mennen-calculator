/**
 * Holtrop–Mennen (1982) resistance estimate.
 *
 *   R_T = R_F (1 + k1) + R_APP + R_W + R_B + R_TR + R_A
 *
 * Follows the eight-step procedure and branch conditions of the reference
 * notes exactly (1982 set throughout; the 1984 revisions are not mixed in).
 * All forces are in N, power in W, speed V in m/s.
 */
import type { HMInputs, HMResult } from './types';

/** 1 knot in m/s, as used in the reference notes. */
export const KNOT = 0.5144;

/** Area-weighted equivalent appendage form factor (1 + k2)_eq. */
export function equivalentK2(apps: HMInputs['appendages']): { SApp: number; onePlusK2eq: number } {
  const SApp = apps.reduce((s, a) => s + Math.max(0, a.area), 0);
  if (SApp <= 0) return { SApp: 0, onePlusK2eq: 0 };
  const weighted = apps.reduce((s, a) => s + Math.max(0, a.area) * a.onePlusK2, 0);
  return { SApp, onePlusK2eq: weighted / SApp };
}

/** Speed-independent hull-form quantities (steps 1–3 and the wave multipliers). */
export function hullForm(inp: HMInputs) {
  const { L, B, TF, TA, volume, lcb, CM, CWP, ABT, hB, AT, Cstern } = inp;
  const T = (TF + TA) / 2;
  const CB = volume / (L * B * T);
  const CP = CB / CM;
  const LR = L * (1 - CP + (0.06 * CP * lcb) / (4 * CP - 1));

  // Step 2 — wetted surface (regression unless the user supplies hydrostatics)
  const SFromRegression =
    L * (2 * T + B) * Math.sqrt(CM) *
      (0.453 + 0.4425 * CB - 0.2862 * CM - 0.003467 * (B / T) + 0.3696 * CWP) +
    (2.38 * ABT) / CB;
  const S = inp.SOverride != null && inp.SOverride > 0 ? inp.SOverride : SFromRegression;

  // Step 3 — form factor
  const TL = T / L;
  let c12: number;
  let c12Branch: string;
  if (TL > 0.05) {
    c12 = Math.pow(TL, 0.2228446);
    c12Branch = 'T/L > 0.05 → c12 = (T/L)^0.2228446';
  } else if (TL > 0.02) {
    c12 = 48.2 * Math.pow(TL - 0.02, 2.078) + 0.479948;
    c12Branch = '0.02 < T/L < 0.05 → c12 = 48.20 (T/L − 0.02)^2.078 + 0.479948';
  } else {
    c12 = 0.479948;
    c12Branch = 'T/L < 0.02 → c12 = 0.479948';
  }
  const c13 = 1 + 0.003 * Cstern;
  const onePlusK1 =
    c13 *
    (0.93 +
      c12 *
        Math.pow(B / LR, 0.92497) *
        Math.pow(0.95 - CP, -0.521448) *
        Math.pow(1 - CP + 0.0225 * lcb, 0.6906));

  // Step 5 — wave multipliers
  const BL = B / L;
  let c7: number;
  let c7Branch: string;
  if (BL < 0.11) {
    c7 = 0.229577 * Math.pow(BL, 0.33333);
    c7Branch = 'B/L < 0.11 → c7 = 0.229577 (B/L)^0.33333';
  } else if (BL <= 0.25) {
    c7 = BL;
    c7Branch = '0.11 < B/L < 0.25 → c7 = B/L';
  } else {
    c7 = 0.5 - 0.0625 * (L / B);
    c7Branch = 'B/L > 0.25 → c7 = 0.5 − 0.0625 L/B';
  }

  const iEFromRegression =
    1 +
    89 *
      Math.exp(
        -Math.pow(L / B, 0.80856) *
          Math.pow(1 - CWP, 0.30484) *
          Math.pow(1 - CP - 0.0225 * lcb, 0.6367) *
          Math.pow(LR / B, 0.34574) *
          Math.pow((100 * volume) / (L * L * L), 0.16302),
      );
  const iE = inp.iEOverride != null && inp.iEOverride > 0 ? inp.iEOverride : iEFromRegression;

  const c1 =
    2223105 * Math.pow(c7, 3.78613) * Math.pow(T / B, 1.07961) * Math.pow(90 - iE, -1.37565);

  const c3 =
    ABT > 0 ? (0.56 * Math.pow(ABT, 1.5)) / (B * T * (0.31 * Math.sqrt(ABT) + TF - hB)) : 0;
  const c2 = Math.exp(-1.89 * Math.sqrt(c3));
  const c5 = 1 - (0.8 * AT) / (B * T * CM);

  const L3V = (L * L * L) / volume;
  let c15: number;
  let c15Branch: string;
  if (L3V < 512) {
    c15 = -1.69385;
    c15Branch = 'L³/∇ < 512 → c15 = −1.69385';
  } else if (L3V <= 1727) {
    c15 = -1.69385 + (L / Math.cbrt(volume) - 8.0) / 2.36;
    c15Branch = '512 < L³/∇ < 1727 → c15 = −1.69385 + (L/∇^(1/3) − 8.0)/2.36';
  } else {
    c15 = 0;
    c15Branch = 'L³/∇ > 1727 → c15 = 0';
  }

  let c16: number;
  let c16Branch: string;
  if (CP < 0.8) {
    c16 = 8.07981 * CP - 13.8673 * CP * CP + 6.984388 * CP * CP * CP;
    c16Branch = 'CP < 0.80 → c16 = 8.07981 CP − 13.8673 CP² + 6.984388 CP³';
  } else {
    c16 = 1.73014 - 0.7067 * CP;
    c16Branch = 'CP > 0.80 → c16 = 1.73014 − 0.7067 CP';
  }
  const m1 =
    (0.0140407 * L) / T - (1.75254 * Math.cbrt(volume)) / L - 4.79323 * (B / L) - c16;

  let lambda: number;
  let lambdaBranch: string;
  if (L / B < 12) {
    lambda = 1.446 * CP - 0.03 * (L / B);
    lambdaBranch = 'L/B < 12 → λ = 1.446 CP − 0.03 L/B';
  } else {
    lambda = 1.446 * CP - 0.36;
    lambdaBranch = 'L/B > 12 → λ = 1.446 CP − 0.36';
  }

  // Step 7 — correlation allowance (speed-independent)
  const TFL = TF / L;
  const c4 = TFL <= 0.04 ? TFL : 0.04;
  const c4Branch = TFL <= 0.04 ? 'TF/L ≤ 0.04 → c4 = TF/L' : 'TF/L > 0.04 → c4 = 0.04';
  const ks = Math.max(0, inp.ksMicron) * 1e-6;
  const dCAks = ks > 0 ? (0.105 * Math.cbrt(ks) - 0.005579) / Math.cbrt(L) : 0;
  const CA =
    0.006 * Math.pow(L + 100, -0.16) -
    0.00205 +
    0.003 * Math.sqrt(L / 7.5) * Math.pow(CB, 4) * c2 * (0.04 - c4) +
    dCAks;

  const { SApp, onePlusK2eq } = equivalentK2(inp.appendages);

  return {
    T, CB, CP, LR, S, SFromRegression, TL, c12, c12Branch, c13, onePlusK1,
    BL, c7, c7Branch, iE, iEFromRegression, c1, c3, c2, c5,
    L3V, c15, c15Branch, c16, c16Branch, m1, lambda, lambdaBranch,
    c4, c4Branch, CA, dCAks, SApp, onePlusK2eq,
  };
}

/** Full eight-step calculation at one speed (knots). */
export function holtropMennen(inp: HMInputs, speedKn: number): HMResult {
  const h = hullForm(inp);
  const { L, B, TF, volume, CWP, ABT, hB, AT, rho, nu, g } = inp;

  // Step 1
  const V = speedKn * KNOT;
  const Fn = V / Math.sqrt(g * L);

  // Step 2
  const Rn = (V * L) / nu;
  const CF = 0.075 / Math.pow(Math.log10(Rn) - 2, 2);
  const q = 0.5 * rho * V * V;
  const RF = q * h.S * CF;

  // Step 3
  const RFk1 = RF * h.onePlusK1;

  // Step 4
  const RBT = rho * V * V * Math.PI * inp.thrusterD * inp.thrusterD * inp.thrusterCBTO;
  const RAPP = q * h.SApp * h.onePlusK2eq * CF + RBT;

  // Step 5
  const d = -0.9;
  const m2 = h.c15 * h.CP * h.CP * Math.exp(-0.1 * Math.pow(Fn, -2));
  const weight = volume * rho * g;
  const waveExponent = h.m1 * Math.pow(Fn, d) + m2 * Math.cos(h.lambda * Math.pow(Fn, -2));
  const RW = V > 0 ? h.c1 * h.c2 * h.c5 * weight * Math.exp(waveExponent) : 0;

  // Step 6 — bulb
  let PB = 0;
  let Fni = 0;
  let RB = 0;
  if (ABT > 0 && V > 0) {
    PB = (0.56 * Math.sqrt(ABT)) / (TF - 1.5 * hB);
    Fni = V / Math.sqrt(g * (TF - hB - 0.25 * Math.sqrt(ABT)) + 0.15 * V * V);
    RB =
      (0.11 * Math.exp(-3 * Math.pow(PB, -2)) * Math.pow(Fni, 3) * Math.pow(ABT, 1.5) * rho * g) /
      (1 + Fni * Fni);
  }

  // Step 6 — transom
  let FnT = Infinity;
  let c6 = 0;
  let c6Branch = 'A_T = 0 → no immersed transom, c6 = 0';
  if (AT > 0) {
    FnT = V / Math.sqrt((2 * g * AT) / (B + B * CWP));
    if (FnT < 5) {
      c6 = 0.2 * (1 - 0.2 * FnT);
      c6Branch = 'FnT < 5 → c6 = 0.2 (1 − 0.2 FnT)';
    } else {
      c6 = 0;
      c6Branch = 'FnT ≥ 5 → c6 = 0';
    }
  }
  const RTR = q * AT * c6;

  // Step 7
  const RA = q * h.S * h.CA;

  // Step 8
  const RT = RFk1 + RAPP + RW + RB + RTR + RA;
  const PE = RT * V;

  return {
    speedKn, V, T: h.T, CB: h.CB, CP: h.CP, Fn, LR: h.LR,
    S: h.S, SFromRegression: h.SFromRegression, Rn, CF, q, RF,
    TL: h.TL, c12: h.c12, c12Branch: h.c12Branch, c13: h.c13, onePlusK1: h.onePlusK1, RFk1,
    SApp: h.SApp, onePlusK2eq: h.onePlusK2eq, RBT, RAPP,
    BL: h.BL, c7: h.c7, c7Branch: h.c7Branch, iE: h.iE, iEFromRegression: h.iEFromRegression,
    c1: h.c1, c3: h.c3, c2: h.c2, c5: h.c5, L3V: h.L3V, c15: h.c15, c15Branch: h.c15Branch,
    c16: h.c16, c16Branch: h.c16Branch, m1: h.m1, m2, lambda: h.lambda, lambdaBranch: h.lambdaBranch,
    d, weight, waveExponent, RW,
    PB, Fni, RB, FnT, c6, c6Branch, RTR,
    c4: h.c4, c4Branch: h.c4Branch, CA: h.CA, dCAks: h.dCAks, RA,
    RT, PE,
  };
}

/** Speeds (knots) for the resistance curve, always including the design speed. */
export function speedGrid(inp: HMInputs): number[] {
  const { speedMin, speedMax, speedStep, designSpeed } = inp;
  const out: number[] = [];
  if (speedStep > 0 && speedMax >= speedMin && speedMin > 0) {
    const n = Math.min(400, Math.floor((speedMax - speedMin) / speedStep + 1e-9));
    for (let i = 0; i <= n; i++) out.push(+(speedMin + i * speedStep).toFixed(6));
  }
  if (designSpeed > 0 && !out.some((s) => Math.abs(s - designSpeed) < 1e-9)) out.push(designSpeed);
  return out.sort((a, b) => a - b);
}

export function resistanceCurve(inp: HMInputs): HMResult[] {
  return speedGrid(inp).map((s) => holtropMennen(inp, s));
}
