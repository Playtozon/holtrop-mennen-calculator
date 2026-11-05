import { useRef, useState, type ReactNode } from 'react';
import type { HMInputs, HMResult } from '../engine/types';
import { COMPONENTS, ZONES, zoneById, type ZoneId } from '../zones';
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
const deg = Math.PI / 180;

// Profile geometry (viewBox units)
const XS = 64; // transom
const X0 = 100; // AP
const X1 = 860; // FP
const DECK = 104;
const WL = 184;
const KEEL = 264;
const DRAUGHT_PX = KEEL - WL;

export function ShipDiagram({ inputs, result, active, highlight, onSelect, errorZones }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: ZoneId; x: number; y: number } | null>(null);

  const T = (inputs.TF + inputs.TA) / 2 || 1;
  const k = DRAUGHT_PX / T; // px per metre (vertical, profile)

  // Bulb
  const hasBulb = inputs.ABT > 0;
  const br = clamp(Math.sqrt(Math.max(inputs.ABT, 0) / Math.PI) * k * 1.15, 7, 30);
  const by = clamp(KEEL - inputs.hB * k, WL + br * 0.7, KEEL - br * 0.35);
  const nose = X1 + br * 1.55;

  // Transom immersion (approximate depth = A_T / (0.7 B))
  const hasTransom = inputs.AT > 0;
  const tImm = hasTransom ? clamp((inputs.AT / (0.7 * inputs.B)) * k, 5, DRAUGHT_PX * 0.55) : -10;
  const tBottom = WL + tImm;

  const bow = hasBulb
    ? `C ${X1 - 40},${KEEL} ${X1 - 12},${by + br} ${X1},${by + br}
       C ${nose + br * 0.25},${by + br} ${nose + br * 0.25},${by - br} ${X1},${by - br}
       C ${X1 - 10},${by - br - 6} ${X1 + 2},${WL + 8} ${X1 + 8},${WL}`
    : `C ${X1 - 30},${KEEL} ${X1 + 4},${KEEL - 24} ${X1 + 8},${WL}`;

  const hull = `M ${XS},${DECK} L ${XS},${tBottom}
    C ${XS + 70},${tBottom + 8} ${X0 + 120},${KEEL} ${X0 + 230},${KEEL}
    L ${X1 - 90},${KEEL} ${bow}
    L ${X1 + 46},${DECK - 8} L ${X1 - 36},${DECK - 8} L ${X1 - 36},${DECK}
    L ${XS + 70},${DECK} L ${XS + 70},${DECK - 8} L ${XS},${DECK - 8} Z`;

  // Wave height follows the wave-making share
  const rwShare = result && result.RT > 0 ? result.RW / result.RT : 0.2;
  const amp = clamp(rwShare * 46, 3, 24);
  const fn = result?.Fn ?? 0.2;
  const bowWave = `M ${X1 - 120},${WL} C ${X1 - 70},${WL} ${X1 - 30},${WL - amp} ${X1 + 10},${WL - amp}
    C ${X1 + 50},${WL - amp} ${X1 + 70},${WL + amp * 0.35} ${X1 + 120},${WL + amp * 0.2} C ${X1 + 150},${WL} ${X1 + 170},${WL} ${X1 + 190},${WL}`;
  const sternWave = `M ${XS - 40},${WL} C ${XS - 20},${WL - amp * 0.5} ${XS},${WL - amp * 0.5} ${XS + 18},${WL - 2}`;

  // Plan view (waterplane), drawn to true scale vertically vs horizontally
  const CY = 410;
  const pxPerM = (X1 - X0) / inputs.L;
  const hw = clamp((inputs.B / 2) * pxPerM, 18, 64);
  const iE = clamp(result?.iE ?? 12, 3, 60);
  const ell = (0.55 * hw) / Math.sin(iE * deg);
  const px = X1 - ell * Math.cos(iE * deg);
  const py = 0.55 * hw;
  // Control point on the tangent line, kept inside the half-breadth so the curve never bulges
  const a0 = ((hw - py) / Math.sin(iE * deg)) * 0.75;
  const c2x = px - Math.cos(iE * deg) * a0;
  const c2y = py + Math.sin(iE * deg) * a0;
  const xp = Math.min(X1 - 210, c2x - 60);
  const c1x = xp + (c2x - xp) * 0.5;
  const hwT = hasTransom ? hw * 0.78 : hw * 0.3;
  const half = (s: 1 | -1) =>
    `C ${XS + 40},${CY + s * hw * 0.97} ${X0 + 80},${CY + s * hw} ${X0 + 200},${CY + s * hw}
     L ${xp},${CY + s * hw}
     C ${c1x},${CY + s * hw} ${c2x},${CY + s * c2y} ${px},${CY + s * py}
     L ${X1},${CY}`;
  // Closed outline: upper half stern → bow, then the mirrored lower half bow → stern
  const planClosed = `M ${XS},${CY - hwT} ${half(-1)} L ${X1},${CY} ${reverseLower()} Z`;
  function reverseLower() {
    // Mirror of the upper half, traversed bow → stern
    return `L ${px},${CY + py}
      C ${c2x},${CY + c2y} ${c1x},${CY + hw} ${xp},${CY + hw}
      L ${X0 + 200},${CY + hw}
      C ${X0 + 80},${CY + hw} ${XS + 40},${CY + hw * 0.97} ${XS},${CY + hwT}`;
  }

  // Midship section inset
  const MX = 1072;
  const secW = 132;
  const sk = secW / inputs.B;
  const secT = clamp(T * sk, 26, 120);
  const sk2 = secT / T;
  const secWL = 150;
  const secKeel = secWL + secT;
  const secDeck = secWL - clamp(secT * 0.55, 18, 60);
  const R = clamp(Math.sqrt(Math.max(0, (1 - inputs.CM) * inputs.B * T) / (2 * (1 - Math.PI / 4))) * sk2, 0, Math.min(secW / 2, secT) - 1);
  const sx0 = MX - secW / 2;
  const sx1 = MX + secW / 2;
  const section = `M ${sx0},${secDeck} L ${sx0},${secKeel - R} Q ${sx0},${secKeel} ${sx0 + R},${secKeel}
    L ${sx1 - R},${secKeel} Q ${sx1},${secKeel} ${sx1},${secKeel - R} L ${sx1},${secDeck} Z`;

  const on = (id: ZoneId) => active === id || hover?.id === id || highlight.includes(id);

  const zoneProps = (id: ZoneId) => ({
    className: `zone ${on(id) ? 'on' : ''} ${active === id ? 'active' : ''} ${errorZones.includes(id) ? 'err' : ''}`,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `${zoneById(id).title}: edit inputs`,
    'aria-pressed': active === id,
    onPointerEnter: (e: React.PointerEvent) => move(id, e),
    onPointerMove: (e: React.PointerEvent) => move(id, e),
    onPointerLeave: () => setHover((h) => (h?.id === id ? null : h)),
    onClick: () => onSelect(id),
    onFocus: () => {
      const r = wrap.current?.getBoundingClientRect();
      if (r) setHover({ id, x: r.width / 2, y: 40 });
    },
    onBlur: () => setHover(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(id);
      }
    },
  });

  function move(id: ZoneId, e: React.PointerEvent) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const pin = (x: number, y: number, label: string, anchor: 'start' | 'end' | 'middle' = 'start', dy = -14) => (
    <g className="pin" pointerEvents="none">
      <circle cx={x} cy={y} r={9} className="pin-halo" />
      <circle cx={x} cy={y} r={4.5} className="pin-dot" />
      <text x={x + (anchor === 'start' ? 12 : anchor === 'end' ? -12 : 0)} y={y + dy} textAnchor={anchor} className="pin-label">
        {label}
      </text>
    </g>
  );

  const fmt1 = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : '—');

  return (
    <div ref={wrap} className="relative select-none">
      <svg viewBox="0 0 1200 480" className="ship-svg block h-auto w-full" role="group" aria-label="Interactive ship diagram. Choose a part of the ship to edit its inputs.">
        <defs>
          <clipPath id="under">
            <rect x="0" y={WL} width="980" height={KEEL - WL + 40} />
          </clipPath>
          <clipPath id="above">
            <rect x="0" y="0" width="980" height={WL} />
          </clipPath>
          <linearGradient id="seaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#cfe2f5" />
            <stop offset="1" stopColor="#a9c8e8" />
          </linearGradient>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#1c5cab" strokeWidth="1.2" opacity="0.35" />
          </pattern>
        </defs>

        {/* View labels */}
        <text x={20} y={26} className="view-label">SHEER PROFILE</text>
        <text x={20} y={344} className="view-label">WATERPLANE</text>
        <text x={1005} y={26} className="view-label">MIDSHIP SECTION</text>

        {/* Sea */}
        <rect x={10} y={WL} width={960} height={KEEL - WL + 36} fill="url(#seaGrad)" rx={4} />
        <line x1={10} x2={970} y1={KEEL + 36} y2={KEEL + 36} stroke="#7d9bbb" strokeWidth={1} />

        {/* ── Hull body (underwater) ── */}
        <g {...zoneProps('hull')}>
          <path d={hull} className="hull-above" clipPath="url(#above)" />
          <path d={hull} className="hull-under" clipPath="url(#under)" />
          <path d={hull} className="hit" clipPath="url(#under)" />
          <path d={hull} className="hull-outline" fill="none" />
        </g>

        {/* Hatch covers and forecastle details (decor) */}
        <g pointerEvents="none">
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={250 + i * 78} y={DECK - 9} width={56} height={9} rx={1.5} fill="#c3ced9" stroke="#0f2a44" strokeWidth={1} />
          ))}
        </g>

        {/* ── Superstructure / air & roughness ── */}
        <g {...zoneProps('environment')}>
          <rect x={XS + 14} y={52} width={92} height={DECK - 60} className="ss" />
          <rect x={XS + 6} y={44} width={108} height={10} className="ss" />
          <rect x={XS + 76} y={22} width={18} height={24} className="funnel" />
          <rect x={XS + 76} y={28} width={18} height={6} fill="#eb6834" pointerEvents="none" />
          {[64, 76, 88].map((y) => (
            <g key={y} pointerEvents="none">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={XS + 22 + i * 13} y={y - 4} width={7} height={5} fill="#0f2a44" opacity={0.55} />
              ))}
            </g>
          ))}
          <rect x={XS + 2} y={18} width={116} height={DECK - 22} className="hit" rx={6} />
        </g>

        {/* ── Rudder & propeller ── */}
        <g {...zoneProps('appendages')}>
          <ellipse cx={XS + 66} cy={KEEL - 28} rx={6} ry={22} className="prop" />
          <rect x={XS + 63} y={KEEL - 32} width={6} height={8} className="prop" />
          <path
            d={`M ${XS + 18},${Math.max(tBottom, WL) + 12} L ${XS + 40},${Math.max(tBottom, WL) + 12} L ${XS + 40},${KEEL - 10} L ${XS + 16},${KEEL - 10} Z`}
            className="rudder"
          />
          {inputs.thrusterD > 0 && <circle cx={X1 - 40} cy={KEEL - 28} r={clamp(inputs.thrusterD * k * 0.6, 3, 10)} className="thruster" />}
          <rect x={XS + 6} y={Math.max(tBottom, WL) + 4} width={84} height={KEEL - Math.max(tBottom, WL) + 2} className="hit" rx={6} />
        </g>

        {/* ── Transom ── */}
        <g {...zoneProps('transom')}>
          {hasTransom && <rect x={XS - 3} y={WL} width={6} height={tImm} className="transom-mark" />}
          <rect x={XS - 18} y={WL - 30} width={40} height={Math.max(tImm, 0) + 48} className="hit" rx={6} />
        </g>

        {/* ── Bulbous bow ── */}
        <g {...zoneProps('bow')}>
          {hasBulb && <ellipse cx={X1 + br * 0.35} cy={by} rx={br * 0.95} ry={br * 0.82} className="bulb-mark" />}
          <circle cx={hasBulb ? X1 + br * 0.4 : X1 - 10} cy={hasBulb ? by : KEEL - 26} r={(hasBulb ? br : 16) + 16} className="hit" />
          {hasBulb && (
            <g pointerEvents="none">
              <line x1={nose + 18} x2={nose + 18} y1={KEEL} y2={by} className="dim" />
              <line x1={nose + 12} x2={nose + 24} y1={by} y2={by} className="dim" />
              <line x1={nose + 12} x2={nose + 24} y1={KEEL} y2={KEEL} className="dim" />
              <text x={nose + 26} y={(by + KEEL) / 2 + 4} className="dim-text"><Sub t="h_B" /> {fmt1(inputs.hB)}</text>
            </g>
          )}
        </g>

        {/* ── Waterline / draughts ── */}
        <g {...zoneProps('waterline')}>
          <line x1={XS - 40} x2={X1 + 200} y1={WL} y2={WL} className="wl" />
          <rect x={XS - 40} y={WL - 7} width={X1 + 240 - XS} height={14} className="hit" />
          {/* draught marks */}
          <g pointerEvents="none">
            <line x1={X0 + 6} x2={X0 + 6} y1={WL} y2={KEEL} className="dim" />
            <text x={X0 + 11} y={WL + 18} className="dim-text"><Sub t="T_A" /> {fmt1(inputs.TA)}</text>
            <line x1={X1 - 70} x2={X1 - 70} y1={WL} y2={KEEL} className="dim" />
            <text x={X1 - 76} y={WL + 18} textAnchor="end" className="dim-text"><Sub t="T_F" /> {fmt1(inputs.TF)}</text>
          </g>
          <rect x={X0} y={WL} width={70} height={DRAUGHT_PX} className="hit" />
          <rect x={X1 - 128} y={WL} width={66} height={DRAUGHT_PX} className="hit" />
        </g>

        {/* ── Midship station + section inset ── */}
        <g {...zoneProps('midship')}>
          <line x1={(X0 + X1) / 2} x2={(X0 + X1) / 2} y1={DECK - 6} y2={KEEL + 6} className="station" />
          <text x={(X0 + X1) / 2 + 6} y={DECK + 16} className="dim-text" pointerEvents="none">⊗ L/2</text>
          <rect x={(X0 + X1) / 2 - 12} y={DECK - 10} width={24} height={KEEL - DECK + 20} className="hit" />

          <line x1={sx0 - 26} x2={sx1 + 26} y1={secWL} y2={secWL} className="wl" />
          <rect x={sx0 - 20} y={secWL} width={secW + 40} height={secT + 18} fill="url(#seaGrad)" opacity={0.75} rx={3} />
          <path d={section} className="hull-above" />
          <path d={section} className="hull-under" clipPath="url(#secUnder)" />
          <clipPath id="secUnder">
            <rect x={sx0 - 30} y={secWL} width={secW + 60} height={200} />
          </clipPath>
          <path d={section} className="hull-outline" fill="none" />
          <line x1={MX} x2={MX} y1={secDeck - 10} y2={secKeel + 8} stroke="#7a7974" strokeDasharray="4 3" strokeWidth={1} />
          <g pointerEvents="none">
            <line x1={sx0} x2={sx1} y1={secDeck - 14} y2={secDeck - 14} className="dim" />
            <text x={MX} y={secDeck - 19} textAnchor="middle" className="dim-text">B = {fmt1(inputs.B, 2)} m</text>
            <line x1={sx1 + 14} x2={sx1 + 14} y1={secWL} y2={secKeel} className="dim" />
            <text x={sx1 + 18} y={(secWL + secKeel) / 2 + 4} className="dim-text">T</text>
            <text x={MX} y={secKeel + 34} textAnchor="middle" className="dim-text"><Sub t="C_M" /> = {fmt1(inputs.CM, 3)} · T = {fmt1(T, 2)} m</text>
          </g>
          <rect x={sx0 - 26} y={secDeck - 34} width={secW + 74} height={secKeel - secDeck + 76} className="hit" rx={8} />
        </g>

        {/* ── Speed / bow wave ── */}
        <g {...zoneProps('speed')}>
          <path d={bowWave} className="wave" />
          <path d={sternWave} className="wave" />
          <g pointerEvents="none">
            <line x1={X1 - 30} x2={X1 + 76} y1={44} y2={44} className="speed-arrow" markerEnd="url(#arrow)" />
            <text x={X1 - 30} y={34} className="speed-text">
              {fmt1(inputs.designSpeed, 1)} kn · Fn {fn.toFixed(3)}
            </text>
          </g>
          <rect x={X1 - 120} y={WL - amp - 14} width={310} height={amp + 26} className="hit" rx={6} />
          <rect x={X1 - 40} y={16} width={136} height={40} className="hit" rx={6} />
        </g>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f2a44" />
          </marker>
        </defs>

        {/* L dimension */}
        <g pointerEvents="none">
          <line x1={X0} x2={X0} y1={KEEL + 4} y2={KEEL + 30} className="dim" />
          <line x1={X1} x2={X1} y1={KEEL + 4} y2={KEEL + 30} className="dim" />
          <line x1={X0} x2={X1} y1={KEEL + 24} y2={KEEL + 24} className="dim" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
          <rect x={(X0 + X1) / 2 - 58} y={KEEL + 15} width={116} height={18} fill="#cfe2f5" />
          <text x={(X0 + X1) / 2} y={KEEL + 28} textAnchor="middle" className="dim-text strong">
            L = {fmt1(inputs.L, 2)} m (WL)
          </text>
          <text x={X0} y={KEEL + 48} textAnchor="middle" className="dim-text">AP</text>
          <text x={X1} y={KEEL + 48} textAnchor="middle" className="dim-text">FP</text>
        </g>

        {/* ── Waterplane (plan view) ── */}
        <g {...zoneProps('waterplane')}>
          <line x1={XS - 20} x2={X1 + 70} y1={CY} y2={CY} stroke="#7a7974" strokeDasharray="6 4" strokeWidth={1} pointerEvents="none" />
          <path d={planClosed} className="plane" />
          <line x1={(X0 + X1) / 2} x2={(X0 + X1) / 2} y1={CY - hw} y2={CY + hw} className="station" pointerEvents="none" />
          {/* entrance angle */}
          <g pointerEvents="none">
            <line x1={X1} y1={CY} x2={X1 - Math.cos(iE * deg) * (ell + 60)} y2={CY - Math.sin(iE * deg) * (ell + 60)} className="ie-line" />
            <path
              d={`M ${X1 - 70},${CY} A 70 70 0 0 1 ${X1 - Math.cos(iE * deg) * 70},${CY - Math.sin(iE * deg) * 70}`}
              className="ie-arc"
            />
            <text x={X1 - 92} y={CY - 6} textAnchor="end" className="dim-text strong"><Sub t="i_E" /> {fmt1(iE, 1)}°</text>
            <text x={X0 + 210} y={CY + 4} className="dim-text"><Sub t="C_WP" /> = {fmt1(inputs.CWP, 3)} · B = {fmt1(inputs.B, 2)} m</text>
          </g>
          <path d={planClosed} className="hit" />
        </g>

        {/* Hotspot pins */}
        {pin(X0 + 330, KEEL - 34, 'Hull body', 'start')}
        {pin(X1 + br * 0.4, hasBulb ? by : KEEL - 26, 'Bulb', 'start', -br - 6)}
        {pin(XS, WL + Math.max(tImm, 0) / 2, 'Transom', 'start', -12)}
        {pin(XS + 29, KEEL - 40, 'Rudder', 'middle', 34)}
        {pin(XS + 106, 70, 'Air · roughness', 'start', 4)}
        {pin(X1 - 210, WL, 'Waterline', 'middle', -12)}
        {pin((X0 + X1) / 2, DECK + 30, 'Midship', 'start', 4)}
        {pin(X0 + 400, CY - hw * 0.5, 'Waterplane', 'start', 4)}
        {pin(X1 + 70, WL - amp, 'Speed', 'start', -10)}
        {pin(MX, (secWL + secKeel) / 2 + 6, 'Section', 'middle', 22)}
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
    <div
      className="pointer-events-none absolute z-20 w-[min(280px,80vw)] rounded-lg border border-line bg-surface/95 p-3 text-[13px] shadow-lg backdrop-blur"
      style={style}
      role="tooltip"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{z.title}</span>
        <span className="text-[11px] text-ink-3">click to edit</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {z.drives.map((c) => {
          const comp = COMPONENTS.find((x) => x.key === c)!;
          return (
            <span key={c} className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: comp.color }} />
              <Tex tex={comp.tex} />
            </span>
          );
        })}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {z.summary(inputs, result).map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{k}</dt>
      <dd className="num text-right font-medium text-ink">{v}</dd>
    </>
  );
}

/** Renders 'X_YZ' as X with subscript YZ inside an SVG <text>. */
function Sub({ t }: { t: string }) {
  const [base, sub] = t.split('_');
  return (
    <>
      <tspan fontStyle="italic">{base}</tspan>
      <tspan dy={3} fontSize="0.75em">{sub}</tspan>
      <tspan dy={-3}>{'\u200a'}</tspan>
    </>
  );
}

export const ZONE_ORDER: ZoneId[] = ZONES.map((z) => z.id);
