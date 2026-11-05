import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { HMResult } from '../engine/types';
import type { Issue } from '../engine/validity';
import { fmt, kN, kW } from '../format';
import { COMPONENTS, type ComponentKey } from '../zones';
import { Tex } from './Tex';

export function Summary({
  r,
  onHoverComponent,
}: {
  r: HMResult;
  onHoverComponent: (k: ComponentKey | null) => void;
}) {
  const total = r.RT;
  return (
    <section aria-labelledby="sum-h" className="card p-5 sm:p-6">
      <h2 id="sum-h" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        Result at {fmt(r.speedKn, r.speedKn % 1 ? 1 : 0)} knots · V = {fmt(r.V, 2)} m/s
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Stat label="Total resistance" tex="R_T" value={kN(r.RT)} unit="kN" big />
        <Stat label="Effective power" tex="P_E = R_T V" value={kW(r.PE)} unit="kW" big />
        <Stat label="Froude number" tex="F_n" value={fmt(r.Fn, 3)} />
        <Stat label="Block / prismatic" tex="C_B,\ C_P" value={`${fmt(r.CB, 3)} / ${fmt(r.CP, 3)}`} />
      </div>

      <div className="mt-5">
        <div className="flex h-7 w-full overflow-hidden rounded-full" role="img" aria-label="Share of each resistance component">
          {COMPONENTS.map((c) => {
            const v = r[c.key];
            const share = total > 0 ? v / total : 0;
            if (share <= 0.0005) return null;
            return (
              <div
                key={c.key}
                className="group relative h-full border-r-2 border-surface last:border-r-0 transition-[filter] hover:brightness-110"
                style={{ width: `${share * 100}%`, background: c.color }}
                onPointerEnter={() => onHoverComponent(c.key)}
                onPointerLeave={() => onHoverComponent(null)}
                title={`${c.name}: ${kN(v)} kN (${fmt(share * 100, 1)} %)`}
              />
            );
          })}
        </div>
        <table className="mt-3 w-full text-[13px]">
          <caption className="sr-only">Resistance components at the design speed</caption>
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
              <th className="py-1.5 font-semibold">Component</th>
              <th className="py-1.5 text-right font-semibold">kN</th>
              <th className="py-1.5 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENTS.map((c) => (
              <tr
                key={c.key}
                className="border-b border-line/70 hover:bg-paper"
                onPointerEnter={() => onHoverComponent(c.key)}
                onPointerLeave={() => onHoverComponent(null)}
              >
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                    <span className="text-ink">{c.name},</span>
                    <Tex tex={c.tex} className="text-ink-2" />
                  </span>
                </td>
                <td className="num py-1.5 text-right text-ink">{kN(r[c.key], r[c.key] < 1000 ? 2 : 1)}</td>
                <td className="num py-1.5 text-right text-ink-2">{fmt((r[c.key] / total) * 100, 1)} %</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2">
                Total, <Tex tex="R_T" />
              </td>
              <td className="num py-2 text-right">{kN(r.RT)}</td>
              <td className="num py-2 text-right">100 %</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, tex, value, unit, big }: { label: string; tex: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 text-[12px] text-ink-3">
        {label} <Tex tex={tex} className="text-ink-2" />
      </div>
      <div className={`num font-serif font-semibold text-ink ${big ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>
        {value}
        {unit && <span className="ml-1 font-sans text-base font-medium text-ink-2">{unit}</span>}
      </div>
    </div>
  );
}

export function Issues({ issues, onZone }: { issues: Issue[]; onZone: (z: NonNullable<Issue['zone']>) => void }) {
  if (!issues.length) return null;
  const icon = { error: XCircle, warn: AlertTriangle, info: CheckCircle2 } as const;
  const tone = {
    error: 'border-red-200 bg-red-50 text-red-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-950',
    info: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  } as const;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Checks">
      {issues.map((i, n) => {
        const Icon = icon[i.severity];
        return (
          <li key={n} className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] ${tone[i.severity]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" aria-label={i.severity} />
            <span className="flex-1">{i.message}</span>
            {i.zone && (
              <button type="button" className="shrink-0 text-[12px] font-semibold underline underline-offset-2" onClick={() => onZone(i.zone!)}>
                Edit
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MethodNote() {
  return (
    <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-3">
      <Info size={14} className="mt-0.5 shrink-0" />
      Holtrop &amp; Mennen (1982) regression set throughout, as in the reference notes. Speeds converted with 1 kn = 0.5144 m/s. Treat
      results outside the fitted ranges as a rough guide only.
    </p>
  );
}
