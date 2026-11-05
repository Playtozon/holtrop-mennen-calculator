import { ChevronLeft, ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { APPENDAGE_TYPES } from '../engine/presets';
import type { Appendage, HMInputs, HMResult } from '../engine/types';
import type { Issue } from '../engine/validity';
import { sig } from '../format';
import { COMPONENTS, ZONES, zoneById, type FieldDef, type ZoneId } from '../zones';
import { buildSteps } from './Steps';
import { Tex } from './Tex';

interface Props {
  zone: ZoneId;
  onZone: (z: ZoneId) => void;
  inputs: HMInputs;
  result: HMResult | null;
  issues: Issue[];
  set: <K extends keyof HMInputs>(k: K, v: HMInputs[K]) => void;
}

export function ZonePanel({ zone, onZone, inputs, result, issues, set }: Props) {
  const z = zoneById(zone);
  const zoneIssues = issues.filter((i) => i.zone === zone && i.severity !== 'info');
  const outputs = result ? buildSteps(inputs, result)[zone - 1].rows : [];
  return (
    <section aria-labelledby="zone-title" className="flex flex-col gap-4">
      <nav aria-label="Steps of the method" className="card flex items-center gap-1 p-1.5">
        {ZONES.map((x) => {
          const hasErr = issues.some((i) => i.zone === x.id && i.severity === 'error');
          const isOn = zone === x.id;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onZone(x.id)}
              aria-pressed={isOn}
              title={`Step ${x.id}: ${x.title}`}
              className={`relative flex h-9 flex-1 items-center justify-center rounded-xl text-[13px] font-semibold transition ${
                isOn ? 'bg-accent text-white shadow-sm' : 'text-ink-2 hover:bg-accent-soft hover:text-accent'
              }`}
            >
              {x.id}
              {hasErr && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" aria-label="has an error" />}
            </button>
          );
        })}
      </nav>

      <div className="card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Step {z.id} of 8 · {z.where}
        </p>
        <h2 id="zone-title" className="mt-1 font-serif text-[22px] font-semibold text-ink">
          {z.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{z.blurb}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
          <span>Feeds</span>
          {z.drives.map((c) => {
            const comp = COMPONENTS.find((x) => x.key === c)!;
            return (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: comp.color }} />
                <Tex tex={comp.tex} />
              </span>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3.5">
          {zone === 4 && <AppendageEditor list={inputs.appendages} onChange={(l) => set('appendages', l)} />}
          {zone === 3 && <SternPicker value={inputs.Cstern} onChange={(v) => set('Cstern', v)} />}
          {z.fields.map((fd) => (
            <NumberField key={fd.key} def={fd} value={inputs[fd.key] as number | null} result={result} onChange={(v) => set(fd.key, v as never)} />
          ))}
          {zone === 3 && (
            <p className="text-[12px] leading-snug text-ink-3">
              The form factor also uses L, B, T, CP and lcb from step 1.
            </p>
          )}
        </div>

        {zoneIssues.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {zoneIssues.map((i, n) => (
              <li
                key={n}
                className={`rounded-lg px-3 py-2 text-[12.5px] ${i.severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}
              >
                {i.message}
              </li>
            ))}
          </ul>
        )}

        {outputs.length > 0 && (
          <div className="mt-5 rounded-xl bg-paper/70 px-3.5 py-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              This step at {result!.speedKn} kn
            </p>
            <table className="w-full text-[12.5px]">
              <tbody>
                {outputs.map(([sym, val], k) => (
                  <tr key={k} className="border-b border-line/60 last:border-0">
                    <td className="py-1 pr-2 text-ink-2">
                      <Tex tex={sym} />
                    </td>
                    <td className="num py-1 text-right font-medium text-ink">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <button
            type="button"
            disabled={zone === 1}
            onClick={() => onZone((zone - 1) as ZoneId)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-ink-2 hover:text-accent disabled:opacity-30"
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <button
            type="button"
            disabled={zone === 8}
            onClick={() => onZone((zone + 1) as ZoneId)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-ink-2 hover:text-accent disabled:opacity-30"
          >
            Next step <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}

function NumberField({
  def,
  value,
  result,
  onChange,
}: {
  def: FieldDef;
  value: number | null;
  result: HMResult | null;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  const show = (v: number | null) => (v == null ? '' : String(v));
  const [draft, setDraft] = useState(show(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(show(value));
  }, [value, focused]);

  const parsed = draft.trim() === '' ? null : Number(draft.replace(',', '.'));
  const invalid = draft.trim() !== '' ? !Number.isFinite(parsed) : !def.optional;
  const auto = def.optional && result && def.auto ? def.auto(result) : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink">{def.label}</span>
        <Tex tex={def.sym} className="text-ink-2" />
      </label>
      <div className={`flex items-stretch overflow-hidden rounded-xl border bg-white transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10 ${invalid ? 'border-red-500' : 'border-line'}`}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="num min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] text-ink outline-none placeholder:text-ink-3"
          value={draft}
          placeholder={auto != null ? `auto: ${sig(auto, 5)}` : ''}
          aria-invalid={invalid}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setDraft(show(value));
          }}
          onChange={(e) => {
            const s = e.target.value;
            setDraft(s);
            if (s.trim() === '') {
              if (def.optional) onChange(null);
              return;
            }
            const n = Number(s.replace(',', '.'));
            if (Number.isFinite(n)) onChange(n);
          }}
          onKeyDown={(e) => {
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && def.step) {
              e.preventDefault();
              const base = value ?? auto ?? 0;
              const n = +(base + (e.key === 'ArrowUp' ? 1 : -1) * def.step * (e.shiftKey ? 10 : 1)).toPrecision(10);
              onChange(n);
              setDraft(String(n));
            }
          }}
        />
        {def.optional && value != null && (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 border-l border-line px-2 text-[11px] text-accent hover:bg-paper" title="Use regression estimate">
            <Wand2 size={12} /> auto
          </button>
        )}
        {def.unit && <span className="flex items-center border-l border-line bg-paper px-2.5 text-[12px] text-ink-2">{def.unit}</span>}
      </div>
      {def.hint && <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{def.hint}</p>}
    </div>
  );
}

const STERNS: { v: number; label: string; path: string }[] = [
  { v: -25, label: 'Pram with gondola', path: 'M4,4 L4,16 Q4,22 14,22 L14,40 Q20,46 26,40 L26,22 Q36,22 36,16 L36,4' },
  { v: -10, label: 'V-shaped', path: 'M4,4 L20,44 L36,4' },
  { v: 0, label: 'Normal', path: 'M4,4 Q6,30 20,44 Q34,30 36,4' },
  { v: 10, label: 'U with Hogner stern', path: 'M4,4 L4,26 Q4,44 20,44 Q36,44 36,26 L36,4' },
];

function SternPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 flex w-full items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink">Afterbody section shape</span>
        <Tex tex="C_{stern}" className="text-ink-2" />
      </legend>
      <div className="grid grid-cols-4 gap-1.5">
        {STERNS.map((s) => (
          <button
            key={s.v}
            type="button"
            aria-pressed={value === s.v}
            onClick={() => onChange(s.v)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center text-[10.5px] leading-tight transition ${
              value === s.v ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-white text-ink-2 hover:border-accent'
            }`}
          >
            <svg viewBox="0 0 40 48" className="h-10 w-9" aria-hidden>
              <line x1="0" x2="40" y1="4" y2="4" stroke="#1c5cab" strokeWidth="1.2" />
              <path d={s.path} fill="#eef2f6" stroke="#0f2a44" strokeWidth="1.8" />
            </svg>
            <span>{s.label}</span>
            <span className="num font-semibold">{s.v > 0 ? `+${s.v}` : s.v}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

let nextId = 1;
function AppendageEditor({ list, onChange }: { list: Appendage[]; onChange: (l: Appendage[]) => void }) {
  const update = (id: string, patch: Partial<Appendage>) => onChange(list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink">Appendages</span>
        <Tex tex="(1+k_2)_{eq} = \frac{\sum (1+k_2) S_{APP}}{\sum S_{APP}}" className="text-[11px] text-ink-2" />
      </div>
      <div className="flex flex-col gap-2">
        {list.map((a) => (
          <div key={a.id} className="grid grid-cols-[1fr_74px_64px_28px] items-center gap-1.5 rounded-xl border border-line bg-white p-1.5">
            <select
              aria-label="Appendage type"
              className="min-w-0 rounded border border-line bg-white px-1.5 py-1.5 text-[12.5px]"
              value={APPENDAGE_TYPES.some((t) => t.name === a.name) ? a.name : ''}
              onChange={(e) => {
                const t = APPENDAGE_TYPES.find((x) => x.name === e.target.value);
                if (t) update(a.id, { name: t.name, onePlusK2: t.onePlusK2 });
              }}
            >
              {!APPENDAGE_TYPES.some((t) => t.name === a.name) && <option value="">{a.name}</option>}
              {APPENDAGE_TYPES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.range})
                </option>
              ))}
            </select>
            <MiniNum label="Area, m²" value={a.area} onChange={(v) => update(a.id, { area: v })} suffix="m²" />
            <MiniNum label="1 + k2" value={a.onePlusK2} onChange={(v) => update(a.id, { onePlusK2: v })} suffix="" />
            <button
              type="button"
              onClick={() => onChange(list.filter((x) => x.id !== a.id))}
              className="flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-red-50 hover:text-red-700"
              aria-label={`Remove ${a.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="text-[12px] text-ink-3">No appendages: R_APP = 0 (plus any bow-thruster drag).</p>}
        <button
          type="button"
          onClick={() => onChange([...list, { id: `n${Date.now()}${nextId++}`, name: 'Bilge keels', area: 20, onePlusK2: 1.4 }])}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-1.5 text-[12.5px] font-medium text-accent hover:border-accent hover:bg-accent-soft/60"
        >
          <Plus size={14} /> Add appendage
        </button>
      </div>
    </div>
  );
}

function MiniNum({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        title={label}
        className="num w-full rounded border border-line px-1.5 py-1.5 pr-6 text-right text-[12.5px] outline-none focus:ring-2 focus:ring-accent/40"
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-3">{suffix}</span>}
    </label>
  );
}
