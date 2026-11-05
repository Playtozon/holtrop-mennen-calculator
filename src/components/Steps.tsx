import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { HMInputs, HMResult } from '../engine/types';
import { fmt, kN, kW, sig } from '../format';
import { Tex } from './Tex';

type Row = [tex: string, value: string, note?: string];
interface Step {
  n: number;
  title: string;
  summary: string;
  formulas: string[];
  rows: Row[];
}

function buildSteps(i: HMInputs, r: HMResult): Step[] {
  const fs = (x: number, s = 4) => sig(x, s);
  return [
    {
      n: 1,
      title: 'Hull form',
      summary: `C_B = \\text{${fs(r.CB)}},\\ C_P = \\text{${fs(r.CP)}},\\ F_n = \\text{${fs(r.Fn)}}`,
      formulas: [
        'T = \\tfrac{T_F + T_A}{2},\\quad C_B = \\dfrac{\\nabla}{L B T},\\quad C_P = \\dfrac{C_B}{C_M},\\quad F_n = \\dfrac{V}{\\sqrt{gL}}',
        'L_R = L\\left(1 - C_P + \\dfrac{0.06\\, C_P\\, lcb}{4 C_P - 1}\\right)',
      ],
      rows: [
        ['V', `${fmt(r.speedKn, 2)} × 0.5144 = ${fs(r.V)} m/s`],
        ['T', `${fs(r.T)} m`],
        ['C_B', fs(r.CB)],
        ['C_P', fs(r.CP)],
        ['F_n', fs(r.Fn)],
        ['L_R', `${fs(r.LR)} m`],
      ],
    },
    {
      n: 2,
      title: 'Friction',
      summary: `R_F = \\text{${kN(r.RF)} kN}`,
      formulas: [
        'S = L(2T+B)\\sqrt{C_M}\\,(0.453 + 0.4425 C_B - 0.2862 C_M - 0.003467 B/T + 0.3696 C_{WP}) + 2.38 A_{BT}/C_B',
        'R_n = \\dfrac{VL}{\\nu},\\quad C_F = \\dfrac{0.075}{(\\log_{10} R_n - 2)^2},\\quad R_F = \\tfrac12 \\rho V^2 S\\, C_F',
      ],
      rows: [
        ['S', `${fmt(r.S, 1)} m²`, i.SOverride != null ? `user value (regression ${fmt(r.SFromRegression, 1)} m²)` : 'regression'],
        ['R_n', fs(r.Rn)],
        ['C_F', fs(r.CF)],
        ['\\tfrac12\\rho V^2', `${fmt(r.q / 1e3, 2)} kPa`],
        ['R_F', `${kN(r.RF)} kN`],
      ],
    },
    {
      n: 3,
      title: 'Form factor',
      summary: `1+k_1 = \\text{${fs(r.onePlusK1)}}`,
      formulas: [
        '1+k_1 = c_{13}\\{0.93 + c_{12}(B/L_R)^{0.92497}(0.95 - C_P)^{-0.521448}(1 - C_P + 0.0225\\,lcb)^{0.6906}\\}',
        'c_{13} = 1 + 0.003\\,C_{stern}',
      ],
      rows: [
        ['T/L', fs(r.TL)],
        ['c_{12}', fs(r.c12), r.c12Branch],
        ['c_{13}', fs(r.c13), `C_stern = ${i.Cstern}`],
        ['B/L_R', fs(i.B / r.LR)],
        ['1+k_1', fs(r.onePlusK1)],
        ['R_F(1+k_1)', `${kN(r.RFk1)} kN`],
      ],
    },
    {
      n: 4,
      title: 'Appendages',
      summary: `R_{APP} = \\text{${kN(r.RAPP, 2)} kN}`,
      formulas: [
        'R_{APP} = \\tfrac12\\rho V^2 S_{APP}(1+k_2)_{eq}\\, C_F + R_{BT}',
        '(1+k_2)_{eq} = \\dfrac{\\sum (1+k_2) S_{APP}}{\\sum S_{APP}},\\quad R_{BT} = \\rho V^2 \\pi d^2 C_{BTO}',
      ],
      rows: [
        ['S_{APP}', `${fmt(r.SApp, 1)} m²`],
        ['(1+k_2)_{eq}', fs(r.onePlusK2eq)],
        ['R_{BT}', `${kN(r.RBT, 2)} kN`, i.thrusterD > 0 ? `d = ${i.thrusterD} m` : 'no bow-thruster tunnel'],
        ['R_{APP}', `${kN(r.RAPP, 2)} kN`],
      ],
    },
    {
      n: 5,
      title: 'Waves',
      summary: `R_W = \\text{${kN(r.RW)} kN}`,
      formulas: [
        'R_W = c_1 c_2 c_5\\, \\nabla \\rho g \\exp\\{m_1 F_n^{d} + m_2 \\cos(\\lambda F_n^{-2})\\},\\quad d = -0.9',
        'c_1 = 2223105\\, c_7^{3.78613}(T/B)^{1.07961}(90 - i_E)^{-1.37565}',
        'c_3 = \\dfrac{0.56 A_{BT}^{1.5}}{BT(0.31\\sqrt{A_{BT}} + T_F - h_B)},\\quad c_2 = e^{-1.89\\sqrt{c_3}},\\quad c_5 = 1 - \\dfrac{0.8 A_T}{B T C_M}',
        'i_E = 1 + 89\\exp\\{-(L/B)^{0.80856}(1-C_{WP})^{0.30484}(1-C_P-0.0225\\,lcb)^{0.6367}(L_R/B)^{0.34574}(100\\nabla/L^3)^{0.16302}\\}',
        'm_1 = 0.0140407\\tfrac{L}{T} - 1.75254\\tfrac{\\nabla^{1/3}}{L} - 4.79323\\tfrac{B}{L} - c_{16},\\quad m_2 = c_{15} C_P^2 e^{-0.1 F_n^{-2}}',
      ],
      rows: [
        ['c_7', fs(r.c7), r.c7Branch],
        ['i_E', `${fs(r.iE)}°`, i.iEOverride != null ? `user value (regression ${fs(r.iEFromRegression)}°)` : 'regression'],
        ['c_1', fs(r.c1)],
        ['c_3', fs(r.c3)],
        ['c_2', fs(r.c2)],
        ['c_5', fs(r.c5)],
        ['c_1 c_2 c_5', fs(r.c1 * r.c2 * r.c5)],
        ['\\nabla\\rho g', `${fmt(r.weight / 1e6, 2)} MN`],
        ['c_{16}', fs(r.c16), r.c16Branch],
        ['m_1', fs(r.m1)],
        ['c_{15}', fs(r.c15), r.c15Branch],
        ['m_2', fs(r.m2)],
        ['\\lambda', fs(r.lambda), r.lambdaBranch],
        ['\\text{exponent}', fs(r.waveExponent), 'cosine argument in radians'],
        ['R_W', `${kN(r.RW)} kN`],
      ],
    },
    {
      n: 6,
      title: 'Bulb & transom',
      summary: `R_B = \\text{${kN(r.RB, 3)} kN},\\ R_{TR} = \\text{${kN(r.RTR, 2)} kN}`,
      formulas: [
        'R_B = \\dfrac{0.11 e^{-3P_B^{-2}} F_{ni}^3 A_{BT}^{1.5} \\rho g}{1 + F_{ni}^2},\\quad P_B = \\dfrac{0.56\\sqrt{A_{BT}}}{T_F - 1.5 h_B}',
        'F_{ni} = \\dfrac{V}{\\sqrt{g(T_F - h_B - 0.25\\sqrt{A_{BT}}) + 0.15V^2}}',
        'R_{TR} = \\tfrac12 \\rho V^2 A_T c_6,\\quad F_{nT} = \\dfrac{V}{\\sqrt{2 g A_T/(B + B C_{WP})}}',
      ],
      rows: [
        ['P_B', fs(r.PB), i.ABT > 0 ? undefined : 'no bulb'],
        ['F_{ni}', fs(r.Fni)],
        ['R_B', `${kN(r.RB, 3)} kN`],
        ['F_{nT}', fs(r.FnT)],
        ['c_6', fs(r.c6), r.c6Branch],
        ['R_{TR}', `${kN(r.RTR, 2)} kN`],
      ],
    },
    {
      n: 7,
      title: 'Correlation',
      summary: `C_A = \\text{${fs(r.CA)}},\\ R_A = \\text{${kN(r.RA)} kN}`,
      formulas: [
        'C_A = 0.006(L+100)^{-0.16} - 0.00205 + 0.003\\sqrt{L/7.5}\\, C_B^4\\, c_2 (0.04 - c_4)',
        'R_A = \\tfrac12\\rho V^2 S\\, C_A',
      ],
      rows: [
        ['c_4', fs(r.c4), r.c4Branch],
        ['\\Delta C_A (k_S)', fs(r.dCAks), `k_S = ${i.ksMicron} µm${i.ksMicron === 150 ? ' (standard, adds nothing)' : ''}`],
        ['C_A', fs(r.CA)],
        ['R_A', `${kN(r.RA)} kN`],
      ],
    },
    {
      n: 8,
      title: 'Total & power',
      summary: `R_T = \\text{${kN(r.RT)} kN},\\ P_E = \\text{${kW(r.PE)} kW}`,
      formulas: ['R_T = R_F(1+k_1) + R_{APP} + R_W + R_B + R_{TR} + R_A,\\qquad P_E = R_T V'],
      rows: [
        ['R_T', `${kN(r.RT)} kN`],
        ['P_E', `${kN(r.RT)} × ${fs(r.V)} = ${kW(r.PE)} kW`],
      ],
    },
  ];
}

export function Steps({ inputs, result }: { inputs: HMInputs; result: HMResult }) {
  const steps = buildSteps(inputs, result);
  const [open, setOpen] = useState<Set<number>>(new Set([8]));
  const toggle = (n: number) =>
    setOpen((s) => {
      const t = new Set(s);
      if (t.has(n)) t.delete(n);
      else t.add(n);
      return t;
    });
  const all = open.size === steps.length;
  return (
    <section aria-labelledby="steps-h" className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="steps-h" className="font-serif text-xl font-bold text-ink">
          Eight steps at {fmt(result.speedKn, result.speedKn % 1 ? 1 : 0)} knots
        </h2>
        <button
          type="button"
          className="text-[12px] font-medium text-accent hover:underline"
          onClick={() => setOpen(all ? new Set() : new Set(steps.map((s) => s.n)))}
        >
          {all ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((s) => {
          const isOpen = open.has(s.n);
          return (
            <li key={s.n} className={`rounded-lg border ${s.n === 8 ? 'border-navy' : 'border-line'} bg-white`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                aria-expanded={isOpen}
                onClick={() => toggle(s.n)}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${s.n === 8 ? 'bg-navy text-white' : 'bg-sea text-navy'}`}>
                  {s.n}
                </span>
                <span className="font-semibold text-ink">{s.title}</span>
                <Tex tex={s.summary} className="num ml-auto hidden truncate text-[12.5px] text-ink-2 sm:block" />
                <ChevronDown size={16} className={`shrink-0 text-ink-3 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-line px-3 py-3 lg:grid-cols-[1.25fr_1fr]">
                  <div className="formula-block min-w-0 rounded-md bg-paper px-3 py-2 text-[13px]">
                    {s.formulas.map((f, k) => (
                      <Tex key={k} tex={f} block />
                    ))}
                  </div>
                  <table className="w-full self-start text-[13px]">
                    <tbody>
                      {s.rows.map(([sym, val, note], k) => (
                        <tr key={k} className="border-b border-line/60 last:border-0 align-top">
                          <td className="w-28 py-1 pr-2 text-ink-2">
                            <Tex tex={sym} />
                          </td>
                          <td className="num py-1 text-right font-medium text-ink">
                            {val}
                            {note && <div className="text-[11px] font-normal text-ink-3">{note}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
