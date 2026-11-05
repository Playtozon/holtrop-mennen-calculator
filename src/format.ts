export const fmt = (x: number, digits = 1) =>
  Number.isFinite(x)
    ? x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

/** Significant-figure formatting for intermediate coefficients. */
export const sig = (x: number, s = 4) => {
  if (!Number.isFinite(x)) return x === Infinity ? '∞' : '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-3) return x.toExponential(s - 1);
  const d = Math.max(0, s - 1 - Math.floor(Math.log10(a)));
  return x.toLocaleString('en-US', { minimumFractionDigits: Math.min(d, 6), maximumFractionDigits: Math.min(d, 6) });
};

export const kN = (n: number, d = 1) => fmt(n / 1e3, d);
export const kW = (w: number, d = 0) => fmt(w / 1e3, d);
