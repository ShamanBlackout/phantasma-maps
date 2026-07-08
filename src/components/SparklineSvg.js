import React, { useState, useMemo } from "react";

const W = 200;

function formatCompactVolume(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function fillDateGaps(rawData) {
  if (!rawData || rawData.length < 2) return rawData ?? [];
  const sorted = [...rawData].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const first = new Date(sorted[0].date + "T00:00:00Z");
  const last = new Date(sorted[sorted.length - 1].date + "T00:00:00Z");
  const dayCount = Math.round((last - first) / 86400000) + 1;
  if (dayCount > 366 || dayCount <= sorted.length) return sorted;
  const byDate = new Map(sorted.map((p) => [p.date, p]));
  const filled = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(first.getTime() + i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    filled.push(
      byDate.get(dateStr) ?? { date: dateStr, txCount: 0, volume: 0 },
    );
  }
  return filled;
}

export default function SparklineSvg({
  data,
  height = 52,
  valueKey = "volume",
  scaleMode = "zeroMax",
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const filled = useMemo(() => fillDateGaps(data), [data]);

  if (!filled || filled.length < 2) return null;

  const H = height;
  const TX_ZONE = 10;
  const LINE_ZONE = H - TX_ZONE;

  const values = filled.map((p) => Number(p?.[valueKey]) || 0);
  const minValue = scaleMode === "auto" ? Math.min(...values) : 0;
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;
  const isFlat = values.every((v) => v === values[0]);

  const n = filled.length;
  const step = W / Math.max(n - 1, 1);

  const coords = values.map((value, i) => {
    const norm = isFlat ? (value > 0 ? 0.5 : 0) : (value - minValue) / range;
    return {
      x: +(i * step).toFixed(1),
      y: +(LINE_ZONE - 3 - norm * (LINE_ZONE - 8)).toFixed(1),
    };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`)
    .join(" ");
  const areaPath =
    linePath + ` L${coords[n - 1].x},${LINE_ZONE} L0,${LINE_ZONE} Z`;

  const txCounts = filled.map((p) => Number(p.txCount) || 0);
  const maxTx = Math.max(...txCounts, 1);
  const activeDayCount = filled.filter(
    (point) => Number(point.txCount) > 0,
  ).length;
  const totalTxCount = txCounts.reduce((sum, count) => sum + count, 0);

  const hoverPoint = hoverIndex !== null ? filled[hoverIndex] : null;
  const hoverCoord = hoverIndex !== null ? coords[hoverIndex] : null;
  const tooltipLeftPct =
    hoverIndex !== null
      ? Math.min(Math.max((hoverIndex / Math.max(n - 1, 1)) * 100, 8), 88)
      : 0;

  return (
    <div className="sparkline-wrap">
      <div className="sparkline-legend" aria-hidden="true">
        <span className="sparkline-legend-item">
          <span className="sparkline-legend-swatch is-volume" />
          Volume line + fill
        </span>
        <span className="sparkline-legend-item">
          <span className="sparkline-legend-swatch is-tx" />
          {totalTxCount} txs across {activeDayCount} days
        </span>
      </div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="sparkline-svg"
      >
        <defs>
          <linearGradient id="wallet-activity-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.42)" />
            <stop offset="100%" stopColor="rgba(var(--accent-rgb), 0.04)" />
          </linearGradient>
        </defs>

        {/* area fill */}
        <path d={areaPath} fill="url(#wallet-activity-area)" />

        {/* volume line */}
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="rgba(var(--accent-rgb), 0.98)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* tx zone separator */}
        <line
          x1="0"
          y1={LINE_ZONE}
          x2={W}
          y2={LINE_ZONE}
          stroke="rgba(var(--accent-rgb), 0.18)"
          strokeWidth="0.8"
        />

        {/* txCount dots */}
        {txCounts.map((tx, i) => {
          if (tx === 0) return null;
          const r = Math.max(2.2, (tx / maxTx) * 5.4);
          return (
            <circle
              key={i}
              cx={coords[i].x}
              cy={H - TX_ZONE / 2}
              r={r}
              fill="rgba(var(--accent-rgb), 0.92)"
              stroke="rgba(8, 12, 20, 0.95)"
              strokeWidth="1"
            />
          );
        })}

        {/* hover highlight dot */}
        {hoverCoord && (
          <circle
            cx={hoverCoord.x}
            cy={hoverCoord.y}
            r={3}
            fill="rgb(var(--accent-rgb))"
            stroke="var(--surface-1, #13131f)"
            strokeWidth="1.5"
          />
        )}

        {/* per-day hit rects */}
        {filled.map((_, i) => {
          const cx = coords[i].x;
          const hitX = Math.max(0, cx - step / 2);
          const hitW = Math.min(W, cx + step / 2) - hitX;
          return (
            <rect
              key={i}
              x={hitX}
              y={0}
              width={hitW}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          );
        })}
      </svg>

      {hoverPoint && (
        <div
          className="sparkline-tooltip"
          style={{ left: `${tooltipLeftPct}%` }}
        >
          <div className="sparkline-tooltip-date">{hoverPoint.date}</div>
          <div className="sparkline-tooltip-row">
            <span>Txs</span>
            <strong>{hoverPoint.txCount}</strong>
          </div>
          <div className="sparkline-tooltip-row">
            <span>Vol</span>
            <strong>{formatCompactVolume(hoverPoint.volume)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
