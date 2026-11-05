import { Download } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HMResult } from '../engine/types';
import { fmt, kN, kW } from '../format';
import { COMPONENTS } from '../zones';

type Mode = 'resistance' | 'power';

const LINES = [
  { key: 'RT', name: 'Total resistance', color: '#1f2a33', width: 2.5 },
  { key: 'RFk1', name: 'Friction with form', color: '#3a74b8', width: 2 },
  { key: 'RW', name: 'Wave making', color: '#d36f45', width: 2 },
  { key: 'RA', name: 'Correlation', color: '#1f9e7f', width: 2 },
] as const;

export function SpeedCurve({ curve, designSpeed }: { curve: HMResult[]; designSpeed: number }) {
  const [mode, setMode] = useState<Mode>('resistance');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const data = curve.map((r) => ({
    v: r.speedKn,
    Fn: r.Fn,
    RT: r.RT / 1e3,
    RFk1: r.RFk1 / 1e3,
    RW: r.RW / 1e3,
    RA: r.RA / 1e3,
    PE: r.PE / 1e3,
  }));

  const csv = () => {
    const head = ['speed_kn', 'V_ms', 'Fn', 'RF_kN', '1+k1', 'RF(1+k1)_kN', 'RAPP_kN', 'RW_kN', 'RB_kN', 'RTR_kN', 'RA_kN', 'RT_kN', 'PE_kW'];
    const rows = curve.map((r) =>
      [r.speedKn, r.V, r.Fn, r.RF / 1e3, r.onePlusK1, r.RFk1 / 1e3, r.RAPP / 1e3, r.RW / 1e3, r.RB / 1e3, r.RTR / 1e3, r.RA / 1e3, r.RT / 1e3, r.PE / 1e3]
        .map((x) => +x.toPrecision(8))
        .join(','),
    );
    const blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'holtrop-mennen-resistance.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-labelledby="curve-h" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="curve-h" className="font-serif text-[22px] font-semibold text-ink">
          {mode === 'resistance' ? 'Resistance curve' : 'Effective power curve'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Seg value={mode} onChange={setMode} options={[['resistance', 'Resistance'], ['power', 'Power']]} />
          <Seg value={view} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} />
          <button type="button" onClick={csv} className="flex items-center gap-1 rounded-xl border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-accent hover:text-accent">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <>
          {mode === 'resistance' && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Legend">
              {LINES.map((l) => (
                <li key={l.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-4 rounded" style={{ background: l.color }} />
                  {l.name}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 22, right: 16, bottom: 18, left: 4 }}>
                <CartesianGrid stroke="#e9e6df" vertical={false} />
                <XAxis
                  dataKey="v"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 12, fill: '#52514e' }}
                  tickLine={false}
                  axisLine={{ stroke: '#c9c6bd' }}
                  label={{ value: 'Speed, knots', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#52514e' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#52514e' }}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickFormatter={(x: number) => x.toLocaleString('en-US')}
                  label={{ value: mode === 'resistance' ? 'kN' : 'kW', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#52514e' }}
                />
                <ReferenceLine x={designSpeed} stroke="#7a7974" strokeDasharray="4 4" label={{ value: 'design', position: 'top', fontSize: 11, fill: '#52514e' }} />
                <Tooltip content={<CurveTip mode={mode} />} cursor={{ stroke: '#7a7974', strokeWidth: 1 }} />
                {mode === 'resistance' ? (
                  LINES.map((l) => (
                    <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.width} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fcfcfb' }} isAnimationActive={false} />
                  ))
                ) : (
                  <Line type="monotone" dataKey="PE" name="P_E" stroke="#3a74b8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fcfcfb' }} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-right text-[11px] uppercase tracking-wider text-ink-3">
                <th className="py-1.5 text-left font-semibold">kn</th>
                <th className="py-1.5 font-semibold">Fn</th>
                {COMPONENTS.map((c) => (
                  <th key={c.key} className="py-1.5 font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="py-1.5 font-semibold">RT, kN</th>
                <th className="py-1.5 font-semibold">PE, kW</th>
              </tr>
            </thead>
            <tbody className="num">
              {curve.map((r) => (
                <tr key={r.speedKn} className={`border-b border-line/70 text-right ${Math.abs(r.speedKn - designSpeed) < 1e-9 ? 'bg-accent-soft font-semibold' : ''}`}>
                  <td className="py-1.5 text-left">{fmt(r.speedKn, r.speedKn % 1 ? 1 : 0)}</td>
                  <td>{fmt(r.Fn, 3)}</td>
                  {COMPONENTS.map((c) => (
                    <td key={c.key}>{kN(r[c.key], 1)}</td>
                  ))}
                  <td>{kN(r.RT, 0)}</td>
                  <td>{kW(r.PE)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-ink-3">Component columns in kN.</p>
        </div>
      )}
    </section>
  );
}

function CurveTip({ active, payload, mode }: { active?: boolean; payload?: { payload: Record<string, number> }[]; mode: Mode }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-semibold text-ink">
        {fmt(p.v, p.v % 1 ? 1 : 0)} kn <span className="font-normal text-ink-3">· Fn {fmt(p.Fn, 3)}</span>
      </div>
      {mode === 'resistance' ? (
        LINES.map((l) => (
          <div key={l.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className="inline-block h-[3px] w-3 rounded" style={{ background: l.color }} />
              {l.name}
            </span>
            <span className="num text-ink">{fmt(p[l.key], 1)} kN</span>
          </div>
        ))
      ) : (
        <div className="flex justify-between gap-4">
          <span className="text-ink-2">Effective power</span>
          <span className="num text-ink">{fmt(p.PE, 0)} kW</span>
        </div>
      )}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-0.5" role="group">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-2.5 py-0.5 text-[12px] font-medium ${value === v ? 'bg-accent text-white' : 'text-ink-2 hover:text-accent'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
