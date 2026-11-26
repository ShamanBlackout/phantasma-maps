import React from "react";
import SparklineSvg from "./SparklineSvg";

function SelectedNodeCard({
  node,
  copiedAddress,
  onCopyAddress,
  explorerBase,
  onClose,
  fmtSharePct,
  currentSupply,
  fmtTokenAmount,
  tokenName,
  fmtUsdAmount,
  tokenPrice,
  totalTransactionCount,
  sparklineData,
  canShowConnections,
  isConnectionsView,
  onShowConnections,
  connectionMinAmount,
  onConnectionMinAmountChange,
  onRefreshConnections,
  connectionMinPresets = [],
  onOpenTransactions,
  isTransactionsLoading,
  isActivityLoading,
}) {
  const hasMinimumConnectionBalance = Number(connectionMinAmount) > 0;

  return (
    <div className="map-selected-info is-active">
      <div className="map-selected-head">
        <div>
          <div className="map-selected-kicker-row">
            <span className="map-selected-kicker">Wallet profile</span>
            <span className="map-selected-type-pill">
              {node.type || "holder"}
            </span>
          </div>
          <div className="map-selected-title">{node.label}</div>
          <div className="map-selected-addr-row">
            <div className="map-selected-addr">{node.shortAddr}</div>
            <button
              type="button"
              className="map-selected-action"
              onClick={() => onCopyAddress(node.id)}
              aria-label="Copy address"
              title="Copy address"
            >
              {copiedAddress === node.id ? "Copied" : "Copy"}
            </button>
            <a
              className="map-selected-action"
              href={`${explorerBase}${encodeURIComponent(node.id)}`}
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
          className="map-selected-close"
          onClick={onClose}
          aria-label="Close selected node card"
        >
          ×
        </button>
      </div>
      <div className="map-selected-grid">
        <div className="map-selected-stat">
          <span>Share</span>
          <strong>{fmtSharePct(node.value, currentSupply, node.pct)}</strong>
        </div>
        <div className="map-selected-stat">
          <span>Amount</span>
          <strong>
            {fmtTokenAmount(node.value)} {tokenName}
          </strong>
        </div>
        <div className="map-selected-stat">
          <span>USD Value</span>
          <strong>{fmtUsdAmount(node.value * tokenPrice)}</strong>
        </div>
        <div className="map-selected-stat">
          <span>Transactions</span>
          <strong>
            {isTransactionsLoading
              ? "Loading..."
              : totalTransactionCount.toLocaleString()}
          </strong>
        </div>
      </div>
      <div className="map-selected-note">
        This wallet is shown in the context of the active token graph and
        current view filters.
      </div>
      {isActivityLoading && sparklineData.length < 2 ? (
        <div className="map-selected-sparkline is-loading">
          <div className="map-selected-sparkline-header">
            <span>Activity (30d)</span>
          </div>
          <div className="map-selected-sparkline-loading-note">
            Loading activity timeline...
          </div>
        </div>
      ) : null}
      {sparklineData.length >= 2 && (
        <div className="map-selected-sparkline">
          <div className="map-selected-sparkline-header">
            <span>Activity (30d)</span>
          </div>
          <div className="map-selected-sparkline-metrics">
            <div className="map-selected-sparkline-metric">
              <span>Total txs</span>
              <strong>
                {sparklineData.reduce(
                  (sum, day) => sum + (day.txCount || 0),
                  0,
                )}
              </strong>
            </div>
            <div className="map-selected-sparkline-metric">
              <span>Active days</span>
              <strong>{sparklineData.length}</strong>
            </div>
          </div>
          <SparklineSvg data={sparklineData} height={52} />
        </div>
      )}
      <div className="selected-node-actions">
        <div className="map-selected-actions-title">Actions</div>
        <div className="map-selected-connection-filter">
          <label htmlFor="selected-node-connection-min">
            Minimum connected wallet balance ({tokenName})
          </label>
          <input
            id="selected-node-connection-min"
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
          {Array.isArray(connectionMinPresets) &&
          connectionMinPresets.length ? (
            <div
              className="map-selected-connection-presets"
              aria-label="Minimum filter presets"
            >
              {connectionMinPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="map-selected-connection-preset"
                  onClick={() => onConnectionMinAmountChange?.(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="map-selected-connection-filter-hint">
            Filters by each connected wallet's current balance. Clear the field
            to show all.
          </div>
        </div>
        {canShowConnections ? (
          <button
            type="button"
            className="map-selected-show-transfers"
            onClick={() => onShowConnections(node.id)}
          >
            Show Connections
          </button>
        ) : null}
        {isConnectionsView && hasMinimumConnectionBalance ? (
          <button
            type="button"
            className="map-selected-show-transfers"
            onClick={() => onRefreshConnections?.()}
          >
            Reset Minimum Filter
          </button>
        ) : null}
        <button
          type="button"
          className="map-selected-show-transfers is-secondary"
          onClick={onOpenTransactions}
        >
          Show All Transactions
        </button>
      </div>
    </div>
  );
}

export default React.memo(SelectedNodeCard);
