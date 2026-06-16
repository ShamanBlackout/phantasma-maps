import React, { useEffect, useMemo, useRef, useState } from "react";
import { HOLDER_TYPES } from "../data/mockData";
import { getHolderPalette } from "../theme/holderPalettes";

const LEGEND_ORDER = ["minor", "medium", "large", "major", "dominant"];

function fmt(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n > 0) return n.toFixed(8).replace(/\.?0+$/, "");
  return "0";
}

function formatTrendDelta(value, digits = 0, suffix = "") {
  const numeric = Number(value) || 0;
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(digits)}${suffix}`;
}

function shortenAddress(address) {
  const value = String(address || "").trim();
  if (!value) return "N/A";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

export default function StatsPanel({
  holders,
  summaryHolders,
  topMovers,
  topMoversLoading,
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
  isConnectionsView,
  onClearConnections,
  canShowConnections,
  onShowConnections,
  onShowConnectionsForAddress,
  connectionMinAmount,
  onConnectionMinAmountChange,
  onRefreshConnections,
  isMobileViewport,
  colorTheme,
  activeLegendFilter,
  onLegendFilterChange,
  isCollapsed,
  onToggleCollapse,
  isLoading,
  executiveSummary,
  mapDataStatus,
  onRetryMapLoad,
}) {
  const holderPalette = getHolderPalette(colorTheme);
  const allHolders = Array.isArray(summaryHolders) ? summaryHolders : holders;
  const walletsTracked = Number.isFinite(tokenInfo?.globalHolderCount)
    ? Math.max(0, Math.floor(Number(tokenInfo.globalHolderCount)))
    : allHolders.length;
  const totalSupply = Number(tokenInfo.totalSupply) || 0;
  const currentSupply = Number(tokenInfo.currentSupply) || 0;
  const maxSupply = Number(tokenInfo.maxSupply) || 0;
  const hasMetadataMaxSupply = Boolean(tokenInfo.hasMetadataMaxSupply);
  const hasPrice = Number.isFinite(tokenInfo.price);
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [tokenMenuOffset, setTokenMenuOffset] = useState({ x: 0, y: 0 });
  const tokenSearchInputRef = useRef(null);

  const top10pct = allHolders
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .reduce((sum, h) => sum + h.value, 0);
  const top10share =
    currentSupply > 0
      ? Math.min(100, (top10pct / currentSupply) * 100).toFixed(1)
      : "0.0";
  const selectedNodeShare = selectedNode
    ? currentSupply > 0
      ? (((Number(selectedNode.value) || 0) / currentSupply) * 100).toFixed(2)
      : (Number(selectedNode.pct) || 0).toFixed(2)
    : "0.00";

  const sorted = useMemo(() => {
    const byId = new Map();
    holders.forEach((holder) => {
      const holderId = String(holder?.id || "").trim();
      if (!holderId) return;

      const existing = byId.get(holderId);
      if (
        !existing ||
        Number(holder?.value || 0) > Number(existing?.value || 0)
      ) {
        byId.set(holderId, holder);
      }
    });

    return [...byId.values()].sort((a, b) => b.value - a.value);
  }, [holders]);
  const legendSourceHolders = Array.isArray(holders) ? holders : [];
  const legendCounts = legendSourceHolders.reduce((counts, holder) => {
    const key = String(holder?.type || "minor");
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const orderedLegendItems = LEGEND_ORDER.map((key) => ({
    key,
    label: HOLDER_TYPES[key]?.label || key,
    count: legendCounts[key] || 0,
  }));
  const normalizedTokenSearch = tokenSearchQuery.trim().toLowerCase();
  const filteredTokenSymbols = (availableTokens || []).filter((tokenSymbol) =>
    String(tokenSymbol || "")
      .toLowerCase()
      .includes(normalizedTokenSearch),
  );
  const resolvedTopMovers = Array.isArray(topMovers) ? topMovers : [];
  const hasMinimumConnectionBalance = Number(connectionMinAmount) > 0;

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

  const hasMapStatusError = String(mapDataStatus || "")
    .toLowerCase()
    .match(/failed|unavailable|unable/);

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

  function handleTopMoverClick(address) {
    const moverAddress = String(address || "").trim();
    if (!moverAddress) return;
    onShowConnectionsForAddress?.(moverAddress);
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
        <div>
          <div className="stats-panel-title">Insights</div>
          {!isCollapsed ? (
            <div className="stats-panel-subtitle">
              Live distribution, legend scope, and wallet context
            </div>
          ) : null}
        </div>
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
          {isLoading ? (
            <>
              <div
                className="stats-card stats-card-skeleton"
                aria-hidden="true"
              >
                <div className="skeleton-line skeleton-line-title" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
              <div
                className="stats-card stats-card-skeleton"
                aria-hidden="true"
              >
                <div className="skeleton-line skeleton-line-title" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            </>
          ) : null}

          {/* Token Info */}
          <div
            className="stats-card stats-executive-summary"
            style={{ display: isLoading ? "none" : "block" }}
            title="High-level summary of current graph concentration and visibility"
          >
            <div className="stats-card-head">
              <div>
                <div className="stats-card-kicker">Executive snapshot</div>
                <div className="stats-card-summary">
                  Immediate signal quality and concentration metrics
                </div>
              </div>
            </div>
            <div className="stats-token-summary-grid">
              <div
                className="stats-token-summary-card"
                title="Total wallets currently rendered on the map"
              >
                <span>Visible wallets</span>
                <strong>
                  {Number(
                    executiveSummary?.visibleWallets || 0,
                  ).toLocaleString()}
                </strong>
              </div>
              <div
                className="stats-token-summary-card"
                title="Total visible graph links between rendered wallets"
              >
                <span>Visible links</span>
                <strong>
                  {Number(
                    executiveSummary?.visibleConnections || 0,
                  ).toLocaleString()}
                </strong>
              </div>
              <div
                className="stats-token-summary-card"
                title="Largest wallet share of current supply within the visible graph"
              >
                <span>Top wallet share</span>
                <strong>
                  {Number(executiveSummary?.topWalletShare || 0).toFixed(2)}%
                </strong>
              </div>
            </div>
            <div
              className="stats-token-row"
              title="Share of current supply held by the top ten visible wallets"
            >
              <span className="stats-label">Top concentration (Top 10)</span>
              <span className="stats-value stats-value-highlight">
                {Number(executiveSummary?.concentrationTop10 || 0).toFixed(1)}%
              </span>
            </div>
            <div
              className="stats-token-row"
              title="Largest wallet currently visible in this graph context"
            >
              <span className="stats-label">Largest visible wallet</span>
              <span className="stats-value">
                {executiveSummary?.topWalletLabel || "N/A"}
              </span>
            </div>
          </div>

          <div
            className="stats-card"
            style={{ display: isLoading ? "none" : "block" }}
          >
            <div className="stats-card-head">
              <div>
                <div className="stats-card-kicker">Token intelligence</div>
                <div className="stats-card-summary">
                  Market and supply context for the current graph
                </div>
              </div>
            </div>
            <div className="stats-token-header">
              <div className="stats-token-icon">◈</div>
              <div className="stats-token-meta">
                <div className="stats-token-name">{tokenInfo.name}</div>
                <div className="stats-token-fullname">{tokenInfo.fullName}</div>
              </div>
            </div>
            <div className="stats-token-summary-grid">
              <div className="stats-token-summary-card">
                <span>Wallets tracked</span>
                <strong>{walletsTracked.toLocaleString()}</strong>
              </div>
              <div className="stats-token-summary-card">
                <span>Top 10 hold</span>
                <strong>{top10share}%</strong>
              </div>
              <div className="stats-token-summary-card">
                <span>Market state</span>
                <strong>{hasPrice ? "Live quote" : "No feed"}</strong>
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
              <span className="stats-label">Current Supply</span>
              <span className="stats-value">
                {totalSupply > 0 ? fmt(totalSupply) : "N/A"}
              </span>
            </div>
            <div className="stats-token-row">
              <span
                className="stats-label"
                title="Maximum token supply from metadata; infinity means uncapped"
              >
                Max Supply
              </span>
              <span className="stats-value">
                {hasMetadataMaxSupply
                  ? maxSupply > 0
                    ? fmt(maxSupply)
                    : "∞"
                  : "N/A"}
              </span>
            </div>
            <div className="stats-token-row">
              <span className="stats-label">Price</span>
              <span className="stats-value">
                {hasPrice ? `$${tokenInfo.price.toFixed(5)}` : "N/A"}
              </span>
            </div>
            <div className="stats-token-row">
              <span
                className="stats-label"
                title="Combined percentage of current supply held by the top ten wallets"
              >
                Top 10 Hold
              </span>
              <span className="stats-value stats-value-highlight">
                {top10share}%
              </span>
            </div>
          </div>

          <div
            className="stats-card stats-analytics-card"
            style={{ display: isLoading ? "none" : "block" }}
            title="Largest holder balance changes over the last seven days"
          >
            <div className="stats-card-head">
              <div>
                <div className="stats-card-kicker">Top movers (7d)</div>
                <div className="stats-card-summary">
                  Addresses with the biggest balance changes
                </div>
              </div>
            </div>
            {topMoversLoading ? (
              <div className="stats-analytics-empty">Loading top movers...</div>
            ) : resolvedTopMovers.length ? (
              <div className="holders-list">
                {resolvedTopMovers.map((mover, index) => {
                  const deltaBalance = Number(mover?.deltaBalance || 0);
                  const deltaPct = Number(mover?.deltaPct || 0);
                  const moverAddress = String(mover?.address || "").trim();
                  return (
                    <div
                      key={`${String(mover?.address || "")}::${index}`}
                      className="holder-row"
                      onClick={() => handleTopMoverClick(moverAddress)}
                      title="Open connections view for this address"
                    >
                      <span className="holder-rank">#{index + 1}</span>
                      <span className="holder-addr">
                        {shortenAddress(mover?.address)}
                      </span>
                      <span
                        className={`holder-pct ${deltaBalance > 0 ? "stats-analytics-delta is-positive" : deltaBalance < 0 ? "stats-analytics-delta is-negative" : "stats-analytics-delta is-neutral"}`}
                      >
                        {formatTrendDelta(deltaBalance, 2)} (
                        {formatTrendDelta(deltaPct, 2, "%")})
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="stats-analytics-empty">
                No top movers available yet for this token.
              </div>
            )}
          </div>

          {selectedNode || isConnectionsView ? (
            <div className="stats-card stats-clear-connections-card">
              <div className="stats-card-head">
                <div>
                  <div className="stats-card-kicker">Connection focus</div>
                  <div className="stats-card-summary">
                    Move from token distribution to wallet-level network tracing
                  </div>
                </div>
                <span className="stats-card-badge">
                  {isConnectionsView ? "Focused" : "Available"}
                </span>
              </div>
              <div className="stats-clear-connections-copy">
                <div className="stats-section-title stats-clear-connections-title">
                  Connections
                </div>
                <div className="stats-clear-connections-text">
                  {isConnectionsView
                    ? "The graph is focused on a selected wallet's network."
                    : selectedNode
                      ? "Use the selected wallet to load a focused connections graph."
                      : ""}
                </div>
              </div>
              {isConnectionsView ? (
                <div className="map-selected-connection-filter">
                  <label htmlFor="stats-connection-min">
                    Minimum connected wallet balance ({selectedTokenSymbol})
                  </label>
                  <input
                    id="stats-connection-min"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={connectionMinAmount}
                    onChange={(event) =>
                      onConnectionMinAmountChange?.(event.target.value)
                    }
                    placeholder="All connections"
                  />
                  <div className="map-selected-connection-filter-hint">
                    Filters by each connected wallet's current balance. Leave
                    blank to show all.
                  </div>
                </div>
              ) : null}
              {selectedNode && canShowConnections ? (
                <button
                  type="button"
                  className="stats-connection-cta-button"
                  onClick={() => onShowConnections?.()}
                >
                  Show Connections
                </button>
              ) : null}
              {isConnectionsView ? (
                <>
                  {hasMinimumConnectionBalance ? (
                    <button
                      type="button"
                      className="stats-connection-cta-button"
                      onClick={() => onRefreshConnections?.()}
                    >
                      Reset Minimum Filter
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="stats-clear-connections-button"
                    onClick={() => onClearConnections?.()}
                  >
                    Clear Connections
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {hasMapStatusError ? (
            <div className="stats-card stats-recovery-card">
              <div className="stats-card-head">
                <div>
                  <div className="stats-card-kicker">Recovery</div>
                  <div className="stats-card-summary">
                    Data source reported an error. Retry the current graph or
                    switch token context.
                  </div>
                </div>
              </div>
              <div className="stats-clear-connections-text">
                {mapDataStatus}
              </div>
              <div className="selected-node-actions">
                <button
                  type="button"
                  className="map-selected-show-transfers"
                  onClick={() => onRetryMapLoad?.()}
                >
                  Retry Graph Load
                </button>
              </div>
            </div>
          ) : null}

          {/* Legend */}
          <div
            className="stats-card"
            style={{ display: isLoading ? "none" : "block" }}
          >
            <div className="stats-card-head">
              <div>
                <div className="stats-card-kicker">Distribution legend</div>
                <div className="stats-card-summary">
                  Filter the map by concentration tier
                </div>
              </div>
            </div>
            <div className="stats-section-title">Legend</div>
            {orderedLegendItems.map(({ key, label, count }) => {
              const isActive = activeLegendFilter === key;
              const toggleTitle = isActive
                ? "Show all wallets"
                : `Show only ${label.toLowerCase()} wallets in the bubble map`;

              return (
                <div
                  className={`legend-row ${isActive ? "is-active" : ""}`}
                  key={key}
                >
                  <span
                    className="legend-dot"
                    style={{ background: holderPalette[key] || "#74b9ff" }}
                  />
                  <span className="legend-label">{label}</span>
                  <div className="legend-actions">
                    <button
                      type="button"
                      className={`legend-action ${isActive ? "is-active" : ""}`}
                      onClick={() => onLegendFilterChange?.(key)}
                      disabled={!count}
                      title={toggleTitle}
                      aria-pressed={isActive}
                      aria-label={`${count.toLocaleString()} ${count === 1 ? "wallet" : "wallets"} in ${label.toLowerCase()}`}
                    >
                      {count.toLocaleString()}{" "}
                      {count === 1 ? "wallet" : "wallets"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Node Info */}
          {selectedNode && isMobileViewport && (
            <div className="stats-card stats-card-selected stats-node-detail-card">
              <div className="stats-card-head">
                <div>
                  <div className="stats-card-kicker">Wallet selected</div>
                  <div className="stats-card-summary">
                    Quick actions for the current holder
                  </div>
                </div>
                <span className="stats-card-badge">
                  {HOLDER_TYPES[selectedNode.type]?.label || selectedNode.type}
                </span>
              </div>
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
                  {selectedNodeShare}%
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
              <div className="selected-node-actions">
                <button
                  type="button"
                  className="map-selected-show-transfers"
                  onClick={() => onOpenTransactions?.()}
                >
                  Show All Transactions
                </button>
              </div>
            </div>
          )}
          {/* Top Holders List */}
          <div
            className="stats-card stats-card-holders"
            style={{ display: isLoading ? "none" : "block" }}
          >
            <div className="stats-section-title">Top Holders</div>
            <div className="holders-list">
              {sorted.slice(0, 15).map((h, i) => {
                const holderShare =
                  currentSupply > 0
                    ? ((Number(h.value) || 0) / currentSupply) * 100
                    : Number(h.pct) || 0;

                return (
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
                    <span className="holder-pct">
                      {holderShare.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
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
