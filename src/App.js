import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import TransactionsModal from "./components/TransactionsModal";
import SparklineSvg from "./components/SparklineSvg";
import SelectedNodeCard from "./components/SelectedNodeCard";
import useTransactionState from "./hooks/useTransactionState";
import useUrlState, { readUrlParams } from "./hooks/useUrlState";
import { fetchJsonWithTimeout } from "./api/http";
import {
  createActivityEndpoint as buildActivityEndpoint,
  createGraphEndpoint as buildGraphEndpoint,
  createSyncStatusEndpoint as buildSyncStatusEndpoint,
  createTokenInfoEndpoint as buildTokenInfoEndpoint,
  createTokensEndpoint as buildTokensEndpoint,
  createTransactionsEndpoint as buildTransactionsEndpoint,
  fetchAllTransactionsForAddress as fetchAllTransactionsForAddressFromApi,
  fetchTransactionsPageForAddress as fetchTransactionsPageForAddressFromApi,
} from "./api/mapsApi";
import {
  HOLDER_TYPES,
  MOCK_TOKEN_DATA_BY_SYMBOL,
  MOCK_TOKEN_SYMBOLS,
  TOKEN_INFO,
} from "./data/mockData";
import "./App.css";

const STATS_PANEL_STORAGE_KEY = "phantasma-maps:stats-panel-collapsed";
const COLOR_THEME_STORAGE_KEY = "phantasma-maps:color-theme";
const TOKEN_SYMBOL_STORAGE_KEY = "phantasma-maps:selected-token-symbol";
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
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

function parseEnvInt(key, fallbackValue) {
  const raw = process.env[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallbackValue;
}

function parseEnvString(key, fallbackValue = "") {
  const raw = process.env[key];
  if (typeof raw !== "string") return fallbackValue;
  const trimmed = raw.trim();
  if (!trimmed) return fallbackValue;

  // .env values are sometimes copied with wrapping quotes.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || fallbackValue;
  }

  return trimmed;
}

const PHANTASMA_EXPLORER_BASE =
  parseEnvString("REACT_APP_PHANTASMA_EXPLORER_BASE") ||
  "https://explorer.phantasma.info/address/";
const PHANTASMA_TX_EXPLORER_BASE =
  parseEnvString("REACT_APP_PHANTASMA_TX_EXPLORER_BASE") ||
  "https://explorer.phantasma.info/tx/";
const SOUL_PRICE_API_URL =
  parseEnvString("REACT_APP_SOUL_PRICE_API_URL") ||
  "https://api.coingecko.com/api/v3/simple/price?ids=phantasma&vs_currencies=usd&include_24hr_change=true";
const CMC_SOUL_QUOTES_API_URL =
  parseEnvString("REACT_APP_CMC_SOUL_QUOTES_API_URL") ||
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=SOUL&convert=USD";
const CMC_SOUL_SYMBOL = (
  parseEnvString("REACT_APP_CMC_SOUL_SYMBOL", "SOUL") || "SOUL"
).toUpperCase();
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
const CMC_API_KEY = parseEnvString("REACT_APP_CMC_API_KEY");
const CMC_PROXY_URL = parseEnvString("REACT_APP_CMC_PROXY_URL");
const CMC_ALLOW_BROWSER_DIRECT =
  String(
    parseEnvString("REACT_APP_CMC_ALLOW_BROWSER_DIRECT") || "",
  ).toLowerCase() === "true";
const MAPS_API_BASE_URL =
  parseEnvString("REACT_APP_MAPS_API_BASE_URL") || "http://localhost:3000";
const DEFAULT_MAPS_API_TOKEN_SYMBOL = (
  parseEnvString("REACT_APP_MAPS_API_TOKEN_SYMBOL", "SOUL") || "SOUL"
).toUpperCase();
const MAPS_API_ROOT_ADDRESS = parseEnvString("REACT_APP_MAPS_API_ROOT_ADDRESS");
const MAPS_API_GRAPH_DEPTH = parseEnvInt("REACT_APP_MAPS_API_GRAPH_DEPTH", 2);
const MAPS_API_GRAPH_EDGE_LIMIT = parseEnvInt(
  "REACT_APP_MAPS_API_GRAPH_EDGE_LIMIT",
  1200,
);
const MAPS_API_GRAPH_NODE_LIMIT = parseEnvInt(
  "REACT_APP_MAPS_API_GRAPH_NODE_LIMIT",
  300,
);
const MAPS_API_REQUEST_TIMEOUT_MS = parseEnvMs(
  "REACT_APP_MAPS_API_REQUEST_TIMEOUT_MS",
  45000,
);
const MAPS_API_TX_PAGE_SIZE = parseEnvInt(
  "REACT_APP_MAPS_API_TX_PAGE_SIZE",
  250,
);
const MAPS_API_TX_MAX_PAGES = parseEnvInt("REACT_APP_MAPS_API_TX_MAX_PAGES", 8);
const MAPS_API_CONNECTIONS_TX_MAX_PAGES = parseEnvInt(
  "REACT_APP_MAPS_API_CONNECTIONS_TX_MAX_PAGES",
  3,
);
const MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS = parseEnvMs(
  "REACT_APP_MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS",
  30000,
);

function shortenAddress(address) {
  if (typeof address !== "string" || address.length <= 10)
    return address || "Unknown";
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

function inferHolderType(label, pct) {
  if (!Number.isFinite(pct) || pct < 0.1) return "minor";
  if (pct < 1) return "medium";
  if (pct < 5) return "large";
  if (pct < 10) return "major";
  return "dominant";
}

function normalizeAmount(rawAmount) {
  const parsed = Number(rawAmount);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallbackValue;
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslToRgbString(h, s, l) {
  const normalizedHue = ((Number(h) % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, Number(s))) / 100;
  const lightness = Math.max(0, Math.min(100, Number(l))) / 100;

  if (saturation === 0) {
    const channel = clampColorChannel(lightness * 255);
    return `${channel}, ${channel}, ${channel}`;
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;

  if (hueSection >= 0 && hueSection < 1) {
    redPrime = chroma;
    greenPrime = x;
  } else if (hueSection < 2) {
    redPrime = x;
    greenPrime = chroma;
  } else if (hueSection < 3) {
    greenPrime = chroma;
    bluePrime = x;
  } else if (hueSection < 4) {
    greenPrime = x;
    bluePrime = chroma;
  } else if (hueSection < 5) {
    redPrime = x;
    bluePrime = chroma;
  } else {
    redPrime = chroma;
    bluePrime = x;
  }

  const match = lightness - chroma / 2;
  const red = clampColorChannel((redPrime + match) * 255);
  const green = clampColorChannel((greenPrime + match) * 255);
  const blue = clampColorChannel((bluePrime + match) * 255);
  return `${red}, ${green}, ${blue}`;
}

function hashToHue(value) {
  const source = String(value || "");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 360;
  }
  return hash;
}

function applyCurrentSupplyToNodes(nodes, currentSupply) {
  if (!Array.isArray(nodes) || !nodes.length) return [];

  const supplyBase = Number(currentSupply);
  if (!Number.isFinite(supplyBase) || supplyBase <= 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const value = Number(node?.value) || 0;
    const pct = (value / supplyBase) * 100;

    return {
      ...node,
      pct: pct.toFixed(2),
      type: inferHolderType(node?.label, pct),
    };
  });
}

function buildGraphDataFromApi(graphPayload, decimals = 0) {
  const apiNodes = Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : [];
  const apiEdges = Array.isArray(graphPayload?.edges) ? graphPayload.edges : [];

  if (!apiNodes.length || !apiEdges.length) {
    return null;
  }

  // Apply on-chain decimal normalization if the API provides raw amounts.
  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;

  // Read explicitly-provided totalSupply from the graph payload (already
  // normalized by the API, or raw if decimals are provided here).
  const payloadTotalSupply =
    normalizeAmount(graphPayload?.totalSupply) / divisor;

  const nodeStats = new Map();

  for (const edge of apiEdges) {
    const from = String(edge?.fromAddress || "").trim();
    const to = String(edge?.toAddress || "").trim();

    if (!from || !to) continue;

    nodeStats.set(from, {
      sentTransactions: (nodeStats.get(from)?.sentTransactions || 0) + 1,
      receivedTransactions: nodeStats.get(from)?.receivedTransactions || 0,
    });
    nodeStats.set(to, {
      sentTransactions: nodeStats.get(to)?.sentTransactions || 0,
      receivedTransactions: (nodeStats.get(to)?.receivedTransactions || 0) + 1,
    });
  }

  const discoveredTotal = apiNodes.reduce(
    (sum, node) => sum + normalizeAmount(node?.balance) / divisor,
    0,
  );
  // Prefer the explicitly-supplied totalSupply, fall back to sum of nodes.
  const shareBase =
    payloadTotalSupply > 0 ? payloadTotalSupply : discoveredTotal || 1;

  const mappedNodes = apiNodes
    .map((node) => {
      const id = String(node?.address || "").trim();
      if (!id) return null;

      const value = normalizeAmount(node?.balance) / divisor;
      const pct = (value / shareBase) * 100;
      const label = String(node?.label || "").trim() || shortenAddress(id);
      const type = inferHolderType(label, pct);
      const stats = nodeStats.get(id) || {
        sentTransactions: 0,
        receivedTransactions: 0,
      };

      return {
        id,
        label,
        shortAddr: shortenAddress(id),
        value,
        pct: pct.toFixed(2),
        type,
        sentTransactions: stats.sentTransactions,
        receivedTransactions: stats.receivedTransactions,
      };
    })
    .filter(Boolean);

  const validNodeIds = new Set(mappedNodes.map((node) => node.id));
  const edgeMap = new Map();

  for (const edge of apiEdges) {
    const source = String(edge?.fromAddress || "").trim();
    const target = String(edge?.toAddress || "").trim();

    if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue;

    const key = `${source}->${target}`;
    const prev = edgeMap.get(key);

    if (!prev) {
      edgeMap.set(key, {
        source,
        target,
        transactionVolume: normalizeAmount(edge?.amount) / divisor,
        sentTransactions: 1,
        receivedTransactions: 1,
        transactionHash: String(edge?.txHash || ""),
      });
      continue;
    }

    prev.transactionVolume += normalizeAmount(edge?.amount) / divisor;
    prev.sentTransactions += 1;
    prev.receivedTransactions += 1;
  }

  return {
    nodes: mappedNodes,
    links: [...edgeMap.values()],
    totalValue: discoveredTotal,
    totalSupply: payloadTotalSupply > 0 ? payloadTotalSupply : 0,
  };
}

function buildNeighborFocusedGraph(graphData, rootAddress) {
  const normalizedRoot = String(rootAddress || "").trim();
  if (!normalizedRoot) return graphData;

  const rootNode = graphData.nodes.find((node) => node.id === normalizedRoot);
  if (!rootNode) return null;

  const neighboringLinks = graphData.links.filter(
    (link) => link.source === normalizedRoot || link.target === normalizedRoot,
  );

  if (!neighboringLinks.length) {
    return {
      nodes: [
        {
          ...rootNode,
          isSearchRoot: true,
          visualValue: Math.max(rootNode.value || 1, 10),
        },
      ],
      links: [],
      totalValue: rootNode.value || 0,
      rootNodeId: normalizedRoot,
    };
  }

  const visibleNodeIds = new Set([normalizedRoot]);
  neighboringLinks.forEach((link) => {
    visibleNodeIds.add(link.source);
    visibleNodeIds.add(link.target);
  });

  const scopedNodes = graphData.nodes.filter((node) =>
    visibleNodeIds.has(node.id),
  );
  const scopedLinks = neighboringLinks;

  const neighborVisualValues = scopedNodes
    .filter((node) => node.id !== normalizedRoot)
    .map((node) => Math.max((node.value || 1) * 0.35, 1));
  const maxNeighborVisual = neighborVisualValues.length
    ? Math.max(...neighborVisualValues)
    : 1;

  const emphasizedNodes = scopedNodes.map((node) => {
    if (node.id === normalizedRoot) {
      return {
        ...node,
        isSearchRoot: true,
        visualValue: Math.max(node.value || 1, maxNeighborVisual * 2.1),
      };
    }

    return {
      ...node,
      isSearchRoot: false,
      visualValue: Math.max((node.value || 1) * 0.35, 1),
    };
  });

  const scopedTotal = emphasizedNodes.reduce(
    (sum, node) => sum + Number(node.value || 0),
    0,
  );

  return {
    nodes: emphasizedNodes,
    links: scopedLinks,
    totalValue: scopedTotal,
    rootNodeId: normalizedRoot,
  };
}

function limitGraphForDisplay(
  nodes,
  links,
  maxNodes,
  maxEdges,
  rootNodeId = "",
) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeLinks = Array.isArray(links) ? links : [];

  if (!safeNodes.length) {
    return {
      nodes: [],
      links: [],
    };
  }

  const normalizedMaxEdges = normalizePositiveInteger(
    maxEdges,
    safeLinks.length || 1,
  );
  const normalizedMaxNodes = normalizePositiveInteger(
    maxNodes,
    safeNodes.length || 1,
  );
  const nodeById = new Map(
    safeNodes.map((node) => [String(node?.id || "").trim(), node]),
  );
  const normalizedRootNodeId = String(rootNodeId || "").trim();
  const limitedLinks = safeLinks.slice(0, normalizedMaxEdges);
  const prioritizedNodeIds = [];
  const seenNodeIds = new Set();

  function addNodeId(nodeId) {
    const normalizedNodeId = String(nodeId || "").trim();
    if (!normalizedNodeId || seenNodeIds.has(normalizedNodeId)) return;
    if (!nodeById.has(normalizedNodeId)) return;
    seenNodeIds.add(normalizedNodeId);
    prioritizedNodeIds.push(normalizedNodeId);
  }

  addNodeId(normalizedRootNodeId);

  limitedLinks.forEach((link) => {
    addNodeId(link?.source);
    addNodeId(link?.target);
  });

  safeNodes
    .slice()
    .sort((leftNode, rightNode) => {
      if (String(leftNode?.id || "") === normalizedRootNodeId) return -1;
      if (String(rightNode?.id || "") === normalizedRootNodeId) return 1;
      return Number(rightNode?.value || 0) - Number(leftNode?.value || 0);
    })
    .forEach((node) => addNodeId(node?.id));

  const allowedNodeIds = new Set(
    prioritizedNodeIds.slice(0, normalizedMaxNodes),
  );
  const limitedNodes = safeNodes.filter((node) => allowedNodeIds.has(node.id));
  const fullyLimitedLinks = limitedLinks.filter(
    (link) =>
      allowedNodeIds.has(String(link?.source || "").trim()) &&
      allowedNodeIds.has(String(link?.target || "").trim()),
  );

  return {
    nodes: limitedNodes,
    links: fullyLimitedLinks,
  };
}

function buildConnectionsGraphFromTransactions(
  transactions,
  rootAddress,
  fallbackGraph,
  currentSupply = 0,
) {
  const normalizedRoot = String(rootAddress || "").trim();
  if (!normalizedRoot || !Array.isArray(transactions) || !transactions.length) {
    return null;
  }

  const fallbackNodes = Array.isArray(fallbackGraph?.nodes)
    ? fallbackGraph.nodes
    : [];
  const fallbackNodeById = new Map(
    fallbackNodes.map((node) => [node.id, node]),
  );
  const linkMap = new Map();
  const nodeStats = new Map();
  const nodeVolumes = new Map();

  function ensureNodeStats(nodeId) {
    if (!nodeStats.has(nodeId)) {
      nodeStats.set(nodeId, {
        sentTransactions: 0,
        receivedTransactions: 0,
      });
    }
    return nodeStats.get(nodeId);
  }

  function addNodeVolume(nodeId, amount) {
    nodeVolumes.set(nodeId, (nodeVolumes.get(nodeId) || 0) + amount);
  }

  transactions.forEach((transaction) => {
    const source = String(
      transaction?.from_address ?? transaction?.fromAddress ?? "",
    ).trim();
    const target = String(
      transaction?.to_address ?? transaction?.toAddress ?? "",
    ).trim();

    if (!source || !target) return;
    if (source !== normalizedRoot && target !== normalizedRoot) return;
    if (source === target) return;

    const amount = normalizeAmount(
      transaction?.amountNormalized ??
        transaction?.amount_normalized ??
        transaction?.amount,
    );
    const txHash = String(
      transaction?.tx_hash ?? transaction?.txHash ?? "",
    ).trim();
    const linkKey = `${source}->${target}`;
    const existingLink = linkMap.get(linkKey);

    if (!existingLink) {
      linkMap.set(linkKey, {
        source,
        target,
        transactionVolume: amount,
        sentTransactions: 1,
        receivedTransactions: 1,
        transactionHash: txHash,
      });
    } else {
      existingLink.transactionVolume += amount;
      existingLink.sentTransactions += 1;
      existingLink.receivedTransactions += 1;
      if (!existingLink.transactionHash && txHash) {
        existingLink.transactionHash = txHash;
      }
    }

    ensureNodeStats(source).sentTransactions += 1;
    ensureNodeStats(target).receivedTransactions += 1;
    addNodeVolume(source, amount);
    addNodeVolume(target, amount);
  });

  if (!linkMap.size) return null;

  const nodeIds = new Set([normalizedRoot]);
  linkMap.forEach((link) => {
    nodeIds.add(link.source);
    nodeIds.add(link.target);
  });

  const baseNodes = [...nodeIds].map((nodeId) => {
    const fallbackNode = fallbackNodeById.get(nodeId);
    const volume = nodeVolumes.get(nodeId) || 0;
    const knownValue = Number(fallbackNode?.value);
    const value =
      Number.isFinite(knownValue) && knownValue > 0
        ? knownValue
        : Math.max(volume, 1);
    const pct =
      Number.isFinite(currentSupply) && currentSupply > 0
        ? (value / currentSupply) * 100
        : Number(fallbackNode?.pct) || 0;
    const label =
      String(fallbackNode?.label || "").trim() || shortenAddress(nodeId);
    const stats = ensureNodeStats(nodeId);

    return {
      ...fallbackNode,
      id: nodeId,
      label,
      shortAddr: fallbackNode?.shortAddr || shortenAddress(nodeId),
      value,
      pct: pct.toFixed(2),
      type: fallbackNode?.type || inferHolderType(label, pct),
      sentTransactions: stats.sentTransactions,
      receivedTransactions: stats.receivedTransactions,
      isSearchRoot: nodeId === normalizedRoot,
    };
  });

  const counterpartyVisualValues = baseNodes
    .filter((node) => node.id !== normalizedRoot)
    .map((node) => Math.max(nodeVolumes.get(node.id) || node.value || 1, 1));
  const maxCounterpartyVisual = counterpartyVisualValues.length
    ? Math.max(...counterpartyVisualValues)
    : 1;

  const emphasizedNodes = baseNodes.map((node) => {
    if (node.id === normalizedRoot) {
      return {
        ...node,
        visualValue: Math.max(
          nodeVolumes.get(node.id) || node.value || 1,
          maxCounterpartyVisual * 2.1,
        ),
      };
    }

    return {
      ...node,
      visualValue: Math.max(nodeVolumes.get(node.id) || node.value || 1, 1),
    };
  });

  const totalValue = emphasizedNodes.reduce(
    (sum, node) => sum + Number(node.value || 0),
    0,
  );

  return {
    nodes: emphasizedNodes,
    links: [...linkMap.values()],
    totalValue,
    rootNodeId: normalizedRoot,
  };
}

function parseTimestampMs(rawTimestamp) {
  const ms = new Date(rawTimestamp).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function getMockTokenData(tokenSymbol) {
  const mockTokenData = MOCK_TOKEN_DATA_BY_SYMBOL[tokenSymbol] || null;
  if (!mockTokenData) return null;

  return {
    ...mockTokenData,
    holders: Array.isArray(mockTokenData.holders)
      ? mockTokenData.holders.map((holder) => ({
          ...holder,
          type: inferHolderType(holder.label, Number(holder.pct)),
        }))
      : [],
  };
}

function parseCoinGeckoQuote(payload) {
  const coinData =
    payload?.phantasma ||
    payload?.soul ||
    (payload && typeof payload === "object" ? Object.values(payload)[0] : null);
  const usdPrice = Number(coinData?.usd);
  const usdChange24h = Number(coinData?.usd_24h_change);
  if (!Number.isFinite(usdPrice) || !Number.isFinite(usdChange24h)) {
    return null;
  }
  return {
    price: usdPrice,
    priceChange24h: usdChange24h,
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
    priceChange24h: usdChange24h,
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

function fmtSharePct(value, currentSupply, fallbackPct = 0) {
  if (Number.isFinite(currentSupply) && currentSupply > 0) {
    return `${(((Number(value) || 0) / currentSupply) * 100).toFixed(2)}%`;
  }

  const parsedFallback = Number(fallbackPct);
  return `${(Number.isFinite(parsedFallback) ? parsedFallback : 0).toFixed(2)}%`;
}

function formatUtcDateTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Invalid date";

  return `${date.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  })} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

function parseUtcDateTimeInput(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return null;

  const normalizedWithSeconds =
    normalizedValue.length === 16 ? `${normalizedValue}:00` : normalizedValue;
  const timestamp = new Date(`${normalizedWithSeconds}Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toUtcDateTimeInputValue(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function makeExportFileName(selectedNode, ext) {
  const addr = selectedNode?.shortAddr?.replace(/[^a-zA-Z0-9]/g, "") || "node";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `transactions-${addr}-${stamp}.${ext}`;
}

export default function App() {
  const bubbleMapActionsRef = useRef(null);
  const pendingMobileFitKeyRef = useRef(null);
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
  const [activeHolderTypeFilter, setActiveHolderTypeFilter] = useState("");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const {
    activeTransactionFilter,
    setActiveTransactionFilter,
    transactionDirFilter,
    setTransactionDirFilter,
    transactionCounterpartyFilter,
    setTransactionCounterpartyFilter,
    transactionStartTime,
    setTransactionStartTime,
    transactionEndTime,
    setTransactionEndTime,
    transactionMinAmount,
    setTransactionMinAmount,
    transactionMaxAmount,
    setTransactionMaxAmount,
    transactionMinUsd,
    setTransactionMinUsd,
    transactionMaxUsd,
    setTransactionMaxUsd,
    transactionSortBy,
    setTransactionSortBy,
    transactionSortDirection,
    setTransactionSortDirection,
    transactionPage,
    setTransactionPage,
    resetTransactionState,
  } = useTransactionState();
  const [liveTokenInfo, setLiveTokenInfo] = useState(TOKEN_INFO);
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState(() => {
    const { tokenSymbol: urlToken } = readUrlParams();
    if (urlToken) return urlToken;
    try {
      const stored = window.localStorage.getItem(TOKEN_SYMBOL_STORAGE_KEY);
      return stored || DEFAULT_MAPS_API_TOKEN_SYMBOL;
    } catch {
      return DEFAULT_MAPS_API_TOKEN_SYMBOL;
    }
  });
  const previousSelectedTokenSymbolRef = useRef(selectedTokenSymbol);
  const initialNodeIdFromUrlRef = useRef(readUrlParams().nodeId);
  const [apiTokenSymbols, setApiTokenSymbols] = useState([]);
  const [apiTokenInfo, setApiTokenInfo] = useState(null);
  const [trackedTokenSupply, setTrackedTokenSupply] = useState(0);
  const [tokenSelectorStatus, setTokenSelectorStatus] = useState("");
  const [mapNodes, setMapNodes] = useState([]);
  const [mapLinks, setMapLinks] = useState([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapDataStatus, setMapDataStatus] = useState("");
  const [isUsingMockApiFallback, setIsUsingMockApiFallback] = useState(false);
  const [selectedNodeApiTransactions, setSelectedNodeApiTransactions] =
    useState([]);
  const [
    selectedNodeApiTransactionsTotal,
    setSelectedNodeApiTransactionsTotal,
  ] = useState(0);
  const [
    selectedNodeApiTransactionsError,
    setSelectedNodeApiTransactionsError,
  ] = useState("");
  const [
    isSelectedNodeTransactionsLoading,
    setIsSelectedNodeTransactionsLoading,
  ] = useState(false);
  const [selectedNodeSparkline, setSelectedNodeSparkline] = useState([]);
  const [priceLastUpdatedAt, setPriceLastUpdatedAt] = useState(null);
  const [blockSyncHeight, setBlockSyncHeight] = useState(null);
  const [blockSyncTargetHeight, setBlockSyncTargetHeight] = useState(null);
  const [blockSyncUpdatedAt, setBlockSyncUpdatedAt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedRootAddress, setSearchedRootAddress] = useState(
    MAPS_API_ROOT_ADDRESS || "",
  );
  const [graphEdgeLimit, setGraphEdgeLimit] = useState(
    MAPS_API_GRAPH_EDGE_LIMIT,
  );
  const [graphNodeLimit, setGraphNodeLimit] = useState(
    MAPS_API_GRAPH_NODE_LIMIT,
  );
  const [isGraphMaxModeEnabled, setIsGraphMaxModeEnabled] = useState(false);
  const [isConnectionsView, setIsConnectionsView] = useState(false);
  const activeGraphRootAddress = useMemo(
    () => String(searchedRootAddress || MAPS_API_ROOT_ADDRESS || "").trim(),
    [searchedRootAddress],
  );
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleChange = (event) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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
    try {
      window.localStorage.setItem(
        TOKEN_SYMBOL_STORAGE_KEY,
        selectedTokenSymbol,
      );
    } catch {
      // Ignore storage access issues and keep token selection in memory.
    }
  }, [selectedTokenSymbol]);

  useUrlState(selectedTokenSymbol, selectedNode);

  useEffect(() => {
    if (previousSelectedTokenSymbolRef.current === selectedTokenSymbol) {
      return;
    }

    previousSelectedTokenSymbolRef.current = selectedTokenSymbol;
    setSearchQuery("");
    setSearchedRootAddress(MAPS_API_ROOT_ADDRESS || "");
    setIsConnectionsView(false);
    setActiveHolderTypeFilter("");
    setSelectedNode(null);
    setHoveredNode(null);
    closeTransfersModal();
  }, [selectedTokenSymbol]);

  useEffect(() => {
    let isMounted = true;

    async function fetchTokenInfo() {
      const result = await fetchJsonWithTimeout(
        buildTokenInfoEndpoint(MAPS_API_BASE_URL, selectedTokenSymbol),
        { cache: "no-store" },
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        setApiTokenInfo(null);
        return;
      }

      const payload = result.payload;
      const metadataMaxSupplyRaw =
        payload?.maxSupplyNormalized ?? payload?.max_supply_normalized;
      const hasMetadataTotalSupply =
        metadataMaxSupplyRaw !== undefined && metadataMaxSupplyRaw !== null;
      const parsedMetadataTotalSupply = Number(metadataMaxSupplyRaw);
      const parsedCurrentSupply = Number(
        payload?.currentSupplyNormalized ?? payload?.current_supply_normalized,
      );

      setApiTokenInfo({
        fullName: String(payload?.name || "").trim(),
        totalSupply: Number.isFinite(parsedMetadataTotalSupply)
          ? parsedMetadataTotalSupply
          : null,
        currentSupply: Number.isFinite(parsedCurrentSupply)
          ? parsedCurrentSupply
          : 0,
        hasMetadataTotalSupply,
        decimals: Number(payload?.decimals ?? 0) || 0,
        chain: String(TOKEN_INFO.chain).trim(),
      });
    }

    fetchTokenInfo().catch(() => {
      if (!isMounted) return;
      setApiTokenInfo(null);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTokenSymbol]);

  function isPotentialAddress(rawValue) {
    const value = String(rawValue || "").trim();
    return /^P[a-zA-Z0-9]{20,}$/.test(value);
  }

  function handleHeaderSearch(rawValue) {
    const value = String(rawValue || "").trim();

    if (!value) {
      setSearchQuery("");
      setSearchedRootAddress(MAPS_API_ROOT_ADDRESS || "");
      setIsConnectionsView(false);
      return;
    }

    if (isPotentialAddress(value)) {
      setSearchQuery("");
      setActiveHolderTypeFilter("");
      setHoveredNode(null);
      setSelectedNode(null);
      closeTransfersModal();
      setSearchedRootAddress(value);
      setIsConnectionsView(true);
      return;
    }

    setSearchedRootAddress(MAPS_API_ROOT_ADDRESS || "");
    setIsConnectionsView(false);
    setSearchQuery(value);
  }

  function handleShowNodeConnections(nodeId) {
    const value = String(nodeId || "").trim();
    if (!value) return;

    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress(value);
    setIsConnectionsView(true);
  }

  function handleClearConnections() {
    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress(MAPS_API_ROOT_ADDRESS || "");
    setIsConnectionsView(false);
  }

  useEffect(() => {
    if (!isMobileViewport) {
      pendingMobileFitKeyRef.current = null;
      return;
    }

    const nextRootAddress = String(
      searchedRootAddress || MAPS_API_ROOT_ADDRESS || "",
    ).trim();

    pendingMobileFitKeyRef.current = [
      selectedTokenSymbol,
      nextRootAddress || "token",
      activeHolderTypeFilter || "all-types",
      searchQuery || "all",
    ].join("::");
  }, [
    activeHolderTypeFilter,
    isMobileViewport,
    searchQuery,
    searchedRootAddress,
    selectedTokenSymbol,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function fetchAvailableTokens() {
      const result = await fetchJsonWithTimeout(
        buildTokensEndpoint(MAPS_API_BASE_URL),
        { cache: "no-store" },
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        setTokenSelectorStatus(
          result.status === 0
            ? "API token list unavailable"
            : `API token list request failed (${result.status})`,
        );
        setApiTokenSymbols([]);
        return;
      }

      const apiItems = Array.isArray(result.payload?.items)
        ? result.payload.items
        : [];
      const nextTokens = [
        ...new Set(
          apiItems
            .map((token) =>
              String(token || "")
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean),
        ),
      ];

      if (!nextTokens.length) {
        setApiTokenSymbols([]);
        setTokenSelectorStatus("No API tokens available");
        return;
      }

      setApiTokenSymbols(nextTokens);

      if (!nextTokens.includes(selectedTokenSymbol)) {
        setSelectedTokenSymbol(nextTokens[0]);
      }

      setTokenSelectorStatus(`Showing ${nextTokens.length} tracked tokens`);
    }

    fetchAvailableTokens().catch(() => {
      if (!isMounted) return;
      setApiTokenSymbols([]);
      setTokenSelectorStatus("API token list unavailable");
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTokenSymbol]);

  const selectedMockTokenData = useMemo(
    () => getMockTokenData(selectedTokenSymbol),
    [selectedTokenSymbol],
  );

  const availableTokenSymbols = useMemo(() => {
    if (isUsingMockApiFallback) {
      return [...new Set([selectedTokenSymbol, ...MOCK_TOKEN_SYMBOLS])];
    }

    if (apiTokenSymbols.length) {
      return apiTokenSymbols;
    }

    return selectedTokenSymbol ? [selectedTokenSymbol] : [];
  }, [apiTokenSymbols, isUsingMockApiFallback, selectedTokenSymbol]);

  const activeTokenInfo = useMemo(() => {
    const fallbackTokenInfo = selectedMockTokenData?.tokenInfo;
    const isSoul = selectedTokenSymbol === TOKEN_INFO.name;

    // Prefer API-sourced token metadata, then mock fallback, then defaults.
    const resolvedFullName =
      apiTokenInfo?.fullName ||
      null ||
      (isUsingMockApiFallback ? fallbackTokenInfo?.fullName : null) ||
      (isSoul ? TOKEN_INFO.fullName : `${selectedTokenSymbol} Token`);

    const resolvedChain = apiTokenInfo?.chain || null || TOKEN_INFO.chain;

    const hasMetadataTotalSupply = Boolean(
      apiTokenInfo?.hasMetadataTotalSupply,
    );

    // totalSupply: use token_metadata.max_supply_normalized when provided,
    // including explicit 0 (infinite supply). Otherwise fall back to
    // graph-derived supply, then mock/default data.
    const resolvedTotalSupply = hasMetadataTotalSupply
      ? Number.isFinite(apiTokenInfo?.totalSupply)
        ? apiTokenInfo.totalSupply
        : 0
      : (trackedTokenSupply > 0 ? trackedTokenSupply : 0) ||
        (isUsingMockApiFallback
          ? (fallbackTokenInfo?.totalSupply ??
            (isSoul ? TOKEN_INFO.totalSupply : 0))
          : 0);

    const resolvedCurrentSupply =
      (Number.isFinite(apiTokenInfo?.currentSupply)
        ? apiTokenInfo.currentSupply
        : null) ??
      ((trackedTokenSupply > 0 ? trackedTokenSupply : 0) ||
        (isUsingMockApiFallback
          ? (fallbackTokenInfo?.totalSupply ??
            (isSoul ? TOKEN_INFO.totalSupply : 0))
          : 0));

    return {
      name: selectedTokenSymbol,
      fullName: resolvedFullName,
      chain: resolvedChain,
      totalSupply: resolvedTotalSupply,
      currentSupply: resolvedCurrentSupply,
      hasMetadataTotalSupply,
      price: isSoul
        ? liveTokenInfo.price
        : isUsingMockApiFallback
          ? (fallbackTokenInfo?.price ?? null)
          : null,
      priceChange24h: isSoul
        ? liveTokenInfo.priceChange24h
        : isUsingMockApiFallback
          ? (fallbackTokenInfo?.priceChange24h ?? null)
          : null,
    };
  }, [
    apiTokenInfo,
    isUsingMockApiFallback,
    selectedMockTokenData,
    selectedTokenSymbol,
    trackedTokenSupply,
    liveTokenInfo.price,
    liveTokenInfo.priceChange24h,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function fetchMapGraph() {
      setIsMapLoading(true);
      setSelectedNode(null);
      setHoveredNode(null);
      setMapDataStatus(
        activeGraphRootAddress
          ? `Generating maps for ${selectedTokenSymbol} around ${shortenAddress(activeGraphRootAddress)}...`
          : `Generating maps for ${selectedTokenSymbol}...`,
      );

      const effectiveGraphEdgeLimit = graphEdgeLimit;

      const graphEndpoint = buildGraphEndpoint(
        MAPS_API_BASE_URL,
        selectedTokenSymbol,
        {
          rootAddress: activeGraphRootAddress || MAPS_API_ROOT_ADDRESS || "",
          depth: MAPS_API_GRAPH_DEPTH,
          edgeLimit: effectiveGraphEdgeLimit,
          defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
        },
      );
      const result = await fetchJsonWithTimeout(
        graphEndpoint,
        { cache: "no-store" },
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        if (result.status === 0) {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus("Connections unavailable (API timeout/network).");
          } else {
            setIsUsingMockApiFallback(true);
            setTrackedTokenSupply(
              selectedMockTokenData?.tokenInfo?.totalSupply || 0,
            );
            setMapNodes(selectedMockTokenData?.holders || []);
            setMapLinks(selectedMockTokenData?.links || []);
            setTokenSelectorStatus("API unavailable; showing mock tokens");
            setMapDataStatus("Using fallback map data (API unavailable).");
          }
        } else {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus(`Connections request failed (${result.status}).`);
          } else {
            setIsUsingMockApiFallback(false);
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setMapLinks([]);
            setMapDataStatus(`Graph request failed (${result.status}).`);
          }
        }
        setIsMapLoading(false);
        return;
      }

      setIsUsingMockApiFallback(false);

      const graphDecimals = apiTokenInfo?.decimals ?? 0;
      const mappedGraph = buildGraphDataFromApi(result.payload, graphDecimals);
      const baseFocusedGraph = isConnectionsView
        ? buildNeighborFocusedGraph(mappedGraph, activeGraphRootAddress)
        : searchedRootAddress
          ? buildNeighborFocusedGraph(mappedGraph, activeGraphRootAddress)
          : mappedGraph;
      let focusedGraph = baseFocusedGraph;
      const canRefineConnections = Boolean(
        isConnectionsView &&
        activeGraphRootAddress &&
        baseFocusedGraph &&
        baseFocusedGraph.nodes.length,
      );

      const refineConnectionsGraphInBackground = async () => {
        if (!canRefineConnections) return;

        try {
          const connectionTransactions =
            await fetchAllTransactionsForAddressFromApi(
              MAPS_API_BASE_URL,
              MAPS_API_REQUEST_TIMEOUT_MS,
              Math.max(
                1,
                Math.min(
                  MAPS_API_TX_MAX_PAGES,
                  MAPS_API_CONNECTIONS_TX_MAX_PAGES,
                ),
              ),
              MAPS_API_TX_PAGE_SIZE,
              activeGraphRootAddress,
              selectedTokenSymbol,
            );

          if (!isMounted) return;

          const transactionFocusedGraph = buildConnectionsGraphFromTransactions(
            connectionTransactions,
            activeGraphRootAddress,
            mappedGraph,
            mappedGraph?.totalSupply || 0,
          );

          if (
            !transactionFocusedGraph ||
            !Array.isArray(transactionFocusedGraph.nodes) ||
            !transactionFocusedGraph.nodes.length
          ) {
            return;
          }

          setMapNodes(transactionFocusedGraph.nodes);
          setMapLinks(transactionFocusedGraph.links);
          setTrackedTokenSupply(
            mappedGraph?.totalSupply > 0
              ? mappedGraph.totalSupply
              : transactionFocusedGraph.totalValue || 0,
          );

          if (transactionFocusedGraph.rootNodeId) {
            const focusedRootNode = transactionFocusedGraph.nodes.find(
              (node) => node.id === transactionFocusedGraph.rootNodeId,
            );
            setSelectedNode(focusedRootNode || null);
          }

          setMapDataStatus(
            `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:tx]`,
          );
        } catch {
          if (!isMounted) return;
          setMapDataStatus(
            `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:base]`,
          );
        }
      };

      if (!focusedGraph) {
        if (
          !mappedGraph ||
          !mappedGraph.nodes.length ||
          !mappedGraph.links.length
        ) {
          if (isConnectionsView) {
            setMapDataStatus("No connections found for this wallet.");
          } else {
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setMapLinks([]);
            setMapDataStatus("API returned no graph data.");
          }
          setIsMapLoading(false);
          return;
        }

        focusedGraph = baseFocusedGraph;
      }

      if (!focusedGraph || !focusedGraph.nodes.length) {
        if (isConnectionsView) {
          setMapDataStatus("Searched address not found in graph data.");
        } else {
          setTrackedTokenSupply(0);
          setMapNodes([]);
          setMapLinks([]);
          setMapDataStatus("Searched address not found in graph data.");
        }
        setIsMapLoading(false);
        return;
      }

      setMapNodes(focusedGraph.nodes);
      setMapLinks(focusedGraph.links);
      // Prefer the API's explicit totalSupply; fall back to discovered sum.
      setTrackedTokenSupply(
        mappedGraph?.totalSupply > 0
          ? mappedGraph.totalSupply
          : focusedGraph.totalValue || 0,
      );
      if (focusedGraph.rootNodeId) {
        const focusedRootNode = focusedGraph.nodes.find(
          (node) => node.id === focusedGraph.rootNodeId,
        );
        setSelectedNode(focusedRootNode || null);
      }
      setMapDataStatus(
        activeGraphRootAddress
          ? isConnectionsView
            ? canRefineConnections
              ? `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:base][refining]`
              : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:base]`
            : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)}`
          : `Live graph loaded from ${graphEndpoint}`,
      );
      setIsMapLoading(false);

      if (canRefineConnections) {
        void refineConnectionsGraphInBackground();
      }
    }

    fetchMapGraph().catch(() => {
      if (!isMounted) return;
      if (isConnectionsView) {
        setIsUsingMockApiFallback(false);
        setMapDataStatus("Unable to process connections graph.");
      } else {
        setIsUsingMockApiFallback(false);
        setTrackedTokenSupply(0);
        setMapNodes([]);
        setMapLinks([]);
        setMapDataStatus("Unable to process graph data.");
      }
      setIsMapLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [
    activeGraphRootAddress,
    apiTokenInfo,
    graphEdgeLimit,
    isConnectionsView,
    searchedRootAddress,
    selectedMockTokenData,
    selectedTokenSymbol,
  ]);

  useEffect(() => {
    let isActive = true;
    let timeoutId;
    let hasSuccessfulQuote = false;
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
            nextPollDelayMs =
              retryAfterMs ||
              Math.min(nextPollDelayMs * 2, SOUL_PRICE_MAX_BACKOFF_MS);
          } else {
            const bootstrapRetryFloorMs = 30000;
            const retryFloorMs = hasSuccessfulQuote
              ? SOUL_PRICE_BASE_POLL_INTERVAL_MS
              : bootstrapRetryFloorMs;
            nextPollDelayMs = Math.min(
              Math.max(nextPollDelayMs * 2, retryFloorMs),
              SOUL_PRICE_MAX_BACKOFF_MS,
            );
          }

          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        if (!isActive) {
          nextPollDelayMs = Math.max(
            SOUL_PRICE_BASE_POLL_INTERVAL_MS,
            nextPollDelayMs,
          );
          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        setLiveTokenInfo((current) => ({
          ...current,
          price: winner.quote.price,
          priceChange24h: winner.quote.priceChange24h,
        }));
        hasSuccessfulQuote = true;
        setPriceLastUpdatedAt(Date.now());
        nextPollDelayMs = SOUL_PRICE_BASE_POLL_INTERVAL_MS;
        scheduleNextPoll(nextPollDelayMs);
      } catch {
        // Keep last successful price if the API is unreachable.
        const bootstrapRetryFloorMs = 30000;
        const retryFloorMs = hasSuccessfulQuote
          ? SOUL_PRICE_BASE_POLL_INTERVAL_MS
          : bootstrapRetryFloorMs;
        nextPollDelayMs = Math.min(
          Math.max(nextPollDelayMs * 2, retryFloorMs),
          SOUL_PRICE_MAX_BACKOFF_MS,
        );
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

  useEffect(() => {
    let isActive = true;
    let timeoutId = null;

    async function fetchSyncStatus() {
      const result = await fetchJsonWithTimeout(
        buildSyncStatusEndpoint(MAPS_API_BASE_URL),
        { cache: "no-store" },
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isActive) return;

      if (result.ok) {
        const items = Array.isArray(result.payload?.items)
          ? result.payload.items
          : [];
        const chainState = items.find(
          (item) => String(item?.tokenSymbol || "") === "__chain__",
        );
        const nextHeight = Number(chainState?.lastBlockHeight);
        const nextTargetHeight = Number(result.payload?.chainHeadBlockHeight);
        const nextUpdatedAt = chainState?.updatedAt
          ? new Date(chainState.updatedAt).getTime()
          : null;

        setBlockSyncHeight(Number.isFinite(nextHeight) ? nextHeight : null);
        setBlockSyncTargetHeight(
          Number.isFinite(nextTargetHeight) ? nextTargetHeight : null,
        );
        setBlockSyncUpdatedAt(
          Number.isFinite(nextUpdatedAt) ? nextUpdatedAt : null,
        );
      }

      timeoutId = window.setTimeout(
        fetchSyncStatus,
        MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
      );
    }

    fetchSyncStatus().catch(() => {
      if (!isActive) return;
      setBlockSyncHeight(null);
      setBlockSyncTargetHeight(null);
      setBlockSyncUpdatedAt(null);
      timeoutId = window.setTimeout(
        fetchSyncStatus,
        MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
      );
    });

    return () => {
      isActive = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const displayNodes = useMemo(
    () => applyCurrentSupplyToNodes(mapNodes, activeTokenInfo.currentSupply),
    [mapNodes, activeTokenInfo.currentSupply],
  );
  const maxModeScopeGraph = useMemo(() => {
    if (!activeHolderTypeFilter) {
      return {
        nodes: displayNodes,
        links: mapLinks,
      };
    }

    const scopedNodes = displayNodes.filter(
      (node) => String(node?.type || "minor") === activeHolderTypeFilter,
    );
    const scopedNodeIds = new Set(scopedNodes.map((node) => node.id));
    const scopedLinks = mapLinks.filter(
      (link) =>
        scopedNodeIds.has(String(link?.source || "").trim()) &&
        scopedNodeIds.has(String(link?.target || "").trim()),
    );

    return {
      nodes: scopedNodes,
      links: scopedLinks,
    };
  }, [activeHolderTypeFilter, displayNodes, mapLinks]);

  const isTokenGraphMaxModeActive = isGraphMaxModeEnabled;
  const effectiveGraphNodeLimit = isTokenGraphMaxModeActive
    ? displayNodes.length
    : graphNodeLimit;
  const effectiveGraphEdgeLimit = isTokenGraphMaxModeActive
    ? mapLinks.length
    : graphEdgeLimit;

  const limitedDisplayGraph = useMemo(
    () =>
      limitGraphForDisplay(
        displayNodes,
        mapLinks,
        effectiveGraphNodeLimit,
        effectiveGraphEdgeLimit,
        activeGraphRootAddress,
      ),
    [
      activeGraphRootAddress,
      displayNodes,
      effectiveGraphEdgeLimit,
      effectiveGraphNodeLimit,
      mapLinks,
    ],
  );

  const legendScopedDisplayGraph = useMemo(() => {
    if (!activeHolderTypeFilter) {
      return limitedDisplayGraph;
    }

    const scopedNodes = displayNodes.filter(
      (node) => String(node?.type || "minor") === activeHolderTypeFilter,
    );

    if (!scopedNodes.length) {
      return {
        nodes: [],
        links: [],
      };
    }

    const scopedNodeIds = new Set(scopedNodes.map((node) => node.id));
    const scopedLinks = mapLinks.filter(
      (link) =>
        scopedNodeIds.has(String(link?.source || "").trim()) &&
        scopedNodeIds.has(String(link?.target || "").trim()),
    );
    const scopedRootAddress = scopedNodeIds.has(activeGraphRootAddress)
      ? activeGraphRootAddress
      : "";

    return limitGraphForDisplay(
      scopedNodes,
      scopedLinks,
      effectiveGraphNodeLimit,
      effectiveGraphEdgeLimit,
      scopedRootAddress,
    );
  }, [
    activeGraphRootAddress,
    activeHolderTypeFilter,
    displayNodes,
    effectiveGraphEdgeLimit,
    effectiveGraphNodeLimit,
    limitedDisplayGraph,
    mapLinks,
  ]);

  const filteredNodes = useMemo(() => {
    const typeFilteredNodes = legendScopedDisplayGraph.nodes;

    if (!searchQuery) return typeFilteredNodes;

    const q = searchQuery.toLowerCase();
    return typeFilteredNodes.filter(
      (h) =>
        h.id.toLowerCase().includes(q) ||
        h.label.toLowerCase().includes(q) ||
        h.shortAddr.toLowerCase().includes(q),
    );
  }, [searchQuery, legendScopedDisplayGraph.nodes]);

  const filteredLinks = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return legendScopedDisplayGraph.links.filter(
      (link) => ids.has(link.source) && ids.has(link.target),
    );
  }, [filteredNodes, legendScopedDisplayGraph.links]);

  const nodeById = useMemo(
    () =>
      new Map(
        legendScopedDisplayGraph.nodes.map((holder) => [holder.id, holder]),
      ),
    [legendScopedDisplayGraph.nodes],
  );

  useEffect(() => {
    if (!initialNodeIdFromUrlRef.current) return;
    const node = nodeById.get(initialNodeIdFromUrlRef.current);
    if (node) {
      setSelectedNode(node);
      initialNodeIdFromUrlRef.current = null;
    }
  }, [nodeById]);

  const resolvedSelectedNode = selectedNode
    ? nodeById.get(selectedNode.id) || selectedNode
    : null;
  const resolvedHoveredNode = hoveredNode
    ? nodeById.get(hoveredNode.id) || hoveredNode
    : null;

  const selectedNodeVisibleLinkCounts = useMemo(() => {
    if (!resolvedSelectedNode?.id) {
      return {
        sentTransactions: 0,
        receivedTransactions: 0,
      };
    }

    return filteredLinks.reduce(
      (totals, link) => {
        if (link.source === resolvedSelectedNode.id) {
          totals.sentTransactions += 1;
        }
        if (link.target === resolvedSelectedNode.id) {
          totals.receivedTransactions += 1;
        }
        return totals;
      },
      {
        sentTransactions: 0,
        receivedTransactions: 0,
      },
    );
  }, [filteredLinks, resolvedSelectedNode]);

  const canShowSelectedNodeConnections = useMemo(() => {
    if (!resolvedSelectedNode?.id) return false;
    if (resolvedSelectedNode.id === activeGraphRootAddress) return false;

    return (
      Number(resolvedSelectedNode.sentTransactions ?? 0) >
        selectedNodeVisibleLinkCounts.sentTransactions ||
      Number(resolvedSelectedNode.receivedTransactions ?? 0) >
        selectedNodeVisibleLinkCounts.receivedTransactions
    );
  }, [
    activeGraphRootAddress,
    resolvedSelectedNode,
    selectedNodeVisibleLinkCounts.receivedTransactions,
    selectedNodeVisibleLinkCounts.sentTransactions,
  ]);

  useEffect(() => {
    if (!activeHolderTypeFilter) return;
    const hasMatchingType = displayNodes.some(
      (node) => String(node?.type || "minor") === activeHolderTypeFilter,
    );
    if (!hasMatchingType) {
      setActiveHolderTypeFilter("");
    }
  }, [activeHolderTypeFilter, displayNodes]);

  function handleGraphSettingsApply(nextSettings) {
    const useMaxMode = nextSettings?.useMaxMode === true;

    setIsGraphMaxModeEnabled(useMaxMode);

    if (useMaxMode) {
      return;
    }

    setGraphEdgeLimit(
      normalizePositiveInteger(
        nextSettings?.edgeLimit,
        MAPS_API_GRAPH_EDGE_LIMIT,
      ),
    );
    setGraphNodeLimit(
      normalizePositiveInteger(
        nextSettings?.nodeLimit,
        MAPS_API_GRAPH_NODE_LIMIT,
      ),
    );
  }

  useEffect(() => {
    if (!isMobileViewport) return;
    if (isMapLoading) return;
    if (!filteredNodes.length) return;
    if (!bubbleMapActionsRef.current?.fitToView) return;
    if (!pendingMobileFitKeyRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      bubbleMapActionsRef.current?.fitToView?.();
      pendingMobileFitKeyRef.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    filteredLinks.length,
    filteredNodes.length,
    isMapLoading,
    isMobileViewport,
  ]);

  useEffect(() => {
    if (!selectedNode) return;
    const stillExists = filteredNodes.some(
      (node) => node.id === selectedNode.id,
    );
    if (!stillExists) {
      setSelectedNode(null);
    }
  }, [filteredNodes, selectedNode]);

  useEffect(() => {
    if (!selectedNode?.id) {
      setSelectedNodeApiTransactions([]);
      setSelectedNodeApiTransactionsTotal(0);
      setSelectedNodeApiTransactionsError("");
      setIsSelectedNodeTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchSelectedNodeTransactions() {
      setIsSelectedNodeTransactionsLoading(true);
      setSelectedNodeApiTransactionsError("");

      const startTs = parseUtcDateTimeInput(transactionStartTime);
      const endTs = parseUtcDateTimeInput(transactionEndTime);
      const minAmount =
        transactionMinAmount === "" ? null : Number(transactionMinAmount);
      const maxAmount =
        transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
      const minUsd =
        transactionMinUsd === "" ? null : Number(transactionMinUsd);
      const maxUsd =
        transactionMaxUsd === "" ? null : Number(transactionMaxUsd);

      const apiFilters = {
        direction: transactionDirFilter,
        counterparty: transactionCounterpartyFilter,
        startTime: startTs === null ? "" : new Date(startTs).toISOString(),
        endTime: endTs === null ? "" : new Date(endTs).toISOString(),
        minAmount: Number.isFinite(minAmount) ? minAmount : null,
        maxAmount: Number.isFinite(maxAmount) ? maxAmount : null,
        minUsd: Number.isFinite(minUsd) ? minUsd : null,
        maxUsd: Number.isFinite(maxUsd) ? maxUsd : null,
        usdRateNow: Number.isFinite(Number(activeTokenInfo.price))
          ? Number(activeTokenInfo.price)
          : null,
        sortBy:
          transactionSortBy === "amount" || transactionSortBy === "time"
            ? transactionSortBy
            : null,
        sortDir: transactionSortDirection,
      };

      try {
        const pageData = await fetchTransactionsPageForAddressFromApi(
          MAPS_API_BASE_URL,
          MAPS_API_REQUEST_TIMEOUT_MS,
          selectedNode.id,
          selectedTokenSymbol,
          {
            page: transactionPage + 1,
            pageSize: 100,
            filters: apiFilters,
          },
        );

        if (!isMounted) return;
        setSelectedNodeApiTransactions(pageData.items);
        setSelectedNodeApiTransactionsTotal(pageData.total);
        setSelectedNodeApiTransactionsError("");
      } catch {
        if (!isMounted) return;
        setSelectedNodeApiTransactions([]);
        setSelectedNodeApiTransactionsTotal(0);
        setSelectedNodeApiTransactionsError(
          "Using graph-derived transfers (transactions API unavailable).",
        );
      } finally {
        if (!isMounted) return;
        setIsSelectedNodeTransactionsLoading(false);
      }
    }

    fetchSelectedNodeTransactions();

    return () => {
      isMounted = false;
    };
  }, [
    selectedNode,
    selectedTokenSymbol,
    transactionPage,
    transactionDirFilter,
    transactionCounterpartyFilter,
    transactionStartTime,
    transactionEndTime,
    transactionMinAmount,
    transactionMaxAmount,
    transactionMinUsd,
    transactionMaxUsd,
    transactionSortBy,
    transactionSortDirection,
    activeTokenInfo.price,
  ]);

  useEffect(() => {
    setTransactionPage(0);
  }, [
    selectedNode?.id,
    selectedTokenSymbol,
    transactionDirFilter,
    transactionCounterpartyFilter,
    transactionStartTime,
    transactionEndTime,
    transactionMinAmount,
    transactionMaxAmount,
    transactionMinUsd,
    transactionMaxUsd,
  ]);

  const fallbackSelectedNodeTransfers = useMemo(() => {
    if (!selectedNode) return [];
    return mapLinks
      .filter(
        (link) =>
          link.source === selectedNode.id || link.target === selectedNode.id,
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
            counterpartNode?.label ||
            counterpartNode?.shortAddr ||
            counterpartId,
          counterpartAddress: counterpartId,
          counterpartAddr: counterpartNode?.shortAddr || counterpartId,
          token: activeTokenInfo.name,
          amount,
          usd: amount * Number(activeTokenInfo.price),
          sentTransactions: Number(link.sentTransactions ?? 0),
          receivedTransactions: Number(link.receivedTransactions ?? 0),
          transactionHash: link.transactionHash || "N/A",
          timestamp,
          timeUtc: formatUtcDateTime(timestamp),
          timeInputValue: toUtcDateTimeInputValue(timestamp),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [
    selectedNode,
    mapLinks,
    nodeById,
    activeTokenInfo.name,
    activeTokenInfo.price,
  ]);

  const selectedNodeTransfers = useMemo(() => {
    if (!selectedNode) return [];

    if (!selectedNodeApiTransactionsError) {
      return selectedNodeApiTransactions.map((transaction, index) => {
        const fromAddress = String(
          transaction.from_address ?? transaction.fromAddress ?? "",
        );
        const toAddress = String(
          transaction.to_address ?? transaction.toAddress ?? "",
        );
        const txHash = String(transaction.tx_hash ?? transaction.txHash ?? "");
        const token = String(
          transaction.token_symbol ??
            transaction.tokenSymbol ??
            activeTokenInfo.name,
        );
        const amount = normalizeAmount(
          transaction.amountNormalized ??
            transaction.amount_normalized ??
            transaction.amount,
        );
        const timestamp = parseTimestampMs(transaction.timestamp);
        const isOutgoing = fromAddress === selectedNode.id;
        const counterpartId = isOutgoing ? toAddress : fromAddress;
        const counterpartNode = nodeById.get(counterpartId);

        return {
          id: String(
            transaction.id ||
              `${txHash}-${transaction.event_index ?? transaction.eventIndex ?? index}`,
          ),
          direction: isOutgoing ? "To" : "From",
          counterpartLabel:
            counterpartNode?.label ||
            counterpartNode?.shortAddr ||
            shortenAddress(counterpartId),
          counterpartAddress: counterpartId,
          counterpartAddr:
            counterpartNode?.shortAddr || shortenAddress(counterpartId),
          token,
          amount,
          usd: amount * Number(activeTokenInfo.price),
          sentTransactions: isOutgoing ? 1 : 0,
          receivedTransactions: isOutgoing ? 0 : 1,
          transactionHash: txHash || "N/A",
          timestamp,
          timeUtc: formatUtcDateTime(timestamp),
          timeInputValue: toUtcDateTimeInputValue(timestamp),
        };
      });
    }

    return fallbackSelectedNodeTransfers;
  }, [
    selectedNode,
    selectedNodeApiTransactions,
    selectedNodeApiTransactionsError,
    fallbackSelectedNodeTransfers,
    nodeById,
    activeTokenInfo.name,
    activeTokenInfo.price,
  ]);

  const filteredTransactions = useMemo(() => {
    const shouldUseServerFilteredPage =
      Boolean(selectedNode?.id) && !selectedNodeApiTransactionsError;
    if (shouldUseServerFilteredPage) {
      return selectedNodeTransfers;
    }

    const startTs = parseUtcDateTimeInput(transactionStartTime);
    const endTs = parseUtcDateTimeInput(transactionEndTime);
    const minAmount =
      transactionMinAmount === "" ? null : Number(transactionMinAmount);
    const maxAmount =
      transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
    const minUsd = transactionMinUsd === "" ? null : Number(transactionMinUsd);
    const maxUsd = transactionMaxUsd === "" ? null : Number(transactionMaxUsd);
    const counterpartyQuery = transactionCounterpartyFilter
      .trim()
      .toLowerCase();

    const filtered = selectedNodeTransfers.filter((transaction) => {
      if (transactionDirFilter !== "all") {
        if (transaction.direction.toLowerCase() !== transactionDirFilter)
          return false;
      }
      if (counterpartyQuery) {
        const haystack =
          `${transaction.counterpartLabel} ${transaction.counterpartAddr}`.toLowerCase();
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

    if (transactionSortBy !== "amount" && transactionSortBy !== "time") {
      return filtered;
    }

    const directionMultiplier = transactionSortDirection === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const leftValue = Number(left?.[transactionSortBy]) || 0;
      const rightValue = Number(right?.[transactionSortBy]) || 0;
      if (leftValue === rightValue) return 0;
      return leftValue > rightValue
        ? directionMultiplier
        : -directionMultiplier;
    });
  }, [
    selectedNode,
    selectedNodeTransfers,
    selectedNodeApiTransactionsError,
    transactionDirFilter,
    transactionCounterpartyFilter,
    transactionStartTime,
    transactionEndTime,
    transactionMinAmount,
    transactionMaxAmount,
    transactionMinUsd,
    transactionMaxUsd,
    transactionSortBy,
    transactionSortDirection,
  ]);

  const TRANSACTIONS_PER_PAGE = 100;
  const isUsingApiTransactions =
    Boolean(selectedNode?.id) && !selectedNodeApiTransactionsError;
  const totalTransactionCount = isUsingApiTransactions
    ? selectedNodeApiTransactionsTotal
    : filteredTransactions.length;
  const transactionPageCount = Math.max(
    1,
    Math.ceil(totalTransactionCount / TRANSACTIONS_PER_PAGE),
  );
  const pagedTransactions = isUsingApiTransactions
    ? filteredTransactions
    : filteredTransactions.slice(
        transactionPage * TRANSACTIONS_PER_PAGE,
        (transactionPage + 1) * TRANSACTIONS_PER_PAGE,
      );

  const hasDirFilter = transactionDirFilter !== "all";
  const hasCounterpartyFilter = Boolean(transactionCounterpartyFilter.trim());
  const hasTimeFilter = Boolean(transactionStartTime || transactionEndTime);
  const hasAmountFilter = Boolean(transactionMinAmount || transactionMaxAmount);
  const hasUsdFilter = Boolean(transactionMinUsd || transactionMaxUsd);

  function resetAllTransactionFilters() {
    resetTransactionState();
  }

  function closeTransfersModal() {
    setIsExportMenuOpen(false);
    setIsTransfersModalOpen(false);
    resetAllTransactionFilters();
  }

  function handleTransactionSortToggle(nextSortBy) {
    if (nextSortBy !== "amount" && nextSortBy !== "time") return;
    setTransactionPage(0);
    setTransactionSortBy((currentSortBy) => {
      if (currentSortBy !== nextSortBy) {
        setTransactionSortDirection("asc");
        return nextSortBy;
      }

      setTransactionSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return currentSortBy;
    });
  }

  function buildExportRows() {
    return filteredTransactions.map((tx) => ({
      direction: tx.direction,
      counterparty: tx.counterpartLabel,
      address: tx.counterpartAddress || tx.counterpartAddr,
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
      downloadBlobFile(
        json,
        "application/json;charset=utf-8",
        makeExportFileName(selectedNode, "json"),
      );
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
      const escapeCsv = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [headers, ...csvRows]
        .map((line) => line.map(escapeCsv).join(","))
        .join("\n");
      downloadBlobFile(
        `\uFEFF${csv}`,
        "text/csv;charset=utf-8",
        makeExportFileName(selectedNode, "csv"),
      );
      setIsExportMenuOpen(false);
      return;
    }
  }

  const infoNode = resolvedHoveredNode || resolvedSelectedNode;
  const currentSupplyBase = Number(activeTokenInfo.currentSupply) || 0;

  const loadingThemeStyle = useMemo(() => {
    const chainLabel = String(activeTokenInfo.chain || "unknown").trim();
    const toneKey = `${selectedTokenSymbol}:${chainLabel}`;
    const hue = hashToHue(toneKey);
    const rgb = hslToRgbString(hue, 78, colorTheme === "light" ? 50 : 60);

    const chainLower = chainLabel.toLowerCase();
    const pulseDuration = chainLower.includes("main")
      ? "1.05s"
      : chainLower.includes("neo")
        ? "1.22s"
        : chainLower.includes("eth")
          ? "1.38s"
          : "1.18s";

    return {
      "--loading-network-rgb": rgb,
      "--loading-node-pulse-duration": pulseDuration,
      "--loading-link-draw-duration": "1.65s",
    };
  }, [activeTokenInfo.chain, colorTheme, selectedTokenSymbol]);

  useEffect(() => {
    if (!selectedNode) {
      setIsTransfersModalOpen(false);
      setCopiedAddress(null);
      setCopiedTxHash(null);
      setIsExportMenuOpen(false);
      resetTransactionState();
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedNode?.id || !selectedTokenSymbol) {
      setSelectedNodeSparkline([]);
      return;
    }

    let isMounted = true;
    const endpoint = buildActivityEndpoint(
      MAPS_API_BASE_URL,
      selectedNode.id,
      selectedTokenSymbol,
      30,
    );

    fetchJsonWithTimeout(
      endpoint,
      { cache: "no-store" },
      MAPS_API_REQUEST_TIMEOUT_MS,
    )
      .then((result) => {
        if (!isMounted) return;
        if (result.ok && Array.isArray(result.payload?.items)) {
          setSelectedNodeSparkline(result.payload.items);
        } else {
          setSelectedNodeSparkline([]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedNodeSparkline([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNode?.id, selectedTokenSymbol]);

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
        closeTransfersModal();
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
        onSearch={handleHeaderSearch}
        tokenInfo={activeTokenInfo}
        priceUpdatedAt={priceLastUpdatedAt}
        blockSyncHeight={blockSyncHeight}
        blockSyncTargetHeight={blockSyncTargetHeight}
        blockSyncUpdatedAt={blockSyncUpdatedAt}
        colorTheme={colorTheme}
        onThemeChange={setColorTheme}
        graphEdgeLimit={graphEdgeLimit}
        graphNodeLimit={graphNodeLimit}
        defaultGraphEdgeLimit={MAPS_API_GRAPH_EDGE_LIMIT}
        defaultGraphNodeLimit={MAPS_API_GRAPH_NODE_LIMIT}
        onGraphSettingsApply={handleGraphSettingsApply}
        isGraphMaxModeEnabled={isTokenGraphMaxModeActive}
        canUseGraphMaxMode={true}
        availableNodeCount={maxModeScopeGraph.nodes.length}
        availableEdgeCount={maxModeScopeGraph.links.length}
        renderedNodeCount={filteredNodes.length}
        renderedEdgeCount={filteredLinks.length}
      />
      <div className="main-layout">
        <div className="map-area">
          <BubbleMap
            nodes={filteredNodes}
            links={filteredLinks}
            onNodeClick={setSelectedNode}
            onNodeHover={setHoveredNode}
            selectedNodeId={selectedNode?.id}
            currentSupply={currentSupplyBase}
            colorTheme={colorTheme}
            onReady={(actions) => {
              bubbleMapActionsRef.current = actions;
            }}
          />
          {isMapLoading ? (
            <div
              className="map-loading-overlay"
              style={loadingThemeStyle}
              aria-live="polite"
            >
              <div className="map-loading-network" aria-hidden="true">
                <span className="map-loading-link map-loading-link-a" />
                <span className="map-loading-link map-loading-link-b" />
                <span className="map-loading-link map-loading-link-c" />
                <span className="map-loading-node map-loading-node-a" />
                <span className="map-loading-node map-loading-node-b" />
                <span className="map-loading-node map-loading-node-c" />
                <span className="map-loading-node map-loading-node-d" />
              </div>
              <div className="map-loading-spinner" aria-hidden="true" />
              <div className="map-loading-title">
                Generating Maps for {selectedTokenSymbol}...
              </div>
              <div className="map-loading-copy">
                Connecting blocks and routing transfers...
              </div>
            </div>
          ) : null}
          {infoNode && (
            <div className="map-hover-info is-active">
              <div className="map-hover-title">{infoNode.label}</div>
              <div className="map-hover-addr-full">{infoNode.id}</div>
              <div className="map-hover-row">
                <span>Share</span>
                <strong>
                  {fmtSharePct(infoNode.value, currentSupplyBase, infoNode.pct)}
                </strong>
              </div>
              <div className="map-hover-row">
                <span>Amount</span>
                <strong>
                  {infoNode.value.toLocaleString()} {activeTokenInfo.name}
                </strong>
              </div>
              <div className="map-hover-row">
                <span>Sent Tx</span>
                <strong>
                  {(infoNode.sentTransactions ?? 0).toLocaleString()}
                </strong>
              </div>
              <div className="map-hover-row">
                <span>Received Tx</span>
                <strong>
                  {(infoNode.receivedTransactions ?? 0).toLocaleString()}
                </strong>
              </div>
              <div className="map-hover-row">
                <span>Type</span>
                <strong>
                  {HOLDER_TYPES[infoNode.type]?.label || infoNode.type}
                </strong>
              </div>
            </div>
          )}
          {resolvedSelectedNode && (
            <SelectedNodeCard
              node={resolvedSelectedNode}
              copiedAddress={copiedAddress}
              onCopyAddress={handleCopyAddress}
              explorerBase={PHANTASMA_EXPLORER_BASE}
              onClose={() => setSelectedNode(null)}
              fmtSharePct={fmtSharePct}
              currentSupply={currentSupplyBase}
              fmtTokenAmount={fmtTokenAmount}
              tokenName={activeTokenInfo.name}
              fmtUsdAmount={fmtUsdAmount}
              tokenPrice={Number(activeTokenInfo.price)}
              totalTransactionCount={totalTransactionCount}
              sparklineData={selectedNodeSparkline}
              canShowConnections={canShowSelectedNodeConnections}
              onShowConnections={handleShowNodeConnections}
              onOpenTransactions={() => setIsTransfersModalOpen(true)}
            />
          )}
          <div className="map-hint">
            <span className="map-hint-text">
              Scroll to zoom · Drag to pan · Click a bubble for details
            </span>
            {mapDataStatus ? (
              <span className="map-hint-text">{mapDataStatus}</span>
            ) : null}
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
          holders={filteredNodes}
          summaryHolders={displayNodes}
          tokenInfo={activeTokenInfo}
          availableTokens={availableTokenSymbols}
          selectedTokenSymbol={selectedTokenSymbol}
          onTokenChange={setSelectedTokenSymbol}
          tokenSelectorStatus={tokenSelectorStatus}
          selectedNode={resolvedSelectedNode}
          onNodeSelect={setSelectedNode}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
          onOpenTransactions={() => setIsTransfersModalOpen(true)}
          isConnectionsView={isConnectionsView}
          onClearConnections={handleClearConnections}
          canShowConnections={canShowSelectedNodeConnections}
          onShowConnections={() =>
            handleShowNodeConnections(resolvedSelectedNode?.id)
          }
          isMobileViewport={isMobileViewport}
          colorTheme={colorTheme}
          activeLegendFilter={activeHolderTypeFilter}
          onLegendFilterChange={(typeKey) =>
            setActiveHolderTypeFilter((current) =>
              current === typeKey ? "" : typeKey,
            )
          }
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() =>
            setIsStatsCollapsed((collapsed) => !collapsed)
          }
        />
      </div>
      <TransactionsModal
        isOpen={isTransfersModalOpen}
        selectedNode={selectedNode}
        closeTransfersModal={closeTransfersModal}
        isSelectedNodeTransactionsLoading={isSelectedNodeTransactionsLoading}
        selectedNodeApiTransactionsError={selectedNodeApiTransactionsError}
        exportMenuRef={exportMenuRef}
        isExportMenuOpen={isExportMenuOpen}
        setIsExportMenuOpen={setIsExportMenuOpen}
        exportTransactions={exportTransactions}
        resetAllTransactionFilters={resetAllTransactionFilters}
        dirFilterRef={dirFilterRef}
        counterpartyFilterRef={counterpartyFilterRef}
        timeFilterRef={timeFilterRef}
        amountFilterRef={amountFilterRef}
        usdFilterRef={usdFilterRef}
        activeTransactionFilter={activeTransactionFilter}
        setActiveTransactionFilter={setActiveTransactionFilter}
        hasDirFilter={hasDirFilter}
        hasCounterpartyFilter={hasCounterpartyFilter}
        hasTimeFilter={hasTimeFilter}
        hasAmountFilter={hasAmountFilter}
        hasUsdFilter={hasUsdFilter}
        transactionDirFilter={transactionDirFilter}
        setTransactionDirFilter={setTransactionDirFilter}
        transactionCounterpartyFilter={transactionCounterpartyFilter}
        setTransactionCounterpartyFilter={setTransactionCounterpartyFilter}
        transactionStartTime={transactionStartTime}
        setTransactionStartTime={setTransactionStartTime}
        transactionEndTime={transactionEndTime}
        setTransactionEndTime={setTransactionEndTime}
        transactionMinAmount={transactionMinAmount}
        setTransactionMinAmount={setTransactionMinAmount}
        transactionMaxAmount={transactionMaxAmount}
        setTransactionMaxAmount={setTransactionMaxAmount}
        transactionMinUsd={transactionMinUsd}
        setTransactionMinUsd={setTransactionMinUsd}
        transactionMaxUsd={transactionMaxUsd}
        setTransactionMaxUsd={setTransactionMaxUsd}
        transactionSortBy={transactionSortBy}
        transactionSortDirection={transactionSortDirection}
        handleTransactionSortToggle={handleTransactionSortToggle}
        filteredTransactions={filteredTransactions}
        pagedTransactions={pagedTransactions}
        nodeById={nodeById}
        setSelectedNode={setSelectedNode}
        handleCopyAddress={handleCopyAddress}
        copiedAddress={copiedAddress}
        explorerBase={PHANTASMA_EXPLORER_BASE}
        fmtTokenAmount={fmtTokenAmount}
        fmtUsdAmount={fmtUsdAmount}
        handleCopyTransactionHash={handleCopyTransactionHash}
        copiedTxHash={copiedTxHash}
        txExplorerBase={PHANTASMA_TX_EXPLORER_BASE}
        transactionPageCount={transactionPageCount}
        setTransactionPage={setTransactionPage}
        transactionPage={transactionPage}
        totalTransactionCount={totalTransactionCount}
      />
    </div>
  );
}
