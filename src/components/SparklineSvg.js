import React from "react";

export default function SparklineSvg({ data, height = 36 }) {
  if (!data || data.length < 2) return null;
  const W = 200;
  const H = height;
  const volumes = data.map((d) => Number(d.volume) || 0);
  const maxVol = Math.max(...volumes, 1);
  const step = W / (data.length - 1);
  const points = volumes
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - 4 - (v / maxVol) * (H - 8)).toFixed(1);
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
