import { useRef, useState } from 'react';
import type { HMInputs, HMResult } from '../engine/types';
import { COMPONENTS, zoneById, type ZoneId } from '../zones';
import { Tex } from './Tex';

interface Props {
  inputs: HMInputs;
  result: HMResult | null;
  active: ZoneId;
  /** Zones highlighted from outside (e.g. hovering a resistance component) */
  highlight: ZoneId[];
  onSelect: (id: ZoneId) => void;
  errorZones: ZoneId[];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(x) ? x : a));

// Sheer-profile geometry (viewBox units). Schematic: vertical scale is exaggerated ~1.5×.
const W = 1200;
const H = 372;
const XS = 112; // transom
const X0 = 182; // AP (rudder stock)
const X1 = 1032; // FP
const DECK = 176; // main deck
const WL = 236; // design waterline
const KEEL = 318;
const DRAUGHT_PX = KEEL - WL;
const POOP = XS + 178; // forward end of the poop / accommodation deck
const FCLE = X1 - 72; // aft end of the forecastle

export function ShipDiagram({ inputs, result, active, highlight, onSelect, errorZones }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: ZoneId; x: number; y: number } | null>(null);

  const T = (inputs.TF + inputs.TA) / 2 || 1;
  const k = DRAUGHT_PX / T; // px per metre, vertical

  // Bulb follows A_BT and h_B
  const hasBulb = inputs.ABT > 0;
  const br = clamp(Math.sqrt(Math.max(inputs.ABT, 0) / Math.PI) * k * 1.1, 7, 28);
  const by = clamp(KEEL - inputs.hB * k, WL + br * 0.8, KEEL - br * 0.4);
  const nose = X1 + br * 1.5;

  // Transom immersion (approximate depth = A_T / (0.7 B))
  const hasTransom = inputs.AT > 0;
  const tImm = hasTransom ? clamp((inputs.AT / (0.7 * inputs.B)) * k, 5, DRAUGHT_PX * 0.45) : -8;
  const tBottom = WL + tImm;

  const bow = hasBulb
    ? `C ${X1 - 52},${KEEL} ${X1 - 14},${by + br} ${X1},${by + br}
       C ${nose + br * 0.3},${by + br} ${nose + br * 0.3},${by - br} ${X1},${by - br}
       C ${X1 - 12},${by - br - 8} ${X1 + 2},${WL + 12} ${X1 + 8},${WL}`
    : `C ${X1 - 40},${KEEL} ${X1 + 4},${KEEL - 26} ${X1 + 8},${WL}`;

  const hull = `M ${XS},${DECK - 14} L ${XS + 10},${tBottom}
    C ${XS + 60},${tBottom + 2} ${X0 + 40},${tBottom + 10} ${X0 + 66},${KEEL - 54}
    L ${X0 + 70},${KEEL - 20}
    C ${X0 + 110},${KEEL - 2} ${X0 + 170},${KEEL} ${X0 + 260},${KEEL}
    L ${X1 - 110},${KEEL} ${bow}
    L ${X1 + 62},${DECK - 20} L ${FCLE},${DECK - 20} L ${FCLE},${DECK}
    L ${POOP},${DECK} L ${POOP},${DECK - 14} Z`;

  // Wave height follows the wave-making share of R_T
  const rwShare = result && result.RT > 0 ? result.RW / result.RT : 0.2;
  const amp = clamp(rwShare * 40, 3, 18);
  const fn = result?.Fn ?? 0.2;
  const bowWave = `M ${X1 - 170},${WL} C ${X1 - 110},${WL} ${X1 - 50},${WL - amp} ${X1 - 10},${WL - amp}
    C ${X1 + 30},${WL - amp} ${X1 + 60},${WL + amp * 0.3} ${X1 + 110},${WL + amp * 0.15}
    C ${X1 + 140},${WL} ${X1 + 160},${WL} ${X1 + 180},${WL}`;

  // Cargo hatches and cranes
  const hatchSpan = FCLE - 30 - (POOP + 40);
  const nH = 7;
  const hw = hatchSpan / nH - 14;
  const hatchX = (i: number) => POOP + 40 + i * (hatchSpan / nH);

  const on = (id: ZoneId) => active === id || hover?.id === id || highlight.includes(id);

  function move(id: ZoneId, e: React.PointerEvent) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const zoneProps = (id: ZoneId) => ({
    className: `zone ${on(id) ? 'on' : ''} ${active === id ? 'active' : ''} ${errorZones.includes(id) ? 'err' : ''}`,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Step ${id}, ${zoneById(id).title}: edit inputs`,
    'aria-pressed': active === id,
    onPointerEnter: (e: React.PointerEvent) => move(id, e),
    onPointerMove: (e: React.PointerEvent) => move(id, e),
    onPointerLeave: () => setHover((h) => (h?.id === id ? null : h)),
    onClick: () => onSelect(id),
    onFocus: () => {
      const r = wrap.current?.getBoundingClientRect();
      if (r) setHover({ id, x: r.width / 2, y: 24 });
    },
    onBlur: () => setHover(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(id);
      }
    },
  });

  /** Numbered step marker with a small name tag. */
  const pin = (id: ZoneId, x: number, y: number, label: string, side: 'left' | 'right' = 'right') => {
    const tw = label.length * 6.6 + 14;
    const tx = side === 'right' ? x + 15 : x - 15 - tw;
    return (
      <g className={`pin ${on(id) ? 'pin-on' : ''}`} pointerEvents="none" key={`${id}-${label}`}>
        <circle cx={x} cy={y} r={14} className="pin-halo" />
        <circle cx={x} cy={y} r={10.5} className="pin-dot" />
        <text x={x} y={y + 4} textAnchor="middle" className="pin-num">
          {id}
        </text>
        <rect x={tx} y={y - 10} width={tw} height={20} rx={10} className="pin-tag" />
        <text x={tx + tw / 2} y={y + 4} textAnchor="middle" className="pin-label">
          {label}
        </text>
      </g>
    );
  };

  const fmt1 = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : '—');

  return (
    <div ref={wrap} className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="ship-svg block h-auto w-full"
        role="group"
        aria-label="Sheer profile of the ship. Each numbered marker is one step of the Holtrop–Mennen method; choose one to edit its inputs."
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#eef3f4" />
            <stop offset="1" stopColor="#f8f6f1" />
          </linearGradient>
          <linearGradient id="sea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9cc4cc" stopOpacity="0.42" />
            <stop offset="1" stopColor="#5f8e9b" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="house" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f3efe6" />
            <stop offset="1" stopColor="#e9e3d6" />
          </linearGradient>
          <clipPath id="clipTop">
            <rect x="0" y="0" width={W} height={WL - 3} />
          </clipPath>
          <clipPath id="clipBoot">
            <rect x="0" y={WL - 3} width={W} height={8} />
          </clipPath>
          <clipPath id="clipBottom">
            <rect x="0" y={WL + 5} width={W} height={H} />
          </clipPath>
          <clipPath id="clipAft">
            <rect x="0" y={WL + 2} width={X0 + 260} height={H} />
          </clipPath>
          <clipPath id="clipMid">
            <rect x={X0 + 260} y={WL + 2} width={X1 - 110 - (X0 + 260)} height={H} />
          </clipPath>
          <clipPath id="clipHull">
            <path d={hull} />
          </clipPath>
        </defs>

        {/* Sky and soft clouds */}
        <rect x="0" y="0" width={W} height={WL} fill="url(#sky)" />
        <g fill="#ffffff" opacity="0.7" pointerEvents="none">
          <ellipse cx="520" cy="58" rx="70" ry="12" />
          <ellipse cx="565" cy="50" rx="44" ry="11" />
          <ellipse cx="860" cy="92" rx="56" ry="9" />
        </g>

        {/* ── Step 8: funnel (engine power) — drawn behind the house ── */}
        <g {...zoneProps(8)}>
          <path d={`M ${XS + 30},${DECK - 92} L ${XS + 36},${DECK - 128} L ${XS + 70},${DECK - 128} L ${XS + 68},${DECK - 92} Z`} className="funnel" />
          <rect x={XS + 34} y={DECK - 120} width={35} height={8} className="funnel-band" pointerEvents="none" />
          <rect x={XS + 37} y={DECK - 134} width={30} height={6} rx={1} className="funnel-top" pointerEvents="none" />
          <rect x={XS + 22} y={DECK - 140} width={56} height={52} className="hit" rx={8} />
        </g>

        {/* ── Hull ── */}
        <g pointerEvents="none">
          <path d={hull} className="hull-top" clipPath="url(#clipTop)" />
          <path d={hull} className="hull-boot" clipPath="url(#clipBoot)" />
          <path d={hull} className="hull-bottom" clipPath="url(#clipBottom)" />
          {/* sheer stripe and deck edge */}
          <line x1={XS + 4} x2={X1 + 54} y1={DECK + 6} y2={DECK + 6} className="sheer-stripe" clipPath="url(#clipHull)" />
          <line x1={XS + 2} x2={POOP} y1={DECK - 14} y2={DECK - 14} className="deck-edge" />
          <line x1={POOP} x2={FCLE} y1={DECK} y2={DECK} className="deck-edge" />
          <line x1={FCLE} x2={X1 + 62} y1={DECK - 20} y2={DECK - 20} className="deck-edge" />
          {/* Plimsoll mark at midship */}
          <g className="plimsoll" transform={`translate(${(X0 + X1) / 2 - 30}, ${WL - 22})`}>
            <circle r="7" fill="none" />
            <line x1="-10" x2="10" y1="0" y2="0" />
            <line x1="14" x2="30" y1="-6" y2="-6" />
          </g>
          {/* anchor and hawse pipe */}
          <circle cx={X1 + 22} cy={DECK + 4} r={3.5} fill="#1c2b34" />
          <path d={`M ${X1 + 22},${DECK + 8} l 0,12 m -6,-4 q 6,8 12,0`} stroke="#c7cfd3" strokeWidth={1.6} fill="none" />
          {/* draft marks */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line x1={X1 - 6} x2={X1 + 2} y1={WL - 6 - i * 9} y2={WL - 6 - i * 9} className="draft-mark" />
              <line x1={XS + 14} x2={XS + 22} y1={WL - 6 - i * 9} y2={WL - 6 - i * 9} className="draft-mark" />
            </g>
          ))}
          <path d={hull} className="hull-outline" />
        </g>

        {/* Hatch covers and cranes */}
        <g pointerEvents="none">
          {Array.from({ length: nH }, (_, i) => (
            <g key={i}>
              <rect x={hatchX(i)} y={DECK - 13} width={hw} height={13} rx={2} className="hatch" />
              <line x1={hatchX(i) + 4} x2={hatchX(i) + hw - 4} y1={DECK - 9} y2={DECK - 9} stroke="#8f9da4" strokeWidth={0.8} />
            </g>
          ))}
          {[1, 3, 5].map((i) => {
            const cx = hatchX(i) - 7;
            return (
              <g key={i}>
                <rect x={cx - 4} y={DECK - 40} width={8} height={40} className="crane" />
                <rect x={cx - 9} y={DECK - 50} width={18} height={11} rx={2} className="crane" />
                <line x1={cx + 6} y1={DECK - 46} x2={cx + 92} y2={DECK - 22} className="crane-jib" />
                <line x1={cx + 2} y1={DECK - 50} x2={cx + 6} y2={DECK - 62} className="crane-jib thin" />
                <line x1={cx + 6} y1={DECK - 62} x2={cx + 92} y2={DECK - 22} className="crane-wire" />
              </g>
            );
          })}
          {/* foremast */}
          <line x1={X1 + 10} x2={X1 + 10} y1={DECK - 20} y2={DECK - 70} stroke="#41525c" strokeWidth={2.4} />
          <line x1={X1 + 2} x2={X1 + 18} y1={DECK - 58} y2={DECK - 58} stroke="#41525c" strokeWidth={1.6} />
          <circle cx={X1 + 10} cy={DECK - 72} r={2.2} fill="#e9c46a" />
          {/* rails */}
          <line x1={FCLE} x2={X1 + 58} y1={DECK - 26} y2={DECK - 26} className="rail" />
          <line x1={XS + 4} x2={XS + 20} y1={DECK - 20} y2={DECK - 20} className="rail" />
          {/* free-fall lifeboat */}
          <g transform={`translate(${XS + 6}, ${DECK - 34}) rotate(14)`}>
            <path d="M 0,0 L 26,0 Q 30,6 24,10 L 4,10 Q -2,6 0,0 Z" fill="#df9a6b" stroke="#a5653f" strokeWidth={1} />
          </g>
        </g>

        {/* ── Step 7: superstructure (air drag & correlation) ── */}
        <g {...zoneProps(7)}>
          {[0, 1, 2, 3, 4].map((tier) => {
            const y = DECK - 14 - (tier + 1) * 17;
            const wide = tier === 4;
            const x = wide ? XS + 18 : XS + 26;
            const w = wide ? 140 : 124;
            return (
              <g key={tier}>
                <rect x={x} y={y} width={w} height={17} className="house" />
                {Array.from({ length: wide ? 9 : 7 }, (_, j) => (
                  <rect
                    key={j}
                    x={x + 10 + j * (wide ? 14.2 : 16)}
                    y={y + 5}
                    width={wide ? 9 : 8}
                    height={wide ? 7 : 6}
                    rx={1}
                    className={wide ? 'window bridge' : 'window'}
                    pointerEvents="none"
                  />
                ))}
              </g>
            );
          })}
          {/* radar mast */}
          <g pointerEvents="none">
            <line x1={XS + 110} x2={XS + 110} y1={DECK - 99} y2={DECK - 140} stroke="#41525c" strokeWidth={2.2} />
            <line x1={XS + 98} x2={XS + 124} y1={DECK - 128} y2={DECK - 128} stroke="#41525c" strokeWidth={1.8} />
            <rect x={XS + 100} y={DECK - 120} width={22} height={3} rx={1.5} fill="#41525c" />
          </g>
          <rect x={XS + 14} y={DECK - 104} width={150} height={92} className="hit" rx={8} />
        </g>

        {/* ── Sea surface overlay (the underwater hull reads through it) ── */}
        <rect x="0" y={WL} width={W} height={H - WL} fill="url(#sea)" pointerEvents="none" />
        <g pointerEvents="none" className="ripples">
          <path
            d={Array.from({ length: 34 }, (_, i) => `M ${i * 40 - 40},${WL + 18} q 10,-3 20,0 t 20,0`).join(' ')}
            className="ripple"
          />
          <path
            d={Array.from({ length: 34 }, (_, i) => `M ${i * 40 - 20},${WL + 44} q 10,-3 20,0 t 20,0`).join(' ')}
            className="ripple faint"
          />
        </g>
        <line x1="0" x2={W} y1={WL} y2={WL} className="surface" />

        {/* ── Step 3: afterbody run (form factor) ── */}
        <g {...zoneProps(3)}>
          <path d={hull} className="hit" clipPath="url(#clipAft)" />
        </g>

        {/* ── Step 2: wetted hull (friction) ── */}
        <g {...zoneProps(2)}>
          <path d={hull} className="hit" clipPath="url(#clipMid)" />
        </g>

        {/* ── Step 1: hull form (main hull above water) ── */}
        <g {...zoneProps(1)}>
          <rect x={POOP + 4} y={DECK - 2} width={FCLE - POOP - 8} height={WL - DECK - 2} className="hit" rx={6} />
        </g>

        {/* ── Step 4: rudder and propeller ── */}
        <g {...zoneProps(4)}>
          <path
            d={`M ${X0 - 6},${tBottom + 6} L ${X0 + 12},${tBottom + 6} L ${X0 + 16},${KEEL - 10} Q ${X0 + 4},${KEEL - 4} ${X0 - 14},${KEEL - 8} L ${X0 - 14},${tBottom + 14} Z`}
            className="rudder"
          />
          <g transform={`translate(${X0 + 44}, ${KEEL - 30})`} pointerEvents="none">
            <ellipse rx={5} ry={25} className="prop" />
            <ellipse rx={3.5} ry={11} cy={-12} className="prop-blade" />
            <ellipse rx={3.5} ry={11} cy={12} className="prop-blade" />
            <rect x={-4} y={-4} width={22} height={8} rx={2} className="prop" />
          </g>
          {inputs.thrusterD > 0 && <circle cx={X1 - 48} cy={WL + 26} r={clamp(inputs.thrusterD * k * 0.6, 3, 9)} className="thruster" />}
          <rect x={X0 - 22} y={tBottom + 2} width={96} height={KEEL - tBottom + 4} className="hit" rx={8} />
        </g>

        {/* ── Step 6a: transom ── */}
        <g {...zoneProps(6)}>
          {hasTransom && <rect x={XS + 3} y={WL} width={7} height={tImm} className="transom-mark" />}
          <rect x={XS - 16} y={WL - 26} width={36} height={Math.max(tImm, 0) + 44} className="hit" rx={8} />
        </g>

        {/* ── Step 6b: bulbous bow ── */}
        <g {...zoneProps(6)}>
          <circle cx={hasBulb ? X1 + br * 0.4 : X1 - 10} cy={hasBulb ? by : KEEL - 26} r={(hasBulb ? br : 14) + 14} className="hit" />
        </g>

        {/* ── Step 5: bow wave ── */}
        <g {...zoneProps(5)}>
          <path d={bowWave} className="wave" />
          <path d={`M ${X1 + 30},${WL + 4} q 30,6 70,2 M ${X1 + 50},${WL + 10} q 30,5 60,1`} className="foam" />
          <path d={`M ${XS - 70},${WL - 2} q 20,-6 44,-4 q 18,2 34,-2 M ${XS - 96},${WL + 6} q 30,-4 60,0`} className="foam" />
          <rect x={X1 - 40} y={WL - 52} width={232} height={64} className="hit" rx={8} />
        </g>

        {/* ── Step 8 also: speed tag ── */}
        <g {...zoneProps(8)}>
          <rect x={W - 230} y={18} width={200} height={34} rx={17} className="speed-tag" />
          <text x={W - 214} y={40} className="speed-text">
            {fmt1(inputs.designSpeed, 1)} kn · Fn {fn.toFixed(3)}
          </text>
          <path d={`M ${W - 62},35 l 18,0 m -6,-6 l 6,6 l -6,6`} className="speed-arrow" />
          <rect x={W - 234} y={14} width={208} height={42} className="hit" rx={20} />
        </g>

        {/* Length dimension (in the water, below the keel) */}
        <g pointerEvents="none" className="dims">
          <line x1={X0} x2={X0} y1={KEEL + 6} y2={KEEL + 34} />
          <line x1={X1} x2={X1} y1={KEEL + 6} y2={KEEL + 34} />
          <line x1={X0 + 4} x2={X1 - 4} y1={KEEL + 28} y2={KEEL + 28} />
          <path d={`M ${X0 + 10},${KEEL + 24} l -6,4 l 6,4 M ${X1 - 10},${KEEL + 24} l 6,4 l -6,4`} />
          <rect x={(X0 + X1) / 2 - 56} y={KEEL + 18} width={112} height={20} rx={10} className="dim-pill" />
          <text x={(X0 + X1) / 2} y={KEEL + 32} textAnchor="middle" className="dim-text">
            L = {fmt1(inputs.L, 2)} m
          </text>
          <text x={X0} y={KEEL + 48} textAnchor="middle" className="dim-small">AP</text>
          <text x={X1} y={KEEL + 48} textAnchor="middle" className="dim-small">FP</text>
          <text x={X1 + 120} y={WL - 6} className="dim-small">DWL</text>
        </g>

        {/* Step markers */}
        {pin(1, (POOP + FCLE) / 2 - 60, DECK + 30, 'Hull form')}
        {pin(2, (X0 + X1) / 2 + 40, KEEL - 30, 'Friction')}
        {pin(3, X0 + 160, KEEL - 34, 'Form factor')}
        {pin(4, X0 + 1, (tBottom + KEEL) / 2 + 6, 'Appendages', 'left')}
        {pin(5, X1 + 96, WL - 34, 'Waves')}
        {pin(6, hasBulb ? X1 + br * 0.4 : X1 - 10, hasBulb ? by : KEEL - 26, 'Bulb')}
        {pin(6, XS + 4, WL - 20, 'Transom', 'left')}
        {pin(7, XS + 150, DECK - 58, 'Correlation')}
        {pin(8, XS + 52, DECK - 112, 'Total & power')}
      </svg>

      {hover && <HoverCard id={hover.id} x={hover.x} y={hover.y} width={wrap.current?.clientWidth ?? 800} inputs={inputs} result={result} />}
    </div>
  );
}

function HoverCard({ id, x, y, width, inputs, result }: { id: ZoneId; x: number; y: number; width: number; inputs: HMInputs; result: HMResult | null }) {
  const z = zoneById(id);
  const right = x > width / 2;
  const style: React.CSSProperties = {
    top: y + 18,
    left: right ? undefined : Math.min(x + 16, width - 280),
    right: right ? Math.max(width - x + 16, 8) : undefined,
  };
  return (
    <div className="hover-card pointer-events-none absolute z-20 w-[min(280px,80vw)] rounded-xl p-3.5 text-[13px]" style={style} role="tooltip">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">{z.id}</span>
        <span className="font-semibold text-ink">{z.title}</span>
        <span className="ml-auto text-[11px] text-ink-3">click to edit</span>
      </div>
      <div className="mt-0.5 pl-7 text-[11.5px] text-ink-3">{z.where}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {z.drives.map((c) => {
          const comp = COMPONENTS.find((x) => x.key === c)!;
          return (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: comp.color }} />
              <Tex tex={comp.tex} />
            </span>
          );
        })}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {z.summary(inputs, result).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="num text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
