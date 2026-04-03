import React, { useEffect, useRef, useState } from "react";
import { HOLDER_TYPES } from "../data/mockData";
import { getHolderPalette } from "../theme/holderPalettes";

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function StatsPanel({
  holders,
  tokenInfo,
  availableTokens,
  selectedTokenSymbol,
  onTokenChange,
  tokenSelectorStatus,
  selectedNode,
  onNodeSelect,
  copiedAddress,
  onCopyAddress,
  onOpenTransactions,
  colorTheme,
  isCollapsed,
  onToggleCollapse,
}) {
  const holderPalette = getHolderPalette(colorTheme);
  const totalSupply = Number(tokenInfo.totalSupply) || 0;
  const hasPrice = Number.isFinite(tokenInfo.price);
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [tokenMenuOffset, setTokenMenuOffset] = useState({ x: 0, y: 0 });
  const tokenSearchInputRef = useRef(null);

  const top10pct = holders
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .reduce((sum, h) => sum + h.value, 0);
  const top10share =
    totalSupply > 0 ? ((top10pct / totalSupply) * 100).toFixed(1) : "0.0";

  const sorted = holders.slice().sort((a, b) => b.value - a.value);
  const normalizedTokenSearch = tokenSearchQuery.trim().toLowerCase();
  const filteredTokenSymbols = (availableTokens || []).filter((tokenSymbol) =>
    String(tokenSymbol || "")
      .toLowerCase()
      .includes(normalizedTokenSearch),
  );

  useEffect(() => {
    if (!isTokenMenuOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setIsTokenMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTokenMenuOpen]);

  useEffect(() => {
    if (!isTokenMenuOpen) {
      setTokenSearchQuery("");
      return;
    }

    window.requestAnimationFrame(() => {
      tokenSearchInputRef.current?.focus();
      tokenSearchInputRef.current?.select();
    });
  }, [isTokenMenuOpen]);

  function handleTokenPick(tokenSymbol) {
    onTokenChange?.(tokenSymbol);
    setIsTokenMenuOpen(false);
  }

  function handleTokenMenuToggle(event) {
    if (isTokenMenuOpen) {
      setIsTokenMenuOpen(false);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    const triggerCenterY = rect.top + rect.height / 2;
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    setTokenMenuOffset({
      x: triggerCenterX - viewportCenterX,
      y: triggerCenterY - viewportCenterY,
    });
    setIsTokenMenuOpen(true);
  }

  return (
    <aside className={`stats-panel ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="stats-panel-toolbar">
        <div className="stats-panel-title">Insights</div>
        <button
          type="button"
          className="stats-panel-toggle"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed ? "Expand stats panel" : "Collapse stats panel"
          }
          title={isCollapsed ? "Expand stats panel" : "Collapse stats panel"}
        >
          <span
            className={`stats-panel-toggle-icon ${isCollapsed ? "is-collapsed" : ""}`}
          >
            ‹
          </span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="stats-panel-content">
          {/* Token Info */}
          <div className="stats-card">
            <div className="stats-token-header">
              <div className="stats-token-icon">◈</div>
              <div className="stats-token-meta">
                <div className="stats-token-name">{tokenInfo.name}</div>
                <div className="stats-token-fullname">{tokenInfo.fullName}</div>
              </div>
            </div>
            <div className="stats-token-select-row">
              <span className="stats-label">Tracked Token</span>
              <button
                type="button"
                className={`map-selected-show-transfers stats-token-picker-trigger ${isTokenMenuOpen ? "is-open" : ""}`}
                onClick={handleTokenMenuToggle}
                aria-haspopup="listbox"
                aria-expanded={isTokenMenuOpen}
                aria-label="Open tracked token list"
              >
                <span className="stats-token-picker-label">Tracked Token</span>
                <span>{selectedTokenSymbol || "Select Token"}</span>
                <span className="stats-token-picker-caret">▾</span>
              </button>
            </div>
            {tokenSelectorStatus ? (
              <div className="stats-token-select-status">
                {tokenSelectorStatus}
              </div>
            ) : null}
            <div className="stats-token-row">
              <span className="stats-label">Chain</span>
              <span className="stats-value">{tokenInfo.chain}</span>
            </div>
            <div className="stats-token-row">
              <span className="stats-label">Total Supply</span>
              <span className="stats-value">
                {totalSupply > 0 ? fmt(totalSupply) : "N/A"}
              </span>
            </div>
            <div className="stats-token-row">
              <span className="stats-label">Price</span>
              <span className="stats-value">
                {hasPrice ? `$${tokenInfo.price.toFixed(5)}` : "N/A"}
              </span>
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
            {Object.entries(HOLDER_TYPES).map(([key, { label }]) => (
              <div className="legend-row" key={key}>
                <span
                  className="legend-dot"
                  style={{ background: holderPalette[key] || "#74b9ff" }}
                />
                <span className="legend-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Selected Node Info */}
          {selectedNode && (
            <div className="stats-card stats-card-selected stats-node-detail-card">
              <div className="stats-section-title">Selected</div>
              <div className="stats-node-detail-head">
                <div>
                  <div className="stats-node-detail-title">
                    {selectedNode.label}
                  </div>
                  <div className="stats-node-detail-addr-row">
                    <div className="stats-node-detail-addr">
                      {selectedNode.shortAddr}
                    </div>
                    <button
                      type="button"
                      className="stats-node-detail-action"
                      onClick={() => onCopyAddress?.(selectedNode.id)}
                      aria-label="Copy address"
                      title="Copy address"
                    >
                      {copiedAddress === selectedNode.id ? "Copied" : "Copy"}
                    </button>
                    <a
                      className="stats-node-detail-action"
                      href={`https://explorer.phantasma.info/address/${encodeURIComponent(selectedNode.id)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Open address on Phantasma Explorer"
                      title="Open on Phantasma Explorer"
                    >
                      ↗
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className="stats-node-detail-close"
                  onClick={() => onNodeSelect(null)}
                  aria-label="Deselect node"
                >
                  ×
                </button>
              </div>
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
                <span className="stats-label">Sent Tx</span>
                <span className="stats-value">
                  {(selectedNode.sentTransactions ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="stats-token-row">
                <span className="stats-label">Received Tx</span>
                <span className="stats-value">
                  {(selectedNode.receivedTransactions ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="stats-token-row">
                <span className="stats-label">Type</span>
                <span
                  className="stats-value"
                  style={{
                    color: holderPalette[selectedNode.type] || "#74b9ff",
                  }}
                >
                  {HOLDER_TYPES[selectedNode.type]?.label}
                </span>
              </div>
              <button
                type="button"
                className="map-selected-show-transfers"
                onClick={() => onOpenTransactions?.()}
              >
                Show All Transactions
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
                    style={{ background: holderPalette[h.type] || "#74b9ff" }}
                  />
                  <span className="holder-addr">{h.shortAddr}</span>
                  <span className="holder-pct">{h.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isTokenMenuOpen ? (
        <div
          className="token-picker-backdrop"
          onClick={() => setIsTokenMenuOpen(false)}
        >
          <div
            className="token-picker-modal"
            onClick={(event) => event.stopPropagation()}
            style={{
              "--token-picker-offset-x": `${tokenMenuOffset.x}px`,
              "--token-picker-offset-y": `${tokenMenuOffset.y}px`,
            }}
          >
            <div className="token-picker-modal-head">
              <div>
                <h3>Select Token</h3>
                <p>Search and switch tracked tokens</p>
              </div>
              <button
                type="button"
                className="token-picker-close"
                onClick={() => setIsTokenMenuOpen(false)}
                aria-label="Close token picker"
              >
                ×
              </button>
            </div>
            <div className="token-picker-modal-body">
              <div className="stats-token-picker-search-wrap">
                <input
                  ref={tokenSearchInputRef}
                  className="stats-token-picker-search"
                  type="text"
                  value={tokenSearchQuery}
                  onChange={(event) => setTokenSearchQuery(event.target.value)}
                  placeholder="Search all tokens"
                  aria-label="Search tokens"
                />
              </div>
              <div className="stats-token-picker-list" role="listbox">
                {filteredTokenSymbols.length ? (
                  filteredTokenSymbols.map((tokenSymbol) => (
                    <button
                      key={tokenSymbol}
                      type="button"
                      className={`stats-token-picker-item ${tokenSymbol === selectedTokenSymbol ? "is-active" : ""}`}
                      onClick={() => handleTokenPick(tokenSymbol)}
                      role="option"
                      aria-selected={tokenSymbol === selectedTokenSymbol}
                    >
                      <span>{tokenSymbol}</span>
                      {tokenSymbol === selectedTokenSymbol ? (
                        <span className="token-picker-item-selected">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="stats-token-picker-empty">
                    No tokens found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
