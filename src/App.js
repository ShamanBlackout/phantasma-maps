import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import { HOLDER_TYPES, holders, links, TOKEN_INFO } from "./data/mockData";
import "./App.css";

const STATS_PANEL_STORAGE_KEY = "phantasma-maps:stats-panel-collapsed";
const COLOR_THEME_STORAGE_KEY = "phantasma-maps:color-theme";
const ALLOWED_COLOR_THEMES = new Set([
  "dark",
  "light",
  "ghost-blue",
  "kcal-red",
]);
const PHANTASMA_EXPLORER_BASE = "https://explorer.phantasma.info/address/";
const PHANTASMA_TX_EXPLORER_BASE = "https://explorer.phantasma.info/tx/";

function fmtTokenAmount(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function fmtUsdAmount(n) {
  if (!Number.isFinite(n)) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function buildTransferTime(index) {
  const ts = Date.now() - index * 11 * 60 * 1000;
  const dt = new Date(ts);
  return dt.toLocaleString();
}

export default function App() {
  const bubbleMapActionsRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isTransfersModalOpen, setIsTransfersModalOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [copiedTxHash, setCopiedTxHash] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorTheme, setColorTheme] = useState(() => {
    try {
      const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      return ALLOWED_COLOR_THEMES.has(stored) ? stored : "dark";
    } catch {
      return "dark";
    }
  });
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STATS_PANEL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STATS_PANEL_STORAGE_KEY,
        String(isStatsCollapsed),
      );
    } catch {
      // Ignore storage access issues and fall back to in-memory state.
    }
  }, [isStatsCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    } catch {
      // Ignore storage access issues and fall back to in-memory state.
    }
  }, [colorTheme]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return holders;
    const q = searchQuery.toLowerCase();
    return holders.filter(
      (h) =>
        h.id.toLowerCase().includes(q) ||
        h.label.toLowerCase().includes(q) ||
        h.shortAddr.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const filteredLinks = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return links.filter((l) => ids.has(l.source) && ids.has(l.target));
  }, [filteredNodes]);

  const nodeById = useMemo(
    () => new Map(holders.map((holder) => [holder.id, holder])),
    [],
  );

  const selectedNodeTransfers = useMemo(() => {
    if (!selectedNode) return [];
    return links
      .filter(
        (link) =>
          link.source === selectedNode.id ||
          link.target === selectedNode.id,
      )
      .map((link, index) => {
        const isOutgoing = link.source === selectedNode.id;
        const counterpartId = isOutgoing ? link.target : link.source;
        const counterpartNode = nodeById.get(counterpartId);
        const amount = Math.max(
          0,
          Number(link.transactionVolume ?? 0) * (isOutgoing ? 1 : 0.92),
        );

        return {
          id: `${link.source}-${link.target}-${index}`,
          direction: isOutgoing ? "To" : "From",
          counterpartLabel:
            counterpartNode?.label || counterpartNode?.shortAddr || counterpartId,
          counterpartAddr: counterpartNode?.shortAddr || counterpartId,
          token: TOKEN_INFO.name,
          amount,
          usd: amount * TOKEN_INFO.price,
          sentTransactions: Number(link.sentTransactions ?? 0),
          receivedTransactions: Number(link.receivedTransactions ?? 0),
          transactionHash: link.transactionHash || "N/A",
          timeUtc: buildTransferTime(index),
        };
      })
      .sort((a, b) => (a.timeUtc < b.timeUtc ? 1 : -1));
  }, [selectedNode, nodeById]);

  const infoNode = hoveredNode || selectedNode;

  useEffect(() => {
    if (!selectedNode) {
      setIsTransfersModalOpen(false);
      setCopiedAddress(null);
      setCopiedTxHash(null);
    }
  }, [selectedNode]);

  async function copyTextToClipboard(value) {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        return document.execCommand("copy");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  async function handleCopyAddress(address) {
    const copied = await copyTextToClipboard(address);
    if (!copied) return;
    setCopiedAddress(address);
    window.setTimeout(() => setCopiedAddress(null), 1400);
  }

  async function handleCopyTransactionHash(hash) {
    const copied = await copyTextToClipboard(hash);
    if (!copied) return;
    setCopiedTxHash(hash);
    window.setTimeout(() => setCopiedTxHash(null), 1400);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (isTransfersModalOpen) {
        setIsTransfersModalOpen(false);
        return;
      }
      if (selectedNode) {
        setSelectedNode(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTransfersModalOpen, selectedNode]);

  return (
    <div className={`app-root theme-${colorTheme}`}>
      <Header
        onSearch={setSearchQuery}
        tokenInfo={TOKEN_INFO}
        colorTheme={colorTheme}
        onThemeChange={setColorTheme}
      />
      <div className="main-layout">
        <div className="map-area">
          <BubbleMap
            nodes={filteredNodes}
            links={filteredLinks}
            onNodeClick={setSelectedNode}
            onNodeHover={setHoveredNode}
            selectedNodeId={selectedNode?.id}
            colorTheme={colorTheme}
            onReady={(actions) => {
              bubbleMapActionsRef.current = actions;
            }}
          />
          {infoNode && (
            <div className="map-hover-info is-active">
              <div className="map-hover-title">{infoNode.label}</div>
              <div className="map-hover-addr">{infoNode.shortAddr}</div>
              <div className="map-hover-row">
                <span>Share</span>
                <strong>{infoNode.pct}%</strong>
              </div>
              <div className="map-hover-row">
                <span>Amount</span>
                <strong>{infoNode.value.toLocaleString()} {TOKEN_INFO.name}</strong>
              </div>
              <div className="map-hover-row">
                <span>Sent Tx</span>
                <strong>{(infoNode.sentTransactions ?? 0).toLocaleString()}</strong>
              </div>
              <div className="map-hover-row">
                <span>Received Tx</span>
                <strong>{(infoNode.receivedTransactions ?? 0).toLocaleString()}</strong>
              </div>
              <div className="map-hover-row">
                <span>Type</span>
                <strong>{HOLDER_TYPES[infoNode.type]?.label || infoNode.type}</strong>
              </div>
            </div>
          )}
          {selectedNode && (
            <div className="map-selected-info is-active">
              <div className="map-selected-head">
                <div>
                  <div className="map-selected-title">{selectedNode.label}</div>
                  <div className="map-selected-addr-row">
                    <div className="map-selected-addr">{selectedNode.shortAddr}</div>
                    <button
                      type="button"
                      className="map-selected-action"
                      onClick={() => handleCopyAddress(selectedNode.id)}
                      aria-label="Copy address"
                      title="Copy address"
                    >
                      {copiedAddress === selectedNode.id ? "Copied" : "Copy"}
                    </button>
                    <a
                      className="map-selected-action"
                      href={`${PHANTASMA_EXPLORER_BASE}${encodeURIComponent(selectedNode.id)}`}
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
                  onClick={() => setSelectedNode(null)}
                  aria-label="Close selected node card"
                >
                  ×
                </button>
              </div>
              <div className="map-selected-grid">
                <div className="map-selected-stat">
                  <span>Share</span>
                  <strong>{selectedNode.pct}%</strong>
                </div>
                <div className="map-selected-stat">
                  <span>Amount</span>
                  <strong>{fmtTokenAmount(selectedNode.value)} {TOKEN_INFO.name}</strong>
                </div>
                <div className="map-selected-stat">
                  <span>USD Value</span>
                  <strong>{fmtUsdAmount(selectedNode.value * TOKEN_INFO.price)}</strong>
                </div>
                <div className="map-selected-stat">
                  <span>Transactions</span>
                  <strong>{selectedNodeTransfers.length}</strong>
                </div>
              </div>
              <div className="map-selected-tx-row">
                <span>Sent {selectedNode.sentTransactions?.toLocaleString() ?? "0"}</span>
                <span>Received {selectedNode.receivedTransactions?.toLocaleString() ?? "0"}</span>
              </div>
              <button
                type="button"
                className="map-selected-show-transfers"
                onClick={() => setIsTransfersModalOpen(true)}
              >
                Show All Transactions
              </button>
            </div>
          )}
          <div className="map-hint">
            <span className="map-hint-text">
              Scroll to zoom · Drag to pan · Click a bubble for details
            </span>
            <button
              type="button"
              className="map-hint-fit-btn"
              onClick={() => bubbleMapActionsRef.current?.fitToView?.()}
              title="Fit all bubbles into view"
            >
              ⊡ Fit to View
            </button>
          </div>
        </div>
        <StatsPanel
          holders={holders}
          tokenInfo={TOKEN_INFO}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          colorTheme={colorTheme}
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() =>
            setIsStatsCollapsed((collapsed) => !collapsed)
          }
        />
      </div>
      {isTransfersModalOpen && selectedNode && (
        <div
          className="transfers-modal-backdrop"
          onClick={() => setIsTransfersModalOpen(false)}
        >
          <div
            className="transfers-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="transfers-modal-head">
              <div>
                <h3>All Transactions</h3>
                <p>For {selectedNode.shortAddr}</p>
              </div>
              <button
                type="button"
                className="transfers-modal-close"
                onClick={() => setIsTransfersModalOpen(false)}
                aria-label="Close transfers modal"
              >
                ×
              </button>
            </div>
            <div className="transfers-table-wrap">
              <table className="transfers-table">
                <thead>
                  <tr>
                    <th>Dir</th>
                    <th>Counterparty</th>
                    <th>Time</th>
                    <th>Token</th>
                    <th>Amount</th>
                    <th>USD (Now)</th>
                    <th>Tx Hash</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedNodeTransfers.length ? (
                    selectedNodeTransfers.map((transfer) => (
                      <tr key={transfer.id}>
                        <td className={`transfer-dir ${transfer.direction === "From" ? "from" : "to"}`}>
                          {transfer.direction}
                        </td>
                        <td>
                          <div className="transfer-counterparty">{transfer.counterpartLabel}</div>
                          <div className="transfer-addr">{transfer.counterpartAddr}</div>
                        </td>
                        <td>{transfer.timeUtc}</td>
                        <td>{transfer.token}</td>
                        <td>{fmtTokenAmount(transfer.amount)}</td>
                        <td>{fmtUsdAmount(transfer.usd)}</td>
                        <td>
                          <div className="transfer-hash-cell" title={transfer.transactionHash}>
                            <span className="transfer-hash">{transfer.transactionHash}</span>
                            <button
                              type="button"
                              className="transfer-hash-action"
                              onClick={() => handleCopyTransactionHash(transfer.transactionHash)}
                              aria-label="Copy transaction hash"
                              title="Copy transaction hash"
                            >
                              {copiedTxHash === transfer.transactionHash ? "Copied" : "Copy"}
                            </button>
                            <a
                              className="transfer-hash-action"
                              href={`${PHANTASMA_TX_EXPLORER_BASE}${encodeURIComponent(transfer.transactionHash)}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label="Open transaction on Phantasma Explorer"
                              title="Open transaction on Phantasma Explorer"
                            >
                              ↗
                            </a>
                          </div>
                        </td>
                        <td>
                          S {transfer.sentTransactions.toLocaleString()} · R {transfer.receivedTransactions.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="transfers-empty">
                        No transactions found for this node.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
