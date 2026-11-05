import { Check, Link2, MousePointerClick, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { holtropMennen, resistanceCurve } from './engine/holtrop';
import { PRESETS, WORKED_EXAMPLE } from './engine/presets';
import type { HMInputs } from './engine/types';
import { checkInputs, checkValidity } from './engine/validity';
import { Issues, MethodNote, Summary } from './components/Results';
import { ShipDiagram } from './components/ShipDiagram';
import { SpeedCurve } from './components/SpeedCurve';
import { Steps } from './components/Steps';
import { Tex } from './components/Tex';
import { ZonePanel } from './components/ZonePanel';
import { COMPONENTS, type ComponentKey, type ZoneId } from './zones';

const STORAGE_KEY = 'hm-calculator-inputs-v1';

function encode(i: HMInputs) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(i)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s: string): HMInputs | null {
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? { ...WORKED_EXAMPLE, ...v } : null;
  } catch {
    return null;
  }
}
function initial(): HMInputs {
  const h = window.location.hash.match(/s=([\w-]+)/);
  if (h) {
    const d = decode(h[1]);
    if (d) return d;
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { ...WORKED_EXAMPLE, ...JSON.parse(s) };
  } catch {
    /* storage unavailable */
  }
  return WORKED_EXAMPLE;
}

export default function App() {
  const [inputs, setInputs] = useState<HMInputs>(initial);
  const [zone, setZone] = useState<ZoneId>(1);
  const [hoverComp, setHoverComp] = useState<ComponentKey | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof HMInputs>(k: K, v: HMInputs[K]) => setInputs((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* ignore */
    }
  }, [inputs]);

  const { result, curve, issues } = useMemo(() => {
    const inputIssues = checkInputs(inputs);
    if (inputIssues.some((i) => i.severity === 'error')) return { result: null, curve: [], issues: inputIssues };
    const result = holtropMennen(inputs, inputs.designSpeed);
    const curve = resistanceCurve(inputs);
    const bad = !Number.isFinite(result.RT);
    const all = [...inputIssues, ...checkValidity(inputs, result)];
    if (bad) all.unshift({ severity: 'error', message: 'The formulas returned a non-finite value for these inputs. Check the hull coefficients.' });
    return { result: bad ? null : result, curve: bad ? [] : curve.filter((c) => Number.isFinite(c.RT)), issues: all };
  }, [inputs]);

  const errorZones = issues.filter((i) => i.severity === 'error' && i.zone).map((i) => i.zone as ZoneId);
  const highlight = hoverComp ? COMPONENTS.find((c) => c.key === hoverComp)!.zones : [];

  const presetId = PRESETS.find((p) => JSON.stringify(p.inputs) === JSON.stringify(inputs))?.id ?? '';

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${encode(inputs)}`;
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: URL is still in the address bar */
    }
  };

  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 pb-2 pt-7 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Ship resistance and propulsion</p>
            <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">Holtrop–Mennen resistance calculator</h1>
            <div className="mt-1 overflow-x-auto text-[13px] text-ink-2">
              <Tex tex="R_T = R_F(1+k_1) + R_{APP} + R_W + R_B + R_{TR} + R_A" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-ink-2">
              <span className="sr-only sm:not-sr-only">Preset</span>
              <select
                className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-sm"
                value={presetId}
                onChange={(e) => {
                  const p = PRESETS.find((x) => x.id === e.target.value);
                  if (p) setInputs(structuredClone(p.inputs));
                }}
              >
                {presetId === '' && <option value="">Custom ship</option>}
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id} title={p.description}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setInputs(structuredClone(WORKED_EXAMPLE))}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink-2 shadow-sm transition hover:border-accent hover:text-accent"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-navy"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? 'Link copied' : 'Share link'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Ship diagram" className="card overflow-hidden p-2 sm:p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
              <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <MousePointerClick size={15} className="text-accent" />
                Each numbered marker is one step of the method. Hover to preview, click to enter values.
              </p>
              <p className="text-[11.5px] text-ink-3">Sheer profile, schematic. Bulb, transom and bow wave follow your inputs.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl">
              <div className="min-w-[720px] lg:min-w-0">
                <ShipDiagram inputs={inputs} result={result} active={zone} highlight={highlight} onSelect={setZone} errorZones={errorZones} />
              </div>
            </div>
            <p className="mt-1 px-3 pb-1 text-[11.5px] text-ink-3 sm:hidden">Swipe sideways to see the whole ship.</p>
          </section>

          {/* Panel appears here on small screens */}
          <div className="lg:hidden">
            <ZonePanel zone={zone} onZone={setZone} inputs={inputs} result={result} issues={issues} set={set} />
          </div>

          {result ? (
            <Summary r={result} onHoverComponent={setHoverComp} />
          ) : (
            <section className="rounded-[1.25rem] border border-red-200 bg-red-50/80 p-5 text-[14px] text-red-900">
              <h2 className="font-semibold">No result yet</h2>
              <p className="mt-1">Fix the inputs listed below to run the calculation.</p>
            </section>
          )}
          <Issues issues={issues} onZone={(z) => setZone(z)} />
          {result && curve.length > 1 && <SpeedCurve curve={curve} designSpeed={inputs.designSpeed} />}
          {result && <Steps inputs={inputs} result={result} active={zone} onSelect={(n) => setZone(n as ZoneId)} />}
          <MethodNote />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pb-2">
            <ZonePanel zone={zone} onZone={setZone} inputs={inputs} result={result} issues={issues} set={set} />
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 text-center text-[12px] text-ink-3 sm:px-8">
        Holtrop, J. &amp; Mennen, G.G.J. (1982), “An approximate power prediction method”, International Shipbuilding Progress 29. Regression formulas from MARIN model tests and trials.
      </footer>
    </div>
  );
}
