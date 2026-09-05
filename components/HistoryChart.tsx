'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '@/lib/format';

/**
 * Categorical slots 1 and 2 from the validated dark palette. Checked against the
 * card surface (#12161b): CVD ΔE 26.8, normal-vision ΔE 31.8, both above 3:1 contrast.
 */
const SERIES_VALUE = '#3987e5';
const SERIES_INVESTED = '#d95926';

type Point = { date: string; value: number; invested: number };

const RANGES = [
  { label: '1Y', years: 1 },
  { label: '3Y', years: 3 },
  { label: 'All', years: 0 },
] as const;

export default function HistoryChart({ series }: { series: [string, number, number][] }) {
  const [rangeYears, setRangeYears] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  // Render at real pixel width so labels stay legible at every screen size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const points: Point[] = useMemo(() => {
    const all = series.map(([date, value, invested]) => ({ date, value, invested }));
    if (!rangeYears) return all;
    const cutoff = new Date(all[all.length - 1].date);
    cutoff.setFullYear(cutoff.getFullYear() - rangeYears);
    const iso = cutoff.toISOString().slice(0, 10);
    return all.filter((p) => p.date >= iso);
  }, [series, rangeYears]);

  const H = 320;
  const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotW = Math.max(120, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;

  const maxY = Math.max(...points.map((p) => Math.max(p.value, p.invested)));
  const { max: niceMax, step: tickStep } = niceScale(maxY, 4);
  const x = (i: number) => PAD.left + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / niceMax) * plotH;

  const valuePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join('');
  // Invested only changes when something is bought, so a step reads truer than a slope.
  const investedPath = points
    .map((p, i) => (i ? `H${x(i)}V${y(p.invested)}` : `M${x(i)},${y(p.invested)}`))
    .join('');
  const areaPath = `${valuePath}L${x(points.length - 1)},${PAD.top + plotH}L${x(0)},${PAD.top + plotH}Z`;

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= niceMax + 1e-6; t += tickStep) out.push(t);
    return out;
  }, [niceMax, tickStep]);

  // One label per year, at the first point of each year.
  const yearMarks = useMemo(() => {
    const seen = new Set<string>();
    const out: { i: number; label: string }[] = [];
    points.forEach((p, i) => {
      const yr = p.date.slice(0, 4);
      if (!seen.has(yr)) {
        seen.add(yr);
        out.push({ i, label: yr });
      }
    });
    return out;
  }, [points]);

  const last = points[points.length - 1];
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
  const active = hover === null ? null : points[hover];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ratio = (px - PAD.left) / plotW;
    const i = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <section className="mb-6 rounded-2xl border border-ink-500 bg-ink-800 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Portfolio value since 2021</h2>
          <p className="mt-1 text-sm text-slate-400">
            What the coins you held were worth each week, against what you had put in by then.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-ink-500">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRangeYears(r.years)}
                className={`px-3 py-1.5 text-xs ${
                  rangeYears === r.years ? 'bg-ink-600 text-white' : 'text-slate-400 hover:bg-ink-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTable((s) => !s)}
            className="rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-600"
            aria-expanded={showTable}
          >
            {showTable ? 'Hide table' : 'Table'}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES_VALUE }} />
          <span className="text-slate-300">Portfolio value</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES_INVESTED }} />
          <span className="text-slate-300">Net invested</span>
        </span>
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={H}
          className="block touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Portfolio value from ${points[0]?.date} to ${last?.date}, peaking at ${money(peak.value)}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke="#2b3138"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="tnum" fill="#64748b" fontSize={11}>
                {t === 0 ? '£0' : `£${(t / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}k`}
              </text>
            </g>
          ))}

          {yearMarks.map((m) => (
            <text key={m.label} x={x(m.i)} y={H - 8} textAnchor="middle" fill="#64748b" fontSize={11}>
              {m.label}
            </text>
          ))}

          <defs>
            <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_VALUE} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERIES_VALUE} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#valueFill)" />

          <path d={investedPath} fill="none" stroke={SERIES_INVESTED} strokeWidth={2} />
          <path d={valuePath} fill="none" stroke={SERIES_VALUE} strokeWidth={2} />

          {active && (
            <g>
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="#475569"
                strokeWidth={1}
              />
              <circle cx={x(hover!)} cy={y(active.invested)} r={4} fill={SERIES_INVESTED} stroke="#12161b" strokeWidth={2} />
              <circle cx={x(hover!)} cy={y(active.value)} r={4} fill={SERIES_VALUE} stroke="#12161b" strokeWidth={2} />
            </g>
          )}

          {/* Direct-label the endpoint only; the axis and tooltip carry the rest. */}
          {!active && last && (
            <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={SERIES_VALUE} stroke="#12161b" strokeWidth={2} />
          )}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-ink-500 bg-ink-900/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(x(hover!) - 70, 0), Math.max(0, width - 150)),
            }}
          >
            <p className="mb-1 text-slate-400">{longDate(active.date)}</p>
            <p className="tnum" style={{ color: SERIES_VALUE }}>
              {money(active.value)} value
            </p>
            <p className="tnum" style={{ color: SERIES_INVESTED }}>
              {money(active.invested)} invested
            </p>
            <p className={`mt-1 tnum ${active.value >= active.invested ? 'text-gain' : 'text-loss'}`}>
              {active.value >= active.invested ? '+' : '−'}
              {money(Math.abs(active.value - active.invested))}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Peak {money(peak.value)} in {longDate(peak.date)} · now {money(last?.value ?? 0)},{' '}
        {Math.abs(((last?.value ?? 0) / peak.value - 1) * 100).toFixed(0)}% below that high.
      </p>

      {showTable && (
        <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-ink-500">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-700">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Week</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-right font-medium">Net invested</th>
                <th className="px-3 py-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-ink-600/60">
                  <td className="px-3 py-1.5 text-slate-400">{p.date}</td>
                  <td className="px-3 py-1.5 text-right text-slate-200">{money(p.value)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{money(p.invested)}</td>
                  <td
                    className={`px-3 py-1.5 text-right ${p.value >= p.invested ? 'text-gain' : 'text-loss'}`}
                  >
                    {p.value >= p.invested ? '+' : '−'}
                    {money(Math.abs(p.value - p.invested))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Round the axis up to a step people read easily: 1, 2, 2.5 or 5 times a power of ten. */
function niceScale(max: number, targetTicks: number): { max: number; step: number } {
  const raw = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { max: Math.ceil(max / step) * step, step };
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
