import React from "react";
import { HOLDER_TYPES } from "../data/mockData";

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function StatsPanel({
  holders,
  tokenInfo,
  selectedNode,
  onNodeSelect,
}) {
  const top10pct = holders
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .reduce((sum, h) => sum + h.value, 0);
  const top10share = ((top10pct / tokenInfo.totalSupply) * 100).toFixed(1);

  const sorted = holders.slice().sort((a, b) => b.value - a.value);

  return (
    <aside className="stats-panel">
      {/* Token Info */}
      <div className="stats-card">
        <div className="stats-token-header">
          <div className="stats-token-icon">◈</div>
          <div>
            <div className="stats-token-name">{tokenInfo.name}</div>
            <div className="stats-token-fullname">{tokenInfo.fullName}</div>
          </div>
        </div>
        <div className="stats-token-row">
          <span className="stats-label">Chain</span>
          <span className="stats-value">{tokenInfo.chain}</span>
        </div>
        <div className="stats-token-row">
          <span className="stats-label">Total Supply</span>
          <span className="stats-value">{fmt(tokenInfo.totalSupply)}</span>
        </div>
        <div className="stats-token-row">
          <span className="stats-label">Price</span>
          <span className="stats-value">${tokenInfo.price.toFixed(3)}</span>
        </div>
        <div className="stats-token-row">
          <span className="stats-label">Top 10 Hold</span>
          <span className="stats-value stats-value-highlight">
            {top10share}%
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="stats-card">
        <div className="stats-section-title">Legend</div>
        {Object.entries(HOLDER_TYPES).map(([key, { label, color }]) => (
          <div className="legend-row" key={key}>
            <span className="legend-dot" style={{ background: color }} />
            <span className="legend-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="stats-card stats-card-selected">
          <div className="stats-section-title">Selected</div>
          <div className="selected-label">{selectedNode.label}</div>
          <div className="selected-addr">{selectedNode.shortAddr}</div>
          <div className="stats-token-row">
            <span className="stats-label">Amount</span>
            <span className="stats-value">
              {fmt(selectedNode.value)} {tokenInfo.name}
            </span>
          </div>
          <div className="stats-token-row">
            <span className="stats-label">Share</span>
            <span className="stats-value stats-value-highlight">
              {selectedNode.pct}%
            </span>
          </div>
          <div className="stats-token-row">
            <span className="stats-label">Type</span>
            <span
              className="stats-value"
              style={{ color: HOLDER_TYPES[selectedNode.type]?.color }}
            >
              {HOLDER_TYPES[selectedNode.type]?.label}
            </span>
          </div>
          <button className="btn-deselect" onClick={() => onNodeSelect(null)}>
            ✕ Deselect
          </button>
        </div>
      )}

      {/* Top Holders List */}
      <div className="stats-card stats-card-holders">
        <div className="stats-section-title">Top Holders</div>
        <div className="holders-list">
          {sorted.slice(0, 15).map((h, i) => (
            <div
              key={h.id}
              className={`holder-row ${selectedNode?.id === h.id ? "holder-row-active" : ""}`}
              onClick={() => onNodeSelect(h)}
            >
              <span className="holder-rank">#{i + 1}</span>
              <span
                className="holder-dot"
                style={{ background: HOLDER_TYPES[h.type]?.color || "#74b9ff" }}
              />
              <span className="holder-addr">{h.shortAddr}</span>
              <span className="holder-pct">{h.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
