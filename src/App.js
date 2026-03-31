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

function parseEnvMs(key, fallbackMs) {
  const raw = process.env[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

const PHANTASMA_EXPLORER_BASE =
  process.env.REACT_APP_PHANTASMA_EXPLORER_BASE ||
  "https://explorer.phantasma.info/address/";
const PHANTASMA_TX_EXPLORER_BASE =
  process.env.REACT_APP_PHANTASMA_TX_EXPLORER_BASE ||
  "https://explorer.phantasma.info/tx/";
const SOUL_PRICE_API_URL =
  process.env.REACT_APP_SOUL_PRICE_API_URL ||
  "https://api.coingecko.com/api/v3/simple/price?ids=phantasma&vs_currencies=usd&include_24hr_change=true";
const CMC_SOUL_QUOTES_API_URL =
  process.env.REACT_APP_CMC_SOUL_QUOTES_API_URL ||
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=SOUL&convert=USD";
const CMC_SOUL_SYMBOL =
  (process.env.REACT_APP_CMC_SOUL_SYMBOL || "SOUL").toUpperCase();
const SOUL_PRICE_BASE_POLL_INTERVAL_MS = parseEnvMs(
  "REACT_APP_SOUL_PRICE_BASE_POLL_INTERVAL_MS",
  5 * 60 * 1000,
);
const SOUL_PRICE_MAX_BACKOFF_MS = parseEnvMs(
  "REACT_APP_SOUL_PRICE_MAX_BACKOFF_MS",
  10 * 60 * 1000,
);
const SOUL_PRICE_REQUEST_TIMEOUT_MS = parseEnvMs(
  "REACT_APP_SOUL_PRICE_REQUEST_TIMEOUT_MS",
  7000,
);
const CMC_API_KEY = process.env.REACT_APP_CMC_API_KEY;
const CMC_PROXY_URL = process.env.REACT_APP_CMC_PROXY_URL;
const CMC_ALLOW_BROWSER_DIRECT =
  String(process.env.REACT_APP_CMC_ALLOW_BROWSER_DIRECT || "").toLowerCase() ===
  "true";

function parseRetryAfterMs(response) {
  const rawValue = response.headers.get("retry-after");
  if (!rawValue) return null;
  const asSeconds = Number(rawValue);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return asSeconds * 1000;
  }
  return null;
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    SOUL_PRICE_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response),
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      status: response.status,
      payload,
      retryAfterMs: parseRetryAfterMs(response),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      retryAfterMs: null,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function parseCoinGeckoQuote(payload) {
  const usdPrice = Number(payload?.phantasma?.usd);
  const usdChange24h = Number(payload?.phantasma?.usd_24h_change);
  if (!Number.isFinite(usdPrice) || !Number.isFinite(usdChange24h)) {
    return null;
  }
  return {
    price: usdPrice,
    priceChange24h: Number(usdChange24h.toFixed(2)),
  };
}

function parseCoinMarketCapQuote(payload) {
  const usdQuote = payload?.data?.[CMC_SOUL_SYMBOL]?.quote?.USD;
  const usdPrice = Number(usdQuote?.price);
  const usdChange24h = Number(usdQuote?.percent_change_24h);
  if (!Number.isFinite(usdPrice) || !Number.isFinite(usdChange24h)) {
    return null;
  }
  return {
    price: usdPrice,
    priceChange24h: Number(usdChange24h.toFixed(2)),
  };
}

async function fetchSoulQuoteFromCoinGecko() {
  const result = await fetchJsonWithTimeout(SOUL_PRICE_API_URL);
  if (!result.ok) return result;
  const quote = parseCoinGeckoQuote(result.payload);
  if (!quote) {
    return {
      ok: false,
      status: result.status,
      retryAfterMs: result.retryAfterMs,
    };
  }
  return {
    ok: true,
    status: result.status,
    retryAfterMs: result.retryAfterMs,
    quote,
    source: "coingecko",
  };
}

async function fetchSoulQuoteFromCoinMarketCap() {
  const hasProxy = Boolean(CMC_PROXY_URL);

  // CoinMarketCap Pro typically blocks browser-origin requests (CORS).
  // Prefer a server-side proxy unless direct browser mode is explicitly enabled.
  if (!hasProxy && !CMC_ALLOW_BROWSER_DIRECT) {
    return {
      ok: false,
      status: 0,
      retryAfterMs: null,
    };
  }

  const endpoint = hasProxy ? CMC_PROXY_URL : CMC_SOUL_QUOTES_API_URL;
  const headers = {
    Accept: "application/json",
  };

  if (CMC_API_KEY) {
    headers["X-CMC_PRO_API_KEY"] = CMC_API_KEY;
  }

  // Direct browser mode requires a key; proxy mode can authenticate server-side.
  if (!CMC_API_KEY && !hasProxy) {
    return {
      ok: false,
      status: 401,
      retryAfterMs: null,
    };
  }

  const result = await fetchJsonWithTimeout(endpoint, { headers });
  if (!result.ok) return result;
  const quote = parseCoinMarketCapQuote(result.payload);
  if (!quote) {
    return {
      ok: false,
      status: result.status,
      retryAfterMs: result.retryAfterMs,
    };
  }
  return {
    ok: true,
    status: result.status,
    retryAfterMs: result.retryAfterMs,
    quote,
    source: "coinmarketcap",
  };
}

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

function toDateTimeLocalValue(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function makeExportFileName(selectedNode, ext) {
  const addr = selectedNode?.shortAddr?.replace(/[^a-zA-Z0-9]/g, "") || "node";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `transactions-${addr}-${stamp}.${ext}`;
}

export default function App() {
  const bubbleMapActionsRef = useRef(null);
  const exportMenuRef = useRef(null);
  const dirFilterRef = useRef(null);
  const counterpartyFilterRef = useRef(null);
  const timeFilterRef = useRef(null);
  const amountFilterRef = useRef(null);
  const usdFilterRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isTransfersModalOpen, setIsTransfersModalOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [copiedTxHash, setCopiedTxHash] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeTransactionFilter, setActiveTransactionFilter] = useState(null);
  const [transactionDirFilter, setTransactionDirFilter] = useState("all");
  const [transactionCounterpartyFilter, setTransactionCounterpartyFilter] =
    useState("");
  const [transactionStartTime, setTransactionStartTime] = useState("");
  const [transactionEndTime, setTransactionEndTime] = useState("");
  const [transactionMinAmount, setTransactionMinAmount] = useState("");
  const [transactionMaxAmount, setTransactionMaxAmount] = useState("");
  const [transactionMinUsd, setTransactionMinUsd] = useState("");
  const [transactionMaxUsd, setTransactionMaxUsd] = useState("");
  const [liveTokenInfo, setLiveTokenInfo] = useState(TOKEN_INFO);
  const [priceLastUpdatedAt, setPriceLastUpdatedAt] = useState(null);
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

  useEffect(() => {
    let isActive = true;
    let timeoutId;
    let nextPollDelayMs = 5000;

    function scheduleNextPoll(delayMs) {
      if (!isActive) return;
      const jitterMs = Math.floor(Math.random() * 3000);
      timeoutId = window.setTimeout(fetchSoulPrice, delayMs + jitterMs);
    }

    async function fetchSoulPrice() {
      try {
        const primaryResult = await fetchSoulQuoteFromCoinGecko();
        const fallbackResult = primaryResult.ok
          ? null
          : await fetchSoulQuoteFromCoinMarketCap();

        const winner = primaryResult.ok ? primaryResult : fallbackResult;

        if (!winner?.ok || !winner.quote) {
          const retryAfterMs = Math.max(
            primaryResult?.retryAfterMs || 0,
            fallbackResult?.retryAfterMs || 0,
          );
          const hitRateLimit =
            primaryResult?.status === 429 || fallbackResult?.status === 429;

          if (hitRateLimit) {
            nextPollDelayMs = retryAfterMs || Math.min(nextPollDelayMs * 2, SOUL_PRICE_MAX_BACKOFF_MS);
          } else {
            nextPollDelayMs = Math.min(
              Math.max(nextPollDelayMs * 2, SOUL_PRICE_BASE_POLL_INTERVAL_MS),
              SOUL_PRICE_MAX_BACKOFF_MS,
            );
          }

          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        if (!isActive) {
          nextPollDelayMs = Math.max(SOUL_PRICE_BASE_POLL_INTERVAL_MS, nextPollDelayMs);
          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        setLiveTokenInfo((current) => ({
          ...current,
          price: winner.quote.price,
          priceChange24h: winner.quote.priceChange24h,
        }));
        setPriceLastUpdatedAt(Date.now());
        nextPollDelayMs = SOUL_PRICE_BASE_POLL_INTERVAL_MS;
        scheduleNextPoll(nextPollDelayMs);
      } catch {
        // Keep last successful price if the API is unreachable.
        nextPollDelayMs = Math.min(Math.max(nextPollDelayMs * 2, SOUL_PRICE_BASE_POLL_INTERVAL_MS), SOUL_PRICE_MAX_BACKOFF_MS);
        scheduleNextPoll(nextPollDelayMs);
      }
    }

    fetchSoulPrice();

    return () => {
      isActive = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

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
        const timestamp = Date.now() - index * 11 * 60 * 1000;
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
          token: liveTokenInfo.name,
          amount,
          usd: amount * liveTokenInfo.price,
          sentTransactions: Number(link.sentTransactions ?? 0),
          receivedTransactions: Number(link.receivedTransactions ?? 0),
          transactionHash: link.transactionHash || "N/A",
          timestamp,
          timeUtc: buildTransferTime(index),
          timeInputValue: toDateTimeLocalValue(timestamp),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedNode, nodeById, liveTokenInfo.name, liveTokenInfo.price]);

  const filteredTransactions = useMemo(() => {
    const startTs = transactionStartTime ? new Date(transactionStartTime).getTime() : null;
    const endTs = transactionEndTime ? new Date(transactionEndTime).getTime() : null;
    const minAmount = transactionMinAmount === "" ? null : Number(transactionMinAmount);
    const maxAmount = transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
    const minUsd = transactionMinUsd === "" ? null : Number(transactionMinUsd);
    const maxUsd = transactionMaxUsd === "" ? null : Number(transactionMaxUsd);
    const counterpartyQuery = transactionCounterpartyFilter.trim().toLowerCase();

    return selectedNodeTransfers.filter((transaction) => {
      if (transactionDirFilter !== "all") {
        if (transaction.direction.toLowerCase() !== transactionDirFilter) return false;
      }
      if (counterpartyQuery) {
        const haystack = `${transaction.counterpartLabel} ${transaction.counterpartAddr}`.toLowerCase();
        if (!haystack.includes(counterpartyQuery)) return false;
      }
      if (startTs !== null && transaction.timestamp < startTs) return false;
      if (endTs !== null && transaction.timestamp > endTs) return false;
      if (minAmount !== null && transaction.amount < minAmount) return false;
      if (maxAmount !== null && transaction.amount > maxAmount) return false;
      if (minUsd !== null && transaction.usd < minUsd) return false;
      if (maxUsd !== null && transaction.usd > maxUsd) return false;
      return true;
    });
  }, [
    selectedNodeTransfers,
    transactionDirFilter,
    transactionCounterpartyFilter,
    transactionStartTime,
    transactionEndTime,
    transactionMinAmount,
    transactionMaxAmount,
    transactionMinUsd,
    transactionMaxUsd,
  ]);

  const hasDirFilter = transactionDirFilter !== "all";
  const hasCounterpartyFilter = Boolean(transactionCounterpartyFilter.trim());
  const hasTimeFilter = Boolean(transactionStartTime || transactionEndTime);
  const hasAmountFilter = Boolean(transactionMinAmount || transactionMaxAmount);
  const hasUsdFilter = Boolean(transactionMinUsd || transactionMaxUsd);

  function resetAllTransactionFilters() {
    setActiveTransactionFilter(null);
    setTransactionDirFilter("all");
    setTransactionCounterpartyFilter("");
    setTransactionStartTime("");
    setTransactionEndTime("");
    setTransactionMinAmount("");
    setTransactionMaxAmount("");
    setTransactionMinUsd("");
    setTransactionMaxUsd("");
  }

  function buildExportRows() {
    return filteredTransactions.map((tx) => ({
      direction: tx.direction,
      counterparty: tx.counterpartLabel,
      address: tx.counterpartAddr,
      time: tx.timeUtc,
      token: tx.token,
      amount: tx.amount,
      usdNow: tx.usd,
      transactionHash: tx.transactionHash,
      sentTransactions: tx.sentTransactions,
      receivedTransactions: tx.receivedTransactions,
    }));
  }

  function downloadBlobFile(content, mimeType, fileName) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportTransactions(format) {
    const rows = buildExportRows();

    if (format === "json") {
      const json = JSON.stringify(rows, null, 2);
      downloadBlobFile(json, "application/json;charset=utf-8", makeExportFileName(selectedNode, "json"));
      setIsExportMenuOpen(false);
      return;
    }

    if (format === "csv") {
      const headers = [
        "Direction",
        "Counterparty",
        "Address",
        "Time",
        "Token",
        "Amount",
        "USD (Now)",
        "Transaction Hash",
        "Sent Tx",
        "Received Tx",
      ];
      const csvRows = rows.map((row) => [
        row.direction,
        row.counterparty,
        row.address,
        row.time,
        row.token,
        row.amount,
        row.usdNow,
        row.transactionHash,
        row.sentTransactions,
        row.receivedTransactions,
      ]);
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [headers, ...csvRows]
        .map((line) => line.map(escapeCsv).join(","))
        .join("\n");
      downloadBlobFile(`\uFEFF${csv}`, "text/csv;charset=utf-8", makeExportFileName(selectedNode, "csv"));
      setIsExportMenuOpen(false);
      return;
    }
  }

  const infoNode = hoveredNode || selectedNode;

  useEffect(() => {
    if (!selectedNode) {
      setIsTransfersModalOpen(false);
      setCopiedAddress(null);
      setCopiedTxHash(null);
      setIsExportMenuOpen(false);
      setActiveTransactionFilter(null);
      setTransactionDirFilter("all");
      setTransactionCounterpartyFilter("");
      setTransactionStartTime("");
      setTransactionEndTime("");
      setTransactionMinAmount("");
      setTransactionMaxAmount("");
      setTransactionMinUsd("");
      setTransactionMaxUsd("");
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
      if (isExportMenuOpen) {
        setIsExportMenuOpen(false);
        return;
      }
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
  }, [isExportMenuOpen, isTransfersModalOpen, selectedNode]);

  useEffect(() => {
    if (!isExportMenuOpen) return undefined;

    function onMouseDown(event) {
      if (exportMenuRef.current?.contains(event.target)) return;
      setIsExportMenuOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!activeTransactionFilter) return undefined;

    function handlePointerDown(event) {
      const activeRefByFilter = {
        dir: dirFilterRef,
        counterparty: counterpartyFilterRef,
        time: timeFilterRef,
        amount: amountFilterRef,
        usd: usdFilterRef,
      };
      const activeRef = activeRefByFilter[activeTransactionFilter];

      if (activeRef.current?.contains(event.target)) return;
      setActiveTransactionFilter(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeTransactionFilter]);

  return (
    <div className={`app-root theme-${colorTheme}`}>
      <Header
        onSearch={setSearchQuery}
        tokenInfo={liveTokenInfo}
        priceUpdatedAt={priceLastUpdatedAt}
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
                <strong>{infoNode.value.toLocaleString()} {liveTokenInfo.name}</strong>
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
                  <strong>{fmtTokenAmount(selectedNode.value)} {liveTokenInfo.name}</strong>
                </div>
                <div className="map-selected-stat">
                  <span>USD Value</span>
                  <strong>{fmtUsdAmount(selectedNode.value * liveTokenInfo.price)}</strong>
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
          tokenInfo={liveTokenInfo}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
          onOpenTransactions={() => setIsTransfersModalOpen(true)}
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
              <div className="transactions-export" ref={exportMenuRef}>
                <button
                  type="button"
                  className="transactions-export-btn"
                  onClick={() => setIsExportMenuOpen((open) => !open)}
                >
                  Export
                </button>
                {isExportMenuOpen && (
                  <div className="transactions-export-menu">
                    <button
                      type="button"
                      className="transactions-export-item"
                      onClick={() => exportTransactions("json")}
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      className="transactions-export-item"
                      onClick={() => exportTransactions("excel")}
                    >
                      Export Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="transactions-reset-all"
                onClick={resetAllTransactionFilters}
              >
                Reset All Filters
              </button>
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
                    <th className="transactions-th-filterable" ref={dirFilterRef}>
                      <div className="transactions-th-content">
                        <span>Dir</span>
                        <button
                          type="button"
                          className={`transactions-th-filter-btn ${activeTransactionFilter === "dir" ? "is-active" : ""} ${hasDirFilter ? "has-value" : ""}`}
                          onClick={() =>
                            setActiveTransactionFilter((current) =>
                              current === "dir" ? null : "dir",
                            )
                          }
                          aria-label="Filter direction column"
                          title="Filter direction"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2 3h12l-4.5 5v4l-3-1.8V8z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      {activeTransactionFilter === "dir" && (
                        <div className="transactions-th-popover transactions-th-popover-dir">
                          <button
                            type="button"
                            className={`transactions-filter-chip ${transactionDirFilter === "all" ? "is-active" : ""}`}
                            onClick={() => setTransactionDirFilter("all")}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className={`transactions-filter-chip ${transactionDirFilter === "from" ? "is-active" : ""}`}
                            onClick={() => setTransactionDirFilter("from")}
                          >
                            From
                          </button>
                          <button
                            type="button"
                            className={`transactions-filter-chip ${transactionDirFilter === "to" ? "is-active" : ""}`}
                            onClick={() => setTransactionDirFilter("to")}
                          >
                            To
                          </button>
                        </div>
                      )}
                    </th>
                    <th className="transactions-th-filterable" ref={counterpartyFilterRef}>
                      <div className="transactions-th-content">
                        <span>Counterparty</span>
                        <button
                          type="button"
                          className={`transactions-th-filter-btn ${activeTransactionFilter === "counterparty" ? "is-active" : ""} ${hasCounterpartyFilter ? "has-value" : ""}`}
                          onClick={() =>
                            setActiveTransactionFilter((current) =>
                              current === "counterparty" ? null : "counterparty",
                            )
                          }
                          aria-label="Filter counterparty column"
                          title="Filter counterparty"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2 3h12l-4.5 5v4l-3-1.8V8z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      {activeTransactionFilter === "counterparty" && (
                        <div className="transactions-th-popover transactions-th-popover-counterparty">
                          <label className="transactions-filter-field">
                            <span>Address or Name</span>
                            <input
                              type="text"
                              value={transactionCounterpartyFilter}
                              onChange={(event) =>
                                setTransactionCounterpartyFilter(event.target.value)
                              }
                              placeholder="Search by address or name"
                            />
                          </label>
                          <button
                            type="button"
                            className="transactions-filter-reset"
                            onClick={() => setTransactionCounterpartyFilter("")}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </th>
                    <th className="transactions-th-filterable" ref={timeFilterRef}>
                      <div className="transactions-th-content">
                        <span>Time</span>
                        <button
                          type="button"
                          className={`transactions-th-filter-btn ${activeTransactionFilter === "time" ? "is-active" : ""} ${hasTimeFilter ? "has-value" : ""}`}
                          onClick={() =>
                            setActiveTransactionFilter((current) =>
                              current === "time" ? null : "time",
                            )
                          }
                          aria-label="Filter time column"
                          title="Filter time"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2 3h12l-4.5 5v4l-3-1.8V8z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      {activeTransactionFilter === "time" && (
                        <div className="transactions-th-popover">
                          <label className="transactions-filter-field">
                            <span>Begin Time</span>
                            <input
                              type="datetime-local"
                              value={transactionStartTime}
                              onChange={(event) => setTransactionStartTime(event.target.value)}
                            />
                          </label>
                          <label className="transactions-filter-field">
                            <span>End Time</span>
                            <input
                              type="datetime-local"
                              value={transactionEndTime}
                              onChange={(event) => setTransactionEndTime(event.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="transactions-filter-reset"
                            onClick={() => {
                              setTransactionStartTime("");
                              setTransactionEndTime("");
                            }}
                          >
                            Reset Time
                          </button>
                        </div>
                      )}
                    </th>
                    <th>Token</th>
                    <th className="transactions-th-filterable" ref={amountFilterRef}>
                      <div className="transactions-th-content">
                        <span>Amount</span>
                        <button
                          type="button"
                          className={`transactions-th-filter-btn ${activeTransactionFilter === "amount" ? "is-active" : ""} ${hasAmountFilter ? "has-value" : ""}`}
                          onClick={() =>
                            setActiveTransactionFilter((current) =>
                              current === "amount" ? null : "amount",
                            )
                          }
                          aria-label="Filter amount column"
                          title="Filter amount"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2 3h12l-4.5 5v4l-3-1.8V8z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      {activeTransactionFilter === "amount" && (
                        <div className="transactions-th-popover transactions-th-popover-amount">
                          <label className="transactions-filter-field transactions-filter-field-amount">
                            <span>Min Amount</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={transactionMinAmount}
                              onChange={(event) => setTransactionMinAmount(event.target.value)}
                              placeholder="0"
                            />
                          </label>
                          <label className="transactions-filter-field transactions-filter-field-amount">
                            <span>Max Amount</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={transactionMaxAmount}
                              onChange={(event) => setTransactionMaxAmount(event.target.value)}
                              placeholder="No limit"
                            />
                          </label>
                          <button
                            type="button"
                            className="transactions-filter-reset"
                            onClick={() => {
                              setTransactionMinAmount("");
                              setTransactionMaxAmount("");
                            }}
                          >
                            Reset Amount
                          </button>
                        </div>
                      )}
                    </th>
                    <th className="transactions-th-filterable" ref={usdFilterRef}>
                      <div className="transactions-th-content">
                        <span>USD (Now)</span>
                        <button
                          type="button"
                          className={`transactions-th-filter-btn ${activeTransactionFilter === "usd" ? "is-active" : ""} ${hasUsdFilter ? "has-value" : ""}`}
                          onClick={() =>
                            setActiveTransactionFilter((current) =>
                              current === "usd" ? null : "usd",
                            )
                          }
                          aria-label="Filter USD column"
                          title="Filter USD"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2 3h12l-4.5 5v4l-3-1.8V8z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      {activeTransactionFilter === "usd" && (
                        <div className="transactions-th-popover transactions-th-popover-amount">
                          <label className="transactions-filter-field transactions-filter-field-amount">
                            <span>Min USD</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={transactionMinUsd}
                              onChange={(event) => setTransactionMinUsd(event.target.value)}
                              placeholder="0"
                            />
                          </label>
                          <label className="transactions-filter-field transactions-filter-field-amount">
                            <span>Max USD</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={transactionMaxUsd}
                              onChange={(event) => setTransactionMaxUsd(event.target.value)}
                              placeholder="No limit"
                            />
                          </label>
                          <button
                            type="button"
                            className="transactions-filter-reset"
                            onClick={() => {
                              setTransactionMinUsd("");
                              setTransactionMaxUsd("");
                            }}
                          >
                            Reset USD
                          </button>
                        </div>
                      )}
                    </th>
                    <th>Tx Hash</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length ? (
                    filteredTransactions.map((transfer) => (
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
                        No transactions found for the current filters.
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
