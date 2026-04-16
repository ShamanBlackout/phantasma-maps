import React from "react";
import SparklineSvg from "./SparklineSvg";

export default function SelectedNodeCard({
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
  onShowConnections,
  onOpenTransactions,
}) {
  return (
    <div className="map-selected-info is-active">
      <div className="map-selected-head">
        <div>
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
          <strong>{totalTransactionCount.toLocaleString()}</strong>
        </div>
      </div>
      {sparklineData.length >= 2 && (
        <div className="map-selected-sparkline">
          <span>Activity (30d)</span>
          <SparklineSvg data={sparklineData} height={36} />
        </div>
      )}
      <div className="selected-node-actions">
        {canShowConnections ? (
          <button
            type="button"
            className="map-selected-show-transfers"
            onClick={() => onShowConnections(node.id)}
          >
            Show Connections
          </button>
        ) : null}
        <button
          type="button"
          className="map-selected-show-transfers"
          onClick={onOpenTransactions}
        >
          Show All Transactions
        </button>
      </div>
    </div>
  );
}
