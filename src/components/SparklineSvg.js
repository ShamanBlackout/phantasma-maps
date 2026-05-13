import React from "react";

export default function SparklineSvg({
  data,
  height = 36,
  valueKey = "volume",
  scaleMode = "zeroMax",
}) {
  if (!data || data.length < 2) return null;
  const W = 200;
  const H = height;
  const values = data.map((point) => Number(point?.[valueKey]) || 0);
  const minValue = scaleMode === "auto" ? Math.min(...values) : 0;
  const maxValue = Math.max(...values, 1);
  const range = Math.max(maxValue - minValue, 1);
  const isFlat = values.every((value) => value === values[0]);
  const step = W / (data.length - 1);
  const points = values
    .map((value, index) => {
      const normalizedValue = isFlat
        ? value > 0
          ? 0.5
          : 0
        : (value - minValue) / range;
      const x = (index * step).toFixed(1);
      const y = (H - 4 - normalizedValue * (H - 8)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="sparkline-svg"
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgba(var(--accent-rgb), 0.85)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
