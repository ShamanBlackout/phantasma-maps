import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import TransactionsModal from "./components/TransactionsModal";
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
  fetchConnectionsForAddress as fetchConnectionsForAddressFromApi,
  fetchTopHolders as fetchTopHoldersFromApi,
  fetchTransactionsPageForAddress as fetchTransactionsPageForAddressFromApi,
} from "./api/mapsApi";
import {
  HOLDER_TYPES,
  MOCK_TOKEN_DATA_BY_SYMBOL,
  MOCK_TOKEN_SYMBOLS,
  TOKEN_INFO,
} from "./data/mockData";
import "./App.css";
import "./styles/feature-polish.css";
import "./styles/ux-improvements.css";
import "./styles/onboarding.css";

const STATS_PANEL_STORAGE_KEY = "phantasma-maps:stats-panel-collapsed";
const USER_SKILL_LEVEL_KEY = "phantasma-maps:skill-level";
const DISCOVERY_HINTS_DISMISSED_KEY =
  "phantasma-maps:discovery-hints-dismissed";
const COLOR_THEME_STORAGE_KEY = "phantasma-maps:color-theme";
const TOKEN_SYMBOL_STORAGE_KEY = "phantasma-maps:selected-token-symbol";
const DENSITY_MODE_STORAGE_KEY = "phantasma-maps:density-mode";
const ONBOARDING_DISMISSED_STORAGE_KEY = "phantasma-maps:onboarding-dismissed";
const FOCUS_MODE_STORAGE_KEY = "phantasma-maps:focus-mode";
const SAVED_VIEWS_STORAGE_KEY = "phantasma-maps:saved-views";
const TOKEN_SNAPSHOTS_STORAGE_KEY = "phantasma-maps:token-snapshots";
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
const ALLOWED_COLOR_THEMES = new Set([
  "dark",
  "light",
  "ghost-blue",
  "kcal-red",
]);

const ONBOARDING_TUTORIAL_STEPS = [
  {
    title: "Search Bar",
    detail:
      "Use the top search to find a wallet address or holder label. Address searches re-center the map around that wallet, while text searches filter visible nodes.",
    tip: "Shortcut: press / to focus search instantly.",
    target: "search",
  },
  {
    title: "Graph Settings",
    detail:
      "Click the gear icon to open Display & Map Settings. This is where you control theme, density, focus mode, physics, labels, and graph limits.",
    tip: "If the graph feels heavy, lower visible wallets/connections.",
    target: "settings",
  },
  {
    title: "Theme & Density Buttons",
    detail:
      "Theme changes the visual style. Density switches between Comfortable and Compact spacing, especially useful on smaller screens.",
    tip: "Try Compact when comparing many stats at once.",
    target: "settings",
  },
  {
    title: "Focus Mode Toggle",
    detail:
      "Focus Mode hides secondary UI clutter so you can concentrate on graph exploration and selection analysis.",
    tip: "Toggle with keyboard shortcut: F.",
    target: "settings",
  },
  {
    title: "Command Button",
    detail:
      "The Command button opens quick actions like Saved Views, Compare, Trace Path, Diagnostics, and export helpers from one menu.",
    tip: "Shortcut: Ctrl+K.",
    target: "command",
  },
  {
    title: "Saved Views",
    detail:
      "Saved Views stores your current analysis state so you can return to the same token, filters, and perspective later.",
    tip: "Great for repeating weekly analysis.",
    target: "views",
  },
  {
    title: "Compare Mode",
    detail:
      "Compare mode lets you line up two token snapshots side-by-side and inspect wallet count, links, concentration, and top holder share.",
    tip: "Use it to spot distribution differences quickly.",
    target: "compare",
  },
  {
    title: "Trace Path",
    detail:
      "Trace Path highlights the shortest relationship path between two wallets so you can understand how value can move across the graph.",
    tip: "Useful for investigating wallet clusters.",
    target: "trace",
  },
  {
    title: "Diagnostics",
    detail:
      "Diagnostics shows source health, sync information, and status details when loading or API behavior needs deeper inspection.",
    tip: "Check this panel first if something looks out of date.",
    target: "diagnostics",
  },
  {
    title: "Click a Node Now",
    detail:
      "Try clicking any bubble on the map. Selecting a node opens its holder details in the right panel and enables connection and transfer actions.",
    tip: "Nodes are fully interactive during this tour — go ahead and click one.",
    target: "map",
  },
  {
    title: "Selected Node Card",
    detail:
      "After clicking a node the right panel shows wallet address, balance, share percentage, and a sparkline. From here you can open Transfers, Show Connections, or copy the address.",
    tip: "Use Show Connections to refocus the entire graph around that wallet.",
    target: "selected-node",
  },
  {
    title: "You Can Replay This Anytime",
    detail:
      "Open the gear settings menu and click Replay Tutorial to run this walkthrough again whenever you need a refresher.",
    tip: "You are ready to explore the map.",
    target: "settings",
  },
];

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
const MAPS_API_GRAPH_DEPTH = parseEnvInt("REACT_APP_MAPS_API_GRAPH_DEPTH", 2);
const MAPS_API_GRAPH_EDGE_LIMIT = parseEnvInt(
  "REACT_APP_MAPS_API_GRAPH_EDGE_LIMIT",
  1200,
);
const MAPS_API_GRAPH_NODE_LIMIT = parseEnvInt(
  "REACT_APP_MAPS_API_GRAPH_NODE_LIMIT",
  300,
);
const MAPS_API_GRAPH_TOP_HOLDERS_LIMIT = parseEnvInt(
  "REACT_APP_MAPS_API_GRAPH_TOP_HOLDERS_LIMIT",
  100,
);
const MAPS_API_REQUEST_TIMEOUT_MS = parseEnvMs(
  "REACT_APP_MAPS_API_REQUEST_TIMEOUT_MS",
  45000,
);
const MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS = parseEnvMs(
  "REACT_APP_MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS",
  30000,
);
const TOKEN_METADATA_POLL_INTERVAL_MS = parseEnvMs(
  "REACT_APP_TOKEN_METADATA_POLL_INTERVAL_MS",
  60000,
);
const MAP_LOADING_MIN_VISIBLE_MS = 480;
const MAP_LOADING_COMPLETE_HOLD_MS = 120;
const MAP_LOADING_EXIT_MS = 190;
const MAP_LOADING_STAGE_BALANCES_MAX = 35;
const MAP_LOADING_STAGE_ADDRESSES_MAX = 70;
const MAP_LOADING_PHASE_MIN_VISIBLE_MS = 280;
const MAP_LOADING_SLOW_THRESHOLD_MS = 3500;
const MAP_LOADING_STALLED_THRESHOLD_MS = 8000;
const MAP_LOADING_SMALL_GRAPH_NODE_THRESHOLD = 80;
const MAP_LOADING_SMALL_GRAPH_LINK_THRESHOLD = 160;
const MAP_LOADING_LARGE_GRAPH_NODE_THRESHOLD = 700;
const MAP_LOADING_LARGE_GRAPH_LINK_THRESHOLD = 1400;

function resolveMapLoadingProfile(nodeCount, linkCount) {
  const safeNodeCount = Number.isFinite(Number(nodeCount))
    ? Number(nodeCount)
    : 0;
  const safeLinkCount = Number.isFinite(Number(linkCount))
    ? Number(linkCount)
    : 0;

  if (
    safeNodeCount <= MAP_LOADING_SMALL_GRAPH_NODE_THRESHOLD &&
    safeLinkCount <= MAP_LOADING_SMALL_GRAPH_LINK_THRESHOLD
  ) {
    return {
      balancesMax: 55,
      addressesMax: 55,
      showAddressPhase: false,
      minVisibleMs: 340,
      phaseMinVisibleMs: 210,
      label: "small",
    };
  }

  if (
    safeNodeCount >= MAP_LOADING_LARGE_GRAPH_NODE_THRESHOLD ||
    safeLinkCount >= MAP_LOADING_LARGE_GRAPH_LINK_THRESHOLD
  ) {
    return {
      balancesMax: 35,
      addressesMax: 72,
      showAddressPhase: true,
      minVisibleMs: 620,
      phaseMinVisibleMs: 340,
      label: "large",
    };
  }

  return {
    balancesMax: MAP_LOADING_STAGE_BALANCES_MAX,
    addressesMax: MAP_LOADING_STAGE_ADDRESSES_MAX,
    showAddressPhase: true,
    minVisibleMs: MAP_LOADING_MIN_VISIBLE_MS,
    phaseMinVisibleMs: MAP_LOADING_PHASE_MIN_VISIBLE_MS,
    label: "standard",
  };
}

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

function formatApiErrorMeta(errorLike) {
  if (!errorLike || typeof errorLike !== "object") return "";

  const parts = [];
  const code = String(errorLike.errorCode || errorLike.code || "").trim();
  const requestId = String(errorLike.requestId || "").trim();
  const status = Number(errorLike.status);

  if (code) {
    parts.push(`code ${code}`);
  }

  if (Number.isFinite(status) && status > 0) {
    parts.push(`status ${status}`);
  }

  if (requestId) {
    parts.push(`request ${requestId}`);
  }

  return parts.length ? ` [${parts.join(", ")}]` : "";
}

function buildApiErrorRecord(errorLike, source, fallbackMessage) {
  const safeError = errorLike && typeof errorLike === "object" ? errorLike : {};
  const status = Number(safeError.status);
  const code = String(safeError.errorCode || safeError.code || "").trim();
  const requestId = String(safeError.requestId || "").trim();
  const message = String(
    safeError.errorMessage ||
      safeError.message ||
      fallbackMessage ||
      "API request failed",
  ).trim();

  return {
    source: String(source || "unknown"),
    status: Number.isFinite(status) ? status : null,
    code: code || null,
    requestId: requestId || null,
    message,
    recordedAt: Date.now(),
  };
}

function getLinkEndpointId(endpoint) {
  if (endpoint && typeof endpoint === "object") {
    return String(endpoint.id || "").trim();
  }

  return String(endpoint || "").trim();
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

function getLinkKey(source, target) {
  return `${String(source || "").trim()}->${String(target || "").trim()}`;
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function rowsToCsv(headers, rows) {
  const lines = [headers, ...rows]
    .map((line) => line.map((value) => escapeCsvCell(value)).join(","))
    .join("\n");
  return `\uFEFF${lines}`;
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
        transactionCount: stats.sentTransactions + stats.receivedTransactions,
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

function buildTokenSnapshot(tokenSymbol, nodes, links, currentSupplyBase) {
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const normalizedLinks = Array.isArray(links) ? links : [];
  const topWallet = normalizedNodes.length
    ? normalizedNodes.reduce((best, holder) =>
        Number(holder?.value || 0) > Number(best?.value || 0) ? holder : best,
      )
    : null;
  const topWalletShare =
    currentSupplyBase > 0 && topWallet
      ? (Number(topWallet.value || 0) / currentSupplyBase) * 100
      : Number(topWallet?.pct || 0);
  const topTenTotal = normalizedNodes
    .slice()
    .sort((a, b) => Number(b?.value || 0) - Number(a?.value || 0))
    .slice(0, 10)
    .reduce((sum, holder) => sum + Number(holder?.value || 0), 0);
  const concentrationTop10 =
    currentSupplyBase > 0 ? (topTenTotal / currentSupplyBase) * 100 : 0;
  const topWalletLabel = topWallet
    ? topWallet.shortAddr ||
      topWallet.label ||
      shortenAddress(topWallet.id || topWallet.address || "")
    : "N/A";

  return {
    token: tokenSymbol,
    wallets: normalizedNodes.length,
    links: normalizedLinks.length,
    top10: Number(concentrationTop10 || 0),
    topWalletLabel,
    topWalletShare: Number(topWalletShare || 0),
    recordedAt: Date.now(),
  };
}

function normalizeTokenSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const wallets = Number(snapshot.wallets ?? snapshot.visibleWallets ?? 0);
  const links = Number(snapshot.links ?? snapshot.visibleLinks ?? 0);
  const { visibleWallets, visibleLinks, ...rest } = snapshot;

  return {
    ...rest,
    wallets: Number.isFinite(wallets) && wallets >= 0 ? wallets : 0,
    links: Number.isFinite(links) && links >= 0 ? links : 0,
  };
}

function getSnapshotWalletCount(snapshot) {
  return Number(snapshot?.wallets ?? snapshot?.visibleWallets ?? 0);
}

function getSnapshotLinkCount(snapshot) {
  return Number(snapshot?.links ?? snapshot?.visibleLinks ?? 0);
}

async function fetchTokenSnapshot(baseUrl, timeoutMs, tokenSymbol) {
  const normalizedTokenSymbol = String(tokenSymbol || "").trim();
  if (!normalizedTokenSymbol) {
    return {
      snapshot: null,
      fallbackUsed: false,
    };
  }

  const metadataResult = await fetchJsonWithTimeout(
    buildTokenInfoEndpoint(baseUrl, normalizedTokenSymbol),
    {},
    timeoutMs,
  );
  const graphResult = await fetchJsonWithTimeout(
    buildGraphEndpoint(baseUrl, normalizedTokenSymbol, {
      rootAddress: "",
      depth: MAPS_API_GRAPH_DEPTH,
      edgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
      defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
      topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
    }),
    {},
    timeoutMs,
  );

  const metadataSupply = Number(
    metadataResult.payload?.currentSupplyNormalized ??
      metadataResult.payload?.current_supply_normalized,
  );

  if (graphResult.ok) {
    const graphDecimals = Number(metadataResult.payload?.decimals ?? 0) || 0;
    const mappedGraph = buildGraphDataFromApi(
      graphResult.payload,
      graphDecimals,
    );
    const resolvedSupplyBase =
      (Number.isFinite(metadataSupply) && metadataSupply > 0
        ? metadataSupply
        : 0) ||
      Number(mappedGraph?.totalSupply) ||
      Number(mappedGraph?.totalValue) ||
      0;

    if (mappedGraph?.nodes?.length) {
      return {
        snapshot: buildTokenSnapshot(
          normalizedTokenSymbol,
          mappedGraph.nodes,
          mappedGraph.links,
          resolvedSupplyBase,
        ),
        fallbackUsed: false,
      };
    }
  }

  const fallbackMockToken = getMockTokenData(normalizedTokenSymbol);
  if (fallbackMockToken?.holders?.length) {
    return {
      snapshot: buildTokenSnapshot(
        normalizedTokenSymbol,
        fallbackMockToken.holders,
        fallbackMockToken.links,
        Number(fallbackMockToken.tokenInfo?.currentSupply) ||
          Number(fallbackMockToken.tokenInfo?.totalSupply) ||
          0,
      ),
      fallbackUsed: true,
    };
  }

  return {
    snapshot: null,
    fallbackUsed: false,
  };
}

function buildTopHoldersGraph(graphData, holderLimit = 10) {
  const safeNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const safeLinks = Array.isArray(graphData?.links) ? graphData.links : [];

  if (!safeNodes.length) {
    return null;
  }

  const normalizedLimit = normalizePositiveInteger(holderLimit, 10);
  const topHolderNodes = safeNodes
    .slice()
    .sort((left, right) => Number(right?.value || 0) - Number(left?.value || 0))
    .slice(0, normalizedLimit);

  if (!topHolderNodes.length) {
    return null;
  }

  const seedHolderIds = new Set(topHolderNodes.map((node) => node.id));
  const visibleNodeIds = new Set(seedHolderIds);
  const seededLinks = [];

  safeLinks.forEach((link) => {
    const source = getLinkEndpointId(link?.source);
    const target = getLinkEndpointId(link?.target);
    if (!source || !target) return;

    if (seedHolderIds.has(source) || seedHolderIds.has(target)) {
      seededLinks.push(link);
      visibleNodeIds.add(source);
      visibleNodeIds.add(target);
    }
  });

  const visibleLinks = safeLinks.filter((link) => {
    const source = getLinkEndpointId(link?.source);
    const target = getLinkEndpointId(link?.target);
    return visibleNodeIds.has(source) && visibleNodeIds.has(target);
  });
  const visibleNodes = safeNodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleTotal = visibleNodes.reduce(
    (sum, node) => sum + Number(node?.value || 0),
    0,
  );

  return {
    nodes: visibleNodes,
    links: visibleLinks.length ? visibleLinks : seededLinks,
    totalValue: visibleTotal,
    totalSupply: Number(graphData?.totalSupply || 0),
  };
}

function buildTopHoldersConnectionsGraph({
  topHolders,
  connectionsByAddress,
  fallbackGraph,
  currentSupply,
  decimals = 0,
}) {
  const holderItems = Array.isArray(topHolders) ? topHolders : [];
  const safeConnections = Array.isArray(connectionsByAddress)
    ? connectionsByAddress
    : [];
  const fallbackNodes = Array.isArray(fallbackGraph?.nodes)
    ? fallbackGraph.nodes
    : [];

  if (!holderItems.length) {
    return null;
  }

  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;
  const fallbackNodeById = new Map(
    fallbackNodes.map((node) => [String(node?.id || "").trim(), node]),
  );
  const nodeVolumeMap = new Map();
  const nodeStatsMap = new Map();
  const nodeTransactionCountMap = new Map();
  const linkMap = new Map();
  const totalSupply = Number(currentSupply) || 0;

  function ensureStats(nodeId) {
    if (!nodeStatsMap.has(nodeId)) {
      nodeStatsMap.set(nodeId, {
        sentTransactions: 0,
        receivedTransactions: 0,
      });
    }
    return nodeStatsMap.get(nodeId);
  }

  function addVolume(nodeId, value) {
    const safeValue = Number(value) || 0;
    if (safeValue <= 0) return;
    nodeVolumeMap.set(nodeId, (nodeVolumeMap.get(nodeId) || 0) + safeValue);
  }

  function addTransactionCount(nodeId, count) {
    const safeCount = Number(count) || 0;
    if (safeCount <= 0) return;
    nodeTransactionCountMap.set(
      nodeId,
      (nodeTransactionCountMap.get(nodeId) || 0) + safeCount,
    );
  }

  holderItems.forEach((item) => {
    const holderId = String(item?.address || "").trim();
    if (!holderId) return;

    const holderValue = normalizeAmount(item?.netBalance) / divisor;
    addVolume(holderId, holderValue);
    ensureStats(holderId);
  });

  safeConnections.forEach(({ address, items }) => {
    const holderId = String(address || "").trim();
    if (!holderId) return;

    const rows = Array.isArray(items) ? items : [];
    rows.forEach((entry) => {
      const counterpartyId = String(entry?.counterparty || "").trim();
      if (!counterpartyId || counterpartyId === holderId) return;

      const rawVolume = normalizeAmount(entry?.totalVolume);
      const normalizedVolume = rawVolume / divisor;
      const txCount = Math.max(
        1,
        Math.floor(Number(entry?.transactionCount) || 0),
      );
      const linkKey = `${holderId}->${counterpartyId}`;

      // Keep holder amount balance-based; connection volume should not inflate it.
      addVolume(counterpartyId, normalizedVolume);

      const holderStats = ensureStats(holderId);
      holderStats.sentTransactions += txCount;
      holderStats.receivedTransactions += txCount;
      addTransactionCount(holderId, txCount);

      const counterpartyStats = ensureStats(counterpartyId);
      counterpartyStats.sentTransactions += txCount;
      counterpartyStats.receivedTransactions += txCount;
      addTransactionCount(counterpartyId, txCount);

      const existingLink = linkMap.get(linkKey);
      if (existingLink) {
        existingLink.transactionVolume += normalizedVolume;
        existingLink.sentTransactions += txCount;
        existingLink.receivedTransactions += txCount;
      } else {
        linkMap.set(linkKey, {
          source: holderId,
          target: counterpartyId,
          transactionVolume: normalizedVolume,
          sentTransactions: txCount,
          receivedTransactions: txCount,
          transactionHash: "",
        });
      }
    });
  });

  if (!nodeVolumeMap.size) {
    return null;
  }

  const nodes = [...nodeVolumeMap.entries()]
    .map(([nodeId, fallbackValue]) => {
      const fallbackNode = fallbackNodeById.get(nodeId);
      const value = Math.max(
        Number(fallbackNode?.value || 0),
        Number(fallbackValue || 0),
      );
      const pct = totalSupply > 0 ? (value / totalSupply) * 100 : 0;
      const stats = ensureStats(nodeId);

      return {
        id: nodeId,
        label:
          String(fallbackNode?.label || "").trim() || shortenAddress(nodeId),
        shortAddr: shortenAddress(nodeId),
        value,
        pct: pct.toFixed(2),
        type: inferHolderType(nodeId, pct),
        sentTransactions: stats.sentTransactions,
        receivedTransactions: stats.receivedTransactions,
        transactionCount: nodeTransactionCountMap.get(nodeId) || 0,
      };
    })
    .sort(
      (left, right) => Number(right?.value || 0) - Number(left?.value || 0),
    );

  return {
    nodes,
    links: [...linkMap.values()],
    totalValue: nodes.reduce((sum, node) => sum + Number(node?.value || 0), 0),
    totalSupply,
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
      allowedNodeIds.has(getLinkEndpointId(link?.source)) &&
      allowedNodeIds.has(getLinkEndpointId(link?.target)),
  );

  return {
    nodes: limitedNodes,
    links: fullyLimitedLinks,
  };
}

function buildConnectionsGraphFromConnections(
  connections,
  rootAddress,
  fallbackGraph,
  currentSupply = 0,
) {
  const normalizedRoot = String(rootAddress || "").trim();
  if (!normalizedRoot || !Array.isArray(connections) || !connections.length) {
    return null;
  }

  const fallbackNodes = Array.isArray(fallbackGraph?.nodes)
    ? fallbackGraph.nodes
    : [];
  const fallbackNodeById = new Map(
    fallbackNodes.map((node) => [node.id, node]),
  );
  const nodeStats = new Map();
  const nodeTransactionCounts = new Map();

  function ensureNodeStats(nodeId) {
    if (!nodeStats.has(nodeId)) {
      nodeStats.set(nodeId, {
        sentTransactions: 0,
        receivedTransactions: 0,
      });
    }
    return nodeStats.get(nodeId);
  }

  function addNodeTransactionCount(nodeId, count) {
    const safeCount = Number(count) || 0;
    if (safeCount <= 0) return;
    nodeTransactionCounts.set(
      nodeId,
      (nodeTransactionCounts.get(nodeId) || 0) + safeCount,
    );
  }

  const links = [];
  const nodeIds = new Set([normalizedRoot]);
  let rootTransactionCount = 0;

  connections.forEach((connection) => {
    const counterparty = String(connection?.counterparty || "").trim();
    if (!counterparty || counterparty === normalizedRoot) return;

    const volume = normalizeAmount(
      connection?.totalVolume ?? connection?.total_volume,
    );
    const transactionCount = normalizePositiveInteger(
      connection?.transactionCount ?? connection?.transaction_count,
      0,
    );

    links.push({
      source: normalizedRoot,
      target: counterparty,
      transactionVolume: volume,
      sentTransactions: transactionCount,
      receivedTransactions: transactionCount,
    });

    nodeIds.add(counterparty);
    ensureNodeStats(counterparty).receivedTransactions += transactionCount;
    addNodeTransactionCount(counterparty, transactionCount);
    rootTransactionCount += transactionCount;
  });

  if (!links.length) return null;

  ensureNodeStats(normalizedRoot).sentTransactions = rootTransactionCount;
  ensureNodeStats(normalizedRoot).receivedTransactions = rootTransactionCount;
  nodeTransactionCounts.set(normalizedRoot, rootTransactionCount);

  const baseNodes = [...nodeIds].map((nodeId) => {
    const fallbackNode = fallbackNodeById.get(nodeId);
    const knownValue = Number(fallbackNode?.value);
    const value = Number.isFinite(knownValue) ? Math.max(knownValue, 0) : 0;
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
      transactionCount: nodeTransactionCounts.get(nodeId) || 0,
      isSearchRoot: nodeId === normalizedRoot,
    };
  });

  const counterpartyVisualValues = baseNodes
    .filter((node) => node.id !== normalizedRoot)
    .map((node) => Math.max(node.value || 1, 1));
  const maxCounterpartyVisual = counterpartyVisualValues.length
    ? Math.max(...counterpartyVisualValues)
    : 1;

  const emphasizedNodes = baseNodes.map((node) => {
    if (node.id === normalizedRoot) {
      return {
        ...node,
        visualValue: Math.max(node.value || 1, maxCounterpartyVisual * 2.1),
      };
    }

    return {
      ...node,
      visualValue: Math.max(node.value || 1, 1),
    };
  });

  const totalValue = emphasizedNodes.reduce(
    (sum, node) => sum + Number(node.value || 0),
    0,
  );

  return {
    nodes: emphasizedNodes,
    links,
    totalValue,
    rootNodeId: normalizedRoot,
  };
}

function mergeSummaryNodesWithTopHolders(
  summaryNodes,
  topHolders,
  decimals = 0,
) {
  const safeSummaryNodes = Array.isArray(summaryNodes) ? summaryNodes : [];
  const safeTopHolders = Array.isArray(topHolders) ? topHolders : [];

  if (!safeTopHolders.length) {
    return safeSummaryNodes;
  }

  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;
  const mergedById = new Map(
    safeSummaryNodes.map((node) => [String(node?.id || "").trim(), node]),
  );

  safeTopHolders.forEach((holder) => {
    const address = String(holder?.address || "").trim();
    if (!address) return;

    const holderValue = normalizeAmount(holder?.netBalance) / divisor;
    const existingNode = mergedById.get(address);

    if (existingNode) {
      mergedById.set(address, {
        ...existingNode,
        value: Math.max(Number(existingNode?.value || 0), holderValue),
      });
      return;
    }

    mergedById.set(address, {
      id: address,
      label: shortenAddress(address),
      shortAddr: shortenAddress(address),
      value: holderValue,
      pct: "0.00",
      type: "minor",
      sentTransactions: 0,
      receivedTransactions: 0,
    });
  });

  return [...mergedById.values()];
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
  const initialUrlParams = useMemo(() => readUrlParams(), []);
  const bubbleMapActionsRef = useRef(null);
  const commandButtonRef = useRef(null);
  const savedViewsButtonRef = useRef(null);
  const compareButtonRef = useRef(null);
  const exportPresetsButtonRef = useRef(null);
  const diagnosticsButtonRef = useRef(null);
  const traceToggleButtonRef = useRef(null);
  const savedViewsPopoutRef = useRef(null);
  const comparePopoutRef = useRef(null);
  const diagnosticsPopoutRef = useRef(null);
  const exportPresetsPopoutRef = useRef(null);
  const traceToolPanelRef = useRef(null);
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
  const [activeHolderTypeFilter, setActiveHolderTypeFilter] = useState(() =>
    String(initialUrlParams.legend || "").trim(),
  );
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
    const urlToken = initialUrlParams.tokenSymbol;
    if (urlToken) return urlToken;
    try {
      const stored = window.localStorage.getItem(TOKEN_SYMBOL_STORAGE_KEY);
      return stored || DEFAULT_MAPS_API_TOKEN_SYMBOL;
    } catch {
      return DEFAULT_MAPS_API_TOKEN_SYMBOL;
    }
  });
  const previousSelectedTokenSymbolRef = useRef(selectedTokenSymbol);
  const initialNodeIdFromUrlRef = useRef(initialUrlParams.nodeId);
  const initialRootAddressFromUrlRef = useRef(initialUrlParams.rootAddress);
  const [apiTokenSymbols, setApiTokenSymbols] = useState([]);
  const [apiTokenInfo, setApiTokenInfo] = useState(null);
  const [trackedTokenSupply, setTrackedTokenSupply] = useState(0);
  const [tokenSelectorStatus, setTokenSelectorStatus] = useState("");
  const [mapNodes, setMapNodes] = useState([]);
  const [summaryNodes, setSummaryNodes] = useState([]);
  const [mapLinks, setMapLinks] = useState([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapLoaderVisible, setIsMapLoaderVisible] = useState(false);
  const [isMapLoaderExiting, setIsMapLoaderExiting] = useState(false);
  const [isMapLoadingReadyState, setIsMapLoadingReadyState] = useState(false);
  const [isMapLoadingSlow, setIsMapLoadingSlow] = useState(false);
  const [isMapLoadingStalled, setIsMapLoadingStalled] = useState(false);
  const [mapLoadingProgress, setMapLoadingProgress] = useState(0);
  const [mapLoadingProfile, setMapLoadingProfile] = useState(() =>
    resolveMapLoadingProfile(200, 300),
  );
  const [mapLoadingEvidence, setMapLoadingEvidence] = useState({
    wallets: null,
    links: null,
  });
  const [mapLoadingDisplayedPhase, setMapLoadingDisplayedPhase] =
    useState("balances");
  const [mapDataStatus, setMapDataStatus] = useState("");
  const [isUsingMockApiFallback, setIsUsingMockApiFallback] = useState(false);
  const [lastApiError, setLastApiError] = useState(null);
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
  const [searchQuery, setSearchQuery] = useState(() =>
    String(initialUrlParams.query || "").trim(),
  );
  const [searchedRootAddress, setSearchedRootAddress] = useState(() =>
    String(initialUrlParams.rootAddress || "").trim(),
  );
  const [graphEdgeLimit, setGraphEdgeLimit] = useState(
    MAPS_API_GRAPH_EDGE_LIMIT,
  );
  const [graphNodeLimit, setGraphNodeLimit] = useState(
    MAPS_API_GRAPH_NODE_LIMIT,
  );
  const [isGraphMaxModeEnabled, setIsGraphMaxModeEnabled] = useState(false);
  const [overallMaxGraphStats, setOverallMaxGraphStats] = useState({
    wallets: 0,
    connections: 0,
  });
  const [isConnectionsView, setIsConnectionsView] = useState(
    () =>
      String(initialUrlParams.view || "token").trim() === "connections" ||
      Boolean(String(initialUrlParams.rootAddress || "").trim()),
  );
  const activeGraphRootAddress = useMemo(
    () => String(searchedRootAddress || "").trim(),
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
  const [densityMode, setDensityMode] = useState(() => {
    const urlDensity = String(initialUrlParams.density || "").trim();
    if (urlDensity === "compact" || urlDensity === "comfortable") {
      return urlDensity;
    }

    try {
      const stored = window.localStorage.getItem(DENSITY_MODE_STORAGE_KEY);
      if (stored === "compact" || stored === "comfortable") {
        return stored;
      }
    } catch {
      // Ignore storage access issues.
    }

    return "comfortable";
  });
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(() => {
    try {
      return (
        window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) !== "true"
      );
    } catch {
      return true;
    }
  });
  const [userSkillLevel, setUserSkillLevel] = useState(() => {
    try {
      const stored = window.localStorage.getItem(USER_SKILL_LEVEL_KEY);
      return stored === "power-user" ? "power-user" : "beginner";
    } catch {
      return "beginner";
    }
  });
  const [isOnboardingAt, setIsOnboardingAt] = useState("skill-selection");
  const [onboardingTutorialStep, setOnboardingTutorialStep] = useState(0);
  const [discoveryHintsDismissed, setDiscoveryHintsDismissed] = useState(() => {
    try {
      return (
        window.localStorage.getItem(DISCOVERY_HINTS_DISMISSED_KEY) === "true"
      );
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
  const [isFocusMode, setIsFocusMode] = useState(() => {
    try {
      return window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mapRefreshNonce, setMapRefreshNonce] = useState(0);
  const [activeMotionCue, setActiveMotionCue] = useState("");
  const motionCueTimerRef = useRef(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false);
  const [savedViews, setSavedViews] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [savedViewName, setSavedViewName] = useState("");
  const [physicsMode, setPhysicsMode] = useState("balanced");
  const [labelDensityMode, setLabelDensityMode] = useState("balanced");
  const [traceFromNodeId, setTraceFromNodeId] = useState("");
  const [traceToNodeId, setTraceToNodeId] = useState("");
  const [traceFromQuery, setTraceFromQuery] = useState("");
  const [traceToQuery, setTraceToQuery] = useState("");
  const [isTraceToolOpen, setIsTraceToolOpen] = useState(false);
  const [traceStatusMessage, setTraceStatusMessage] = useState("");
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isCompareModeOpen, setIsCompareModeOpen] = useState(false);
  const [compareTokenSymbol, setCompareTokenSymbol] = useState("");
  const [currentSnapshotStatus, setCurrentSnapshotStatus] = useState("");
  const [compareSnapshotStatus, setCompareSnapshotStatus] = useState("");
  const [tokenSnapshots, setTokenSnapshots] = useState(() => {
    try {
      const raw = window.localStorage.getItem(TOKEN_SNAPSHOTS_STORAGE_KEY);
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return Object.entries(parsed).reduce((acc, [token, snapshot]) => {
        const normalizedSnapshot = normalizeTokenSnapshot(snapshot);
        if (normalizedSnapshot) {
          acc[token] = normalizedSnapshot;
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  });
  const [isExportPresetsOpen, setIsExportPresetsOpen] = useState(false);
  const [isMobileInspectOpen, setIsMobileInspectOpen] = useState(false);
  const mapLoaderShownAtRef = useRef(0);
  const mapLoadingPhaseShownAtRef = useRef(0);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(DENSITY_MODE_STORAGE_KEY, densityMode);
    } catch {
      // Ignore storage access issues and keep density mode in memory.
    }
  }, [densityMode]);

  useEffect(() => {
    if (!isOnboardingVisible) {
      try {
        window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "true");
      } catch {
        // Ignore storage access issues and keep onboarding in memory.
      }
    }
  }, [isOnboardingVisible]);

  useEffect(() => {
    try {
      window.localStorage.setItem(USER_SKILL_LEVEL_KEY, userSkillLevel);
    } catch {
      // Ignore storage access issues and keep skill level in memory.
    }
  }, [userSkillLevel]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DISCOVERY_HINTS_DISMISSED_KEY,
        String(discoveryHintsDismissed),
      );
    } catch {
      // Ignore storage access issues and keep discovery state in memory.
    }
  }, [discoveryHintsDismissed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_VIEWS_STORAGE_KEY,
        JSON.stringify(savedViews),
      );
    } catch {
      // Ignore storage issues and keep views in memory.
    }
  }, [savedViews]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TOKEN_SNAPSHOTS_STORAGE_KEY,
        JSON.stringify(tokenSnapshots),
      );
    } catch {
      // Ignore storage issues and keep snapshots in memory.
    }
  }, [tokenSnapshots]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(isFocusMode));
    } catch {
      // Ignore storage access issues and keep focus mode in memory.
    }
  }, [isFocusMode]);

  const triggerMotionCue = useCallback((cue) => {
    if (!cue) return;
    if (motionCueTimerRef.current) {
      window.clearTimeout(motionCueTimerRef.current);
    }
    setActiveMotionCue(cue);
    motionCueTimerRef.current = window.setTimeout(() => {
      setActiveMotionCue("");
      motionCueTimerRef.current = null;
    }, 420);
  }, []);

  useEffect(
    () => () => {
      if (motionCueTimerRef.current) {
        window.clearTimeout(motionCueTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const urlTxDir = String(initialUrlParams.txDir || "").trim();
    const urlTxCounterparty = String(
      initialUrlParams.txCounterparty || "",
    ).trim();

    if (urlTxDir === "from" || urlTxDir === "to" || urlTxDir === "all") {
      setTransactionDirFilter(urlTxDir);
    }

    if (urlTxCounterparty) {
      setTransactionCounterpartyFilter(urlTxCounterparty);
    }
  }, [
    initialUrlParams.txCounterparty,
    initialUrlParams.txDir,
    setTransactionCounterpartyFilter,
    setTransactionDirFilter,
  ]);

  const urlStateOptions = useMemo(
    () => ({
      isConnectionsView,
      searchQuery,
      activeLegendFilter: activeHolderTypeFilter,
      densityMode,
      transactionDirFilter,
      transactionCounterpartyFilter,
    }),
    [
      activeHolderTypeFilter,
      densityMode,
      isConnectionsView,
      searchQuery,
      transactionCounterpartyFilter,
      transactionDirFilter,
    ],
  );

  useUrlState(
    selectedTokenSymbol,
    selectedNode,
    searchedRootAddress,
    urlStateOptions,
  );

  useEffect(() => {
    if (previousSelectedTokenSymbolRef.current === selectedTokenSymbol) {
      return;
    }

    previousSelectedTokenSymbolRef.current = selectedTokenSymbol;
    triggerMotionCue("token");
    setSearchQuery("");
    setSearchedRootAddress("");
    setIsConnectionsView(false);
    setActiveHolderTypeFilter("");
    setSelectedNode(null);
    setHoveredNode(null);
    setIsExportMenuOpen(false);
    setIsTransfersModalOpen(false);
    setOverallMaxGraphStats({ wallets: 0, connections: 0 });
    resetTransactionState();
  }, [resetTransactionState, selectedTokenSymbol, triggerMotionCue]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    async function fetchTokenInfo() {
      const result = await fetchJsonWithTimeout(
        buildTokenInfoEndpoint(MAPS_API_BASE_URL, selectedTokenSymbol),
        {},
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
      const hasMetadataMaxSupply =
        metadataMaxSupplyRaw !== undefined && metadataMaxSupplyRaw !== null;
      const parsedMetadataMaxSupply = Number(metadataMaxSupplyRaw);
      const parsedCurrentSupply = Number(
        payload?.currentSupplyNormalized ?? payload?.current_supply_normalized,
      );
      const parsedMetadataPrice = Number(
        payload?.priceUsd ?? payload?.price_usd ?? payload?.price,
      );
      const parsedHolderCount = Number(
        payload?.holderCount ?? payload?.holder_count,
      );
      const parsedMetadataPriceChange24h = Number(
        payload?.priceChange24h ??
          payload?.price_change_24h ??
          payload?.percentChange24h,
      );

      setApiTokenInfo({
        fullName: String(payload?.name || "").trim(),
        totalSupply: Number.isFinite(parsedCurrentSupply)
          ? parsedCurrentSupply
          : null,
        currentSupply: Number.isFinite(parsedCurrentSupply)
          ? parsedCurrentSupply
          : 0,
        maxSupply: Number.isFinite(parsedMetadataMaxSupply)
          ? parsedMetadataMaxSupply
          : null,
        hasMetadataMaxSupply,
        decimals: Number(payload?.decimals ?? 0) || 0,
        chain: String(payload?.chain || TOKEN_INFO.chain || "").trim(),
        globalHolderCount: Number.isFinite(parsedHolderCount)
          ? Math.max(0, Math.floor(parsedHolderCount))
          : null,
        price: Number.isFinite(parsedMetadataPrice)
          ? parsedMetadataPrice
          : null,
        priceChange24h: Number.isFinite(parsedMetadataPriceChange24h)
          ? parsedMetadataPriceChange24h
          : null,
      });

      if (Number.isFinite(parsedMetadataPrice)) {
        setPriceLastUpdatedAt(Date.now());
      }

      timeoutId = window.setTimeout(
        fetchTokenInfo,
        TOKEN_METADATA_POLL_INTERVAL_MS,
      );
    }

    fetchTokenInfo().catch(() => {
      if (!isMounted) return;
      setApiTokenInfo(null);
      timeoutId = window.setTimeout(
        fetchTokenInfo,
        TOKEN_METADATA_POLL_INTERVAL_MS,
      );
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
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
      setSearchedRootAddress("");
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
      triggerMotionCue("connections");
      return;
    }

    setSearchedRootAddress("");
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
    triggerMotionCue("connections");
  }

  function handleClearConnections() {
    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress("");
    setIsConnectionsView(false);
  }

  function handleRetryGraphLoad() {
    setMapRefreshNonce((current) => current + 1);
    setMapDataStatus("Retrying graph request...");
  }

  useEffect(() => {
    if (!isMobileViewport) {
      pendingMobileFitKeyRef.current = null;
      return;
    }

    const nextRootAddress = String(searchedRootAddress || "").trim();

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
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        setLastApiError(
          buildApiErrorRecord(
            result,
            "token-list",
            "API token list request failed",
          ),
        );
        setTokenSelectorStatus(
          result.status === 0
            ? `API token list unavailable${formatApiErrorMeta(result)}`
            : `API token list request failed (${result.status})${formatApiErrorMeta(result)}`,
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

    fetchAvailableTokens().catch((error) => {
      if (!isMounted) return;
      setLastApiError(
        buildApiErrorRecord(error, "token-list", "API token list unavailable"),
      );
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

    // Prefer API-sourced token metadata, then mock fallback, then defaults.
    const resolvedFullName =
      apiTokenInfo?.fullName ||
      (isUsingMockApiFallback ? fallbackTokenInfo?.fullName : null) ||
      `${selectedTokenSymbol} Token`;

    const resolvedChain = apiTokenInfo?.chain || TOKEN_INFO.chain;

    const hasMetadataMaxSupply = Boolean(apiTokenInfo?.hasMetadataMaxSupply);

    const resolvedCurrentSupply =
      (Number.isFinite(apiTokenInfo?.currentSupply)
        ? apiTokenInfo.currentSupply
        : null) ??
      ((trackedTokenSupply > 0 ? trackedTokenSupply : 0) ||
        (isUsingMockApiFallback
          ? (fallbackTokenInfo?.totalSupply ??
            (selectedTokenSymbol === TOKEN_INFO.name
              ? TOKEN_INFO.totalSupply
              : 0))
          : 0));

    const resolvedTotalSupply = resolvedCurrentSupply;
    const resolvedMaxSupply = hasMetadataMaxSupply
      ? Number.isFinite(apiTokenInfo?.maxSupply)
        ? apiTokenInfo.maxSupply
        : 0
      : null;

    const resolvedPrice = Number.isFinite(apiTokenInfo?.price)
      ? apiTokenInfo.price
      : selectedTokenSymbol === TOKEN_INFO.name
        ? liveTokenInfo.price
        : isUsingMockApiFallback
          ? (fallbackTokenInfo?.price ?? null)
          : null;

    const resolvedPriceChange24h = Number.isFinite(apiTokenInfo?.priceChange24h)
      ? apiTokenInfo.priceChange24h
      : selectedTokenSymbol === TOKEN_INFO.name
        ? liveTokenInfo.priceChange24h
        : isUsingMockApiFallback
          ? (fallbackTokenInfo?.priceChange24h ?? null)
          : null;

    return {
      name: selectedTokenSymbol,
      fullName: resolvedFullName,
      chain: resolvedChain,
      totalSupply: resolvedTotalSupply,
      currentSupply: resolvedCurrentSupply,
      maxSupply: resolvedMaxSupply,
      hasMetadataMaxSupply,
      globalHolderCount: Number.isFinite(apiTokenInfo?.globalHolderCount)
        ? apiTokenInfo.globalHolderCount
        : null,
      price: resolvedPrice,
      priceChange24h: resolvedPriceChange24h,
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
    if (!isMapLoading) return undefined;

    let timeoutId;
    const easeTarget = 92;

    function tickProgress() {
      setMapLoadingProgress((current) => {
        if (current >= easeTarget) {
          return current;
        }

        const step = Math.max(1, Math.round((easeTarget - current) * 0.09));
        return Math.min(easeTarget, current + step);
      });

      timeoutId = window.setTimeout(tickProgress, 170);
    }

    timeoutId = window.setTimeout(tickProgress, 170);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMapLoading]);

  useEffect(() => {
    if (!isMapLoading) {
      setIsMapLoadingSlow(false);
      setIsMapLoadingStalled(false);
      return undefined;
    }

    setIsMapLoadingSlow(false);
    setIsMapLoadingStalled(false);

    const slowTimerId = window.setTimeout(() => {
      setIsMapLoadingSlow(true);
    }, MAP_LOADING_SLOW_THRESHOLD_MS);
    const stalledTimerId = window.setTimeout(() => {
      setIsMapLoadingStalled(true);
    }, MAP_LOADING_STALLED_THRESHOLD_MS);

    return () => {
      window.clearTimeout(slowTimerId);
      window.clearTimeout(stalledTimerId);
    };
  }, [isMapLoading]);

  const mapLoadingPhaseTarget = useMemo(() => {
    const clampedProgress = Math.max(
      0,
      Math.min(100, Math.round(mapLoadingProgress)),
    );

    if (isMapLoadingReadyState) return "ready";
    if (clampedProgress < mapLoadingProfile.balancesMax) {
      return "balances";
    }
    if (
      mapLoadingProfile.showAddressPhase &&
      clampedProgress < mapLoadingProfile.addressesMax
    ) {
      return "addresses";
    }
    return "topology";
  }, [
    isMapLoadingReadyState,
    mapLoadingProfile.addressesMax,
    mapLoadingProfile.balancesMax,
    mapLoadingProfile.showAddressPhase,
    mapLoadingProgress,
  ]);
  useEffect(() => {
    if (!isMapLoaderVisible) {
      mapLoadingPhaseShownAtRef.current = 0;
      setMapLoadingDisplayedPhase("balances");
      return undefined;
    }

    const phaseOrder = ["balances", "addresses", "topology", "ready"];
    const currentIndex = phaseOrder.indexOf(mapLoadingDisplayedPhase);
    const targetIndex = phaseOrder.indexOf(mapLoadingPhaseTarget);

    if (targetIndex === -1 || currentIndex === -1) {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
      return undefined;
    }

    if (targetIndex <= currentIndex) {
      if (targetIndex < currentIndex) {
        setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
        mapLoadingPhaseShownAtRef.current = Date.now();
      }
      return undefined;
    }

    const now = Date.now();
    const shownAt = mapLoadingPhaseShownAtRef.current || now;
    if (!mapLoadingPhaseShownAtRef.current) {
      mapLoadingPhaseShownAtRef.current = now;
    }
    const elapsedMs = now - shownAt;
    const waitMs = Math.max(0, mapLoadingProfile.phaseMinVisibleMs - elapsedMs);

    if (waitMs === 0) {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
    }, waitMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isMapLoaderVisible,
    mapLoadingDisplayedPhase,
    mapLoadingPhaseTarget,
    mapLoadingProfile.phaseMinVisibleMs,
  ]);

  useEffect(() => {
    let delayTimeoutId;
    let holdTimeoutId;
    let hideTimeoutId;

    if (isMapLoading) {
      mapLoaderShownAtRef.current = Date.now();
      mapLoadingPhaseShownAtRef.current = Date.now();
      setIsMapLoadingReadyState(false);
      setIsMapLoaderExiting(false);
      setIsMapLoaderVisible(true);
      return undefined;
    }

    if (!isMapLoaderVisible) {
      return undefined;
    }

    const elapsedMs = Date.now() - mapLoaderShownAtRef.current;
    const remainingMinVisibleMs = Math.max(
      0,
      mapLoadingProfile.minVisibleMs - elapsedMs,
    );

    delayTimeoutId = window.setTimeout(() => {
      setMapLoadingProgress(100);
      setIsMapLoadingReadyState(true);
      holdTimeoutId = window.setTimeout(() => {
        setIsMapLoaderExiting(true);
        hideTimeoutId = window.setTimeout(() => {
          setIsMapLoaderVisible(false);
          setIsMapLoaderExiting(false);
          setIsMapLoadingReadyState(false);
          setMapLoadingProgress(0);
          setMapLoadingEvidence({ wallets: null, links: null });
        }, MAP_LOADING_EXIT_MS);
      }, MAP_LOADING_COMPLETE_HOLD_MS);
    }, remainingMinVisibleMs);

    return () => {
      if (delayTimeoutId) window.clearTimeout(delayTimeoutId);
      if (holdTimeoutId) window.clearTimeout(holdTimeoutId);
      if (hideTimeoutId) window.clearTimeout(hideTimeoutId);
    };
  }, [isMapLoaderVisible, isMapLoading, mapLoadingProfile.minVisibleMs]);

  useEffect(() => {
    let isMounted = true;

    async function fetchMapGraph() {
      const defaultLoadingProfile = resolveMapLoadingProfile(200, 300);
      setIsMapLoading(true);
      setIsMapLoadingReadyState(false);
      setMapLoadingProgress(8);
      setMapLoadingProfile(defaultLoadingProfile);
      setMapLoadingEvidence({ wallets: null, links: null });
      setMapLoadingDisplayedPhase("balances");
      setSelectedNode(null);
      setHoveredNode(null);
      setMapDataStatus(
        activeGraphRootAddress
          ? `Generating maps for ${selectedTokenSymbol} around ${shortenAddress(activeGraphRootAddress)}...`
          : `Generating maps for ${selectedTokenSymbol}...`,
      );

      const effectiveGraphEdgeLimit = graphEdgeLimit;
      const isTopLevelTokenRequest =
        !isConnectionsView &&
        !String(searchedRootAddress || "").trim() &&
        !String(activeGraphRootAddress || "").trim();
      const shouldUseMaxEndpoint =
        isTopLevelTokenRequest && isGraphMaxModeEnabled;

      const graphEndpoint = buildGraphEndpoint(
        MAPS_API_BASE_URL,
        selectedTokenSymbol,
        {
          rootAddress: activeGraphRootAddress || "",
          depth: MAPS_API_GRAPH_DEPTH,
          edgeLimit: effectiveGraphEdgeLimit,
          defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
          useMaxEndpoint: shouldUseMaxEndpoint,
          topHoldersLimit: shouldUseMaxEndpoint
            ? MAPS_API_GRAPH_TOP_HOLDERS_LIMIT
            : 0,
        },
      );
      let result = await fetchJsonWithTimeout(
        graphEndpoint,
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!result.ok && shouldUseMaxEndpoint) {
        const standardGraphFallbackEndpoint = buildGraphEndpoint(
          MAPS_API_BASE_URL,
          selectedTokenSymbol,
          {
            rootAddress: "",
            depth: MAPS_API_GRAPH_DEPTH,
            edgeLimit: effectiveGraphEdgeLimit,
            defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
            useMaxEndpoint: false,
            topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          },
        );

        const standardGraphFallbackResult = await fetchJsonWithTimeout(
          standardGraphFallbackEndpoint,
          {},
          MAPS_API_REQUEST_TIMEOUT_MS,
        );

        if (standardGraphFallbackResult.ok) {
          result = standardGraphFallbackResult;
          setMapDataStatus(
            `Max graph view is temporarily unavailable. Showing the standard ${selectedTokenSymbol} live map instead.`,
          );
        }
      }

      setMapLoadingProgress(42);

      if (!isMounted) return;

      if (!result.ok) {
        setLastApiError(
          buildApiErrorRecord(result, "graph", "Graph request failed"),
        );
        if (isConnectionsView && activeGraphRootAddress) {
          try {
            const connectionsResult = await fetchConnectionsForAddressFromApi(
              MAPS_API_BASE_URL,
              MAPS_API_REQUEST_TIMEOUT_MS,
              activeGraphRootAddress,
              selectedTokenSymbol,
            );

            let balanceFallbackGraph = null;
            const tokenGraphFallbackEndpoint = buildGraphEndpoint(
              MAPS_API_BASE_URL,
              selectedTokenSymbol,
              {
                rootAddress: "",
                depth: MAPS_API_GRAPH_DEPTH,
                edgeLimit: effectiveGraphEdgeLimit,
                defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
                topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
              },
            );
            const tokenGraphFallbackResult = await fetchJsonWithTimeout(
              tokenGraphFallbackEndpoint,
              {},
              MAPS_API_REQUEST_TIMEOUT_MS,
            );

            if (tokenGraphFallbackResult.ok) {
              const graphDecimals = apiTokenInfo?.decimals ?? 0;
              balanceFallbackGraph = buildGraphDataFromApi(
                tokenGraphFallbackResult.payload,
                graphDecimals,
              );
            }

            if (!isMounted) return;

            const tableFocusedGraph = buildConnectionsGraphFromConnections(
              connectionsResult.items,
              activeGraphRootAddress,
              balanceFallbackGraph,
              Number(balanceFallbackGraph?.totalSupply) ||
                Number(activeTokenInfo?.currentSupply) ||
                Number(activeTokenInfo?.totalSupply) ||
                0,
            );

            if (
              tableFocusedGraph &&
              Array.isArray(tableFocusedGraph.nodes) &&
              tableFocusedGraph.nodes.length
            ) {
              setMapLoadingEvidence({
                wallets: tableFocusedGraph.nodes.length,
                links: Array.isArray(tableFocusedGraph.links)
                  ? tableFocusedGraph.links.length
                  : 0,
              });
              setIsUsingMockApiFallback(false);
              setMapNodes(tableFocusedGraph.nodes);
              setSummaryNodes(tableFocusedGraph.nodes);
              setMapLinks(tableFocusedGraph.links);
              setTrackedTokenSupply(tableFocusedGraph.totalValue || 0);

              if (tableFocusedGraph.rootNodeId) {
                const focusedRootNode = tableFocusedGraph.nodes.find(
                  (node) => node.id === tableFocusedGraph.rootNodeId,
                );
                setSelectedNode(focusedRootNode || null);
              }

              setMapDataStatus(
                `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:table-only]`,
              );
              setMapLoadingProgress(100);
              setIsMapLoading(false);
              return;
            }
          } catch {
            // Fall through to status handling below.
          }
        }

        if (activeGraphRootAddress && !isConnectionsView) {
          try {
            const tokenGraphFallbackEndpoint = buildGraphEndpoint(
              MAPS_API_BASE_URL,
              selectedTokenSymbol,
              {
                rootAddress: "",
                depth: MAPS_API_GRAPH_DEPTH,
                edgeLimit: effectiveGraphEdgeLimit,
                defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
                topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
              },
            );
            const tokenGraphFallbackResult = await fetchJsonWithTimeout(
              tokenGraphFallbackEndpoint,
              {},
              MAPS_API_REQUEST_TIMEOUT_MS,
            );

            if (tokenGraphFallbackResult.ok) {
              const graphDecimals = apiTokenInfo?.decimals ?? 0;
              const fallbackGraph = buildGraphDataFromApi(
                tokenGraphFallbackResult.payload,
                graphDecimals,
              );
              const focusedFallbackGraph = buildNeighborFocusedGraph(
                fallbackGraph,
                activeGraphRootAddress,
              );

              if (
                focusedFallbackGraph &&
                Array.isArray(focusedFallbackGraph.nodes) &&
                focusedFallbackGraph.nodes.length
              ) {
                if (!isMounted) return;

                setIsUsingMockApiFallback(false);
                setTrackedTokenSupply(
                  Number(fallbackGraph?.totalSupply) ||
                    Number(focusedFallbackGraph.totalValue) ||
                    0,
                );
                setMapNodes(focusedFallbackGraph.nodes);
                setSummaryNodes(focusedFallbackGraph.nodes);
                setMapLinks(focusedFallbackGraph.links || []);
                setMapLoadingEvidence({
                  wallets: focusedFallbackGraph.nodes.length,
                  links: Array.isArray(focusedFallbackGraph.links)
                    ? focusedFallbackGraph.links.length
                    : 0,
                });

                if (focusedFallbackGraph.rootNodeId) {
                  const focusedRootNode = focusedFallbackGraph.nodes.find(
                    (node) => node.id === focusedFallbackGraph.rootNodeId,
                  );
                  setSelectedNode(focusedRootNode || null);
                }

                setMapDataStatus(
                  `This wallet's detailed graph is temporarily unavailable. Showing related wallets from the ${selectedTokenSymbol} token network around ${shortenAddress(activeGraphRootAddress)} instead.`,
                );
                setMapLoadingProgress(100);
                setIsMapLoading(false);
                return;
              }
            }
          } catch {
            // Fall through to status handling below.
          }
        }

        if (result.status === 0) {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus(
              `Unable to load wallet connections right now. Please check your network and try again.${formatApiErrorMeta(result)}`,
            );
            setMapLoadingEvidence({ wallets: null, links: null });
          } else {
            setIsUsingMockApiFallback(true);
            setTrackedTokenSupply(
              selectedMockTokenData?.tokenInfo?.totalSupply || 0,
            );
            const fallbackNodes = selectedMockTokenData?.holders || [];
            const fallbackLinks = selectedMockTokenData?.links || [];
            setMapNodes(fallbackNodes);
            setSummaryNodes(fallbackNodes);
            setMapLinks(fallbackLinks);
            setMapLoadingEvidence({
              wallets: fallbackNodes.length,
              links: fallbackLinks.length,
            });
            setTokenSelectorStatus("API unavailable; showing mock tokens");
            setMapDataStatus(
              `Using cached data while the network service recovers...${formatApiErrorMeta(result)}`,
            );
          }
        } else {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus(
              `Couldn't load wallet connections (error ${result.status}). Try again or explore the token map.${formatApiErrorMeta(result)}`,
            );
          } else {
            setIsUsingMockApiFallback(false);
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setSummaryNodes([]);
            setMapLinks([]);
            setMapDataStatus(
              `Network service temporarily unavailable (error ${result.status}). Retrying...${formatApiErrorMeta(result)}`,
            );
          }
        }
        setIsMapLoading(false);
        return;
      }

      setIsUsingMockApiFallback(false);
      setMapLoadingProgress(62);

      const graphDecimals = apiTokenInfo?.decimals ?? 0;
      const mappedGraph = buildGraphDataFromApi(result.payload, graphDecimals);
      setMapLoadingProfile(
        resolveMapLoadingProfile(
          Array.isArray(mappedGraph?.nodes) ? mappedGraph.nodes.length : 0,
          Array.isArray(mappedGraph?.links) ? mappedGraph.links.length : 0,
        ),
      );
      setMapLoadingEvidence({
        wallets: Array.isArray(mappedGraph?.nodes)
          ? mappedGraph.nodes.length
          : 0,
        links: Array.isArray(mappedGraph?.links) ? mappedGraph.links.length : 0,
      });

      const isTopLevelTokenGraph = isTopLevelTokenRequest;

      const shouldFetchTopHolders =
        isTopLevelTokenGraph &&
        !isGraphMaxModeEnabled &&
        MAPS_API_GRAPH_TOP_HOLDERS_LIMIT > 0;

      const shouldApplyTopHoldersSeed = shouldFetchTopHolders;

      let seededGraph = null;
      let topHoldersForSummary = [];

      if (shouldFetchTopHolders) {
        try {
          const topHoldersResult = await fetchTopHoldersFromApi(
            MAPS_API_BASE_URL,
            MAPS_API_REQUEST_TIMEOUT_MS,
            selectedTokenSymbol,
            MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          );
          topHoldersForSummary = Array.isArray(topHoldersResult.items)
            ? topHoldersResult.items
            : [];

          if (shouldApplyTopHoldersSeed) {
            const topHolderAddresses = topHoldersResult.items
              .map((item) => String(item?.address || "").trim())
              .filter(Boolean);

            const connectionPayloads = await Promise.all(
              topHolderAddresses.map(async (address) => {
                try {
                  const result = await fetchConnectionsForAddressFromApi(
                    MAPS_API_BASE_URL,
                    MAPS_API_REQUEST_TIMEOUT_MS,
                    address,
                    selectedTokenSymbol,
                  );

                  return {
                    address,
                    items: result.items,
                  };
                } catch {
                  return {
                    address,
                    items: [],
                  };
                }
              }),
            );

            const topHolderConnectionsGraph = buildTopHoldersConnectionsGraph({
              topHolders: topHoldersResult.items,
              connectionsByAddress: connectionPayloads,
              fallbackGraph: mappedGraph,
              currentSupply: mappedGraph?.totalSupply || 0,
              decimals: graphDecimals,
            });

            if (shouldApplyTopHoldersSeed) {
              seededGraph = topHolderConnectionsGraph;
            }
          }
        } catch {
          seededGraph = null;
        }

        if (!seededGraph && shouldApplyTopHoldersSeed) {
          seededGraph = buildTopHoldersGraph(
            mappedGraph,
            MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          );
        }
      }

      const baseGraph = seededGraph || mappedGraph;
      const baseFocusedGraph = isConnectionsView
        ? baseGraph
        : searchedRootAddress
          ? buildNeighborFocusedGraph(baseGraph, activeGraphRootAddress)
          : baseGraph;
      let focusedGraph = baseFocusedGraph;
      let usedConnectionsTable = false;

      if (isConnectionsView && activeGraphRootAddress) {
        try {
          setMapLoadingProgress(74);
          const connectionsResult = await fetchConnectionsForAddressFromApi(
            MAPS_API_BASE_URL,
            MAPS_API_REQUEST_TIMEOUT_MS,
            activeGraphRootAddress,
            selectedTokenSymbol,
          );

          setMapLoadingProgress(84);

          if (!isMounted) return;

          const tableFocusedGraph = buildConnectionsGraphFromConnections(
            connectionsResult.items,
            activeGraphRootAddress,
            mappedGraph,
            mappedGraph?.totalSupply || 0,
          );

          if (
            tableFocusedGraph &&
            Array.isArray(tableFocusedGraph.nodes) &&
            tableFocusedGraph.nodes.length
          ) {
            focusedGraph = tableFocusedGraph;
            usedConnectionsTable = true;
          }
        } catch {
          // Fall back to the base graph if precomputed connections are unavailable.
        }
      }

      if (!focusedGraph) {
        if (
          !mappedGraph ||
          !mappedGraph.nodes.length ||
          !mappedGraph.links.length
        ) {
          if (isConnectionsView) {
            setMapDataStatus(
              "No transaction history found for this wallet in the current time range.",
            );
          } else {
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setSummaryNodes([]);
            setMapLinks([]);
            setMapDataStatus(
              "No holder data available for this token. It may be newly added.",
            );
          }
          setIsMapLoading(false);
          return;
        }

        focusedGraph = baseFocusedGraph;
      }

      if (!focusedGraph || !focusedGraph.nodes.length) {
        if (isConnectionsView) {
          setMapDataStatus(
            "This wallet address wasn't found in the current token holder list.",
          );
        } else {
          setTrackedTokenSupply(0);
          setMapNodes([]);
          setSummaryNodes([]);
          setMapLinks([]);
          setMapDataStatus(
            "This wallet address wasn't found in the current token holder list.",
          );
        }
        setIsMapLoading(false);
        return;
      }

      const shouldTrackOverallMaxStats =
        !isConnectionsView && !String(activeGraphRootAddress || "").trim();

      const summaryBaseNodes =
        isTopLevelTokenGraph && Array.isArray(mappedGraph?.nodes)
          ? shouldApplyTopHoldersSeed
            ? [
                ...mappedGraph.nodes,
                ...(Array.isArray(baseGraph?.nodes) ? baseGraph.nodes : []),
              ]
            : mappedGraph.nodes
          : focusedGraph.nodes;

      const mergedSummaryNodes =
        shouldFetchTopHolders && Array.isArray(mappedGraph?.nodes)
          ? mergeSummaryNodesWithTopHolders(
              summaryBaseNodes,
              topHoldersForSummary,
              graphDecimals,
            )
          : summaryBaseNodes;

      const resolvedMapLinks =
        isTopLevelTokenGraph &&
        isGraphMaxModeEnabled &&
        Array.isArray(mappedGraph?.links)
          ? mappedGraph.links
          : focusedGraph.links;

      if (shouldTrackOverallMaxStats) {
        const mappedLinkCount = Array.isArray(mappedGraph?.links)
          ? mappedGraph.links.length
          : 0;
        const baseLinkCount = Array.isArray(baseGraph?.links)
          ? baseGraph.links.length
          : 0;

        setOverallMaxGraphStats({
          wallets: Array.isArray(mergedSummaryNodes)
            ? mergedSummaryNodes.length
            : 0,
          connections: Math.max(mappedLinkCount, baseLinkCount),
        });
      }

      setMapNodes(focusedGraph.nodes);
      setSummaryNodes(mergedSummaryNodes);
      setMapLinks(resolvedMapLinks);
      setMapLoadingEvidence({
        wallets: Array.isArray(mergedSummaryNodes)
          ? mergedSummaryNodes.length
          : 0,
        links: Array.isArray(resolvedMapLinks) ? resolvedMapLinks.length : 0,
      });
      setMapLoadingProgress(94);
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
            ? usedConnectionsTable
              ? `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:table]`
              : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:base]`
            : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)}`
          : `Live graph loaded from ${graphEndpoint}`,
      );
      setMapLoadingProgress(100);
      setIsMapLoading(false);
    }

    fetchMapGraph().catch(() => {
      if (!isMounted) return;
      if (isConnectionsView) {
        setIsUsingMockApiFallback(false);
        setMapDataStatus(
          "Couldn't process the wallet connections. Try selecting a different wallet.",
        );
      } else {
        setIsUsingMockApiFallback(false);
        setTrackedTokenSupply(0);
        setMapNodes([]);
        setSummaryNodes([]);
        setMapLinks([]);
        setMapDataStatus(
          "Couldn't load the token holder map. Please refresh or try another token.",
        );
      }
      setIsMapLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [
    activeGraphRootAddress,
    activeTokenInfo?.currentSupply,
    activeTokenInfo?.totalSupply,
    apiTokenInfo?.decimals,
    graphEdgeLimit,
    graphNodeLimit,
    isGraphMaxModeEnabled,
    isConnectionsView,
    searchedRootAddress,
    selectedMockTokenData,
    selectedTokenSymbol,
    mapRefreshNonce,
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
        {},
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
      } else {
        setLastApiError(
          buildApiErrorRecord(
            result,
            "sync-status",
            "Sync status request failed",
          ),
        );
      }

      timeoutId = window.setTimeout(
        fetchSyncStatus,
        MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
      );
    }

    fetchSyncStatus().catch((error) => {
      if (!isActive) return;
      setLastApiError(
        buildApiErrorRecord(error, "sync-status", "Sync status request failed"),
      );
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
  const displaySummaryNodes = useMemo(
    () =>
      applyCurrentSupplyToNodes(summaryNodes, activeTokenInfo.currentSupply),
    [summaryNodes, activeTokenInfo.currentSupply],
  );
  const shouldUseSummaryNodesForLegendScope =
    !isConnectionsView && !String(activeGraphRootAddress || "").trim();
  const legendScopeNodes = shouldUseSummaryNodesForLegendScope
    ? displaySummaryNodes
    : displayNodes;
  const maxModeScopeGraph = useMemo(() => {
    if (!activeHolderTypeFilter) {
      return {
        nodes: legendScopeNodes,
        links: mapLinks,
      };
    }

    const scopedNodes = legendScopeNodes.filter(
      (node) => String(node?.type || "minor") === activeHolderTypeFilter,
    );
    const scopedNodeIds = new Set(scopedNodes.map((node) => node.id));
    const scopedLinks = mapLinks.filter(
      (link) =>
        scopedNodeIds.has(getLinkEndpointId(link?.source)) &&
        scopedNodeIds.has(getLinkEndpointId(link?.target)),
    );

    return {
      nodes: scopedNodes,
      links: scopedLinks,
    };
  }, [activeHolderTypeFilter, legendScopeNodes, mapLinks]);

  const isTokenGraphMaxModeActive =
    isGraphMaxModeEnabled &&
    !isConnectionsView &&
    !String(activeGraphRootAddress || "").trim();
  // In max mode during normal token view, use summary nodes to show all wallets
  const maxModeNodeSource = useMemo(() => {
    if (!isTokenGraphMaxModeActive || !shouldUseSummaryNodesForLegendScope) {
      return displayNodes;
    }
    return displaySummaryNodes;
  }, [
    isTokenGraphMaxModeActive,
    shouldUseSummaryNodesForLegendScope,
    displaySummaryNodes,
    displayNodes,
  ]);

  // For max mode, gather all edges that connect nodes in the summary pool
  const maxModeLinks = useMemo(() => {
    if (!isTokenGraphMaxModeActive || !shouldUseSummaryNodesForLegendScope) {
      return mapLinks;
    }
    const maxModeNodeIds = new Set(maxModeNodeSource.map((n) => n.id));
    return mapLinks.filter(
      (link) =>
        maxModeNodeIds.has(getLinkEndpointId(link?.source)) &&
        maxModeNodeIds.has(getLinkEndpointId(link?.target)),
    );
  }, [
    isTokenGraphMaxModeActive,
    shouldUseSummaryNodesForLegendScope,
    maxModeNodeSource,
    mapLinks,
  ]);
  const effectiveGraphNodeLimit = isTokenGraphMaxModeActive
    ? maxModeNodeSource.length
    : graphNodeLimit;
  const effectiveGraphEdgeLimit = isTokenGraphMaxModeActive
    ? maxModeLinks.length
    : graphEdgeLimit;

  const limitedDisplayGraph = useMemo(
    () =>
      limitGraphForDisplay(
        isTokenGraphMaxModeActive ? maxModeNodeSource : displayNodes,
        isTokenGraphMaxModeActive ? maxModeLinks : mapLinks,
        effectiveGraphNodeLimit,
        effectiveGraphEdgeLimit,
        activeGraphRootAddress,
      ),
    [
      activeGraphRootAddress,
      displayNodes,
      effectiveGraphEdgeLimit,
      effectiveGraphNodeLimit,
      isTokenGraphMaxModeActive,
      mapLinks,
      maxModeLinks,
      maxModeNodeSource,
    ],
  );

  const legendScopedDisplayGraph = useMemo(() => {
    if (!activeHolderTypeFilter) {
      return limitedDisplayGraph;
    }

    const scopedNodes = legendScopeNodes.filter(
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
        scopedNodeIds.has(getLinkEndpointId(link?.source)) &&
        scopedNodeIds.has(getLinkEndpointId(link?.target)),
    );
    const scopedRootAddress = scopedNodeIds.has(activeGraphRootAddress)
      ? activeGraphRootAddress
      : "";

    // For legend-scoped graphs, include all edges to maximize connectivity
    // since the node set is already reduced by type filter
    return limitGraphForDisplay(
      scopedNodes,
      scopedLinks,
      effectiveGraphNodeLimit,
      scopedLinks.length || effectiveGraphEdgeLimit,
      scopedRootAddress,
    );
  }, [
    activeGraphRootAddress,
    activeHolderTypeFilter,
    legendScopeNodes,
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
      (link) =>
        ids.has(getLinkEndpointId(link.source)) &&
        ids.has(getLinkEndpointId(link.target)),
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

  function buildTraceOptionLabel(node) {
    const primaryLabel = String(
      node?.label || node?.shortAddr || node?.id || "",
    );
    const secondaryLabel = String(node?.shortAddr || node?.id || "");

    if (!secondaryLabel || secondaryLabel === primaryLabel) {
      return primaryLabel;
    }

    return `${primaryLabel} - ${secondaryLabel}`;
  }

  function buildTraceSearchOptions(query, selectedId) {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    const matchedNodes = normalizedQuery
      ? filteredNodes.filter((node) => {
          const id = String(node?.id || "").toLowerCase();
          const label = String(node?.label || "").toLowerCase();
          const shortAddr = String(node?.shortAddr || "").toLowerCase();
          return (
            id.includes(normalizedQuery) ||
            label.includes(normalizedQuery) ||
            shortAddr.includes(normalizedQuery)
          );
        })
      : filteredNodes;

    const limitedNodes = matchedNodes.slice(0, 160);
    if (!selectedId || limitedNodes.some((node) => node.id === selectedId)) {
      return limitedNodes;
    }

    const selectedNode = filteredNodes.find((node) => node.id === selectedId);
    if (!selectedNode) {
      return limitedNodes;
    }

    return [selectedNode, ...limitedNodes].slice(0, 160);
  }

  const traceFromOptions = useMemo(
    () => buildTraceSearchOptions(traceFromQuery, traceFromNodeId),
    [filteredNodes, traceFromNodeId, traceFromQuery],
  );

  const traceToOptions = useMemo(
    () => buildTraceSearchOptions(traceToQuery, traceToNodeId),
    [filteredNodes, traceToNodeId, traceToQuery],
  );

  const canShowSelectedNodeConnections = useMemo(() => {
    if (!resolvedSelectedNode?.id) return false;
    if (resolvedSelectedNode.id === activeGraphRootAddress) return false;
    return true;
  }, [activeGraphRootAddress, resolvedSelectedNode]);

  useEffect(() => {
    if (!activeHolderTypeFilter) return;
    const hasMatchingType = legendScopeNodes.some(
      (node) => String(node?.type || "minor") === activeHolderTypeFilter,
    );
    if (!hasMatchingType) {
      setActiveHolderTypeFilter("");
    }
  }, [activeHolderTypeFilter, legendScopeNodes]);

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
      } catch (error) {
        if (!isMounted) return;
        setLastApiError(
          buildApiErrorRecord(
            error,
            "transactions",
            "Transactions API unavailable",
          ),
        );
        setSelectedNodeApiTransactions([]);
        setSelectedNodeApiTransactionsTotal(0);
        setSelectedNodeApiTransactionsError(
          `Using graph-derived transfers (transactions API unavailable).${formatApiErrorMeta(error)}`,
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
    setTransactionPage,
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

  const resetAllTransactionFilters = useCallback(() => {
    resetTransactionState();
  }, [resetTransactionState]);

  const closeTransfersModal = useCallback(() => {
    setIsExportMenuOpen(false);
    setIsTransfersModalOpen(false);
    resetAllTransactionFilters();
  }, [resetAllTransactionFilters]);

  useEffect(() => {
    const initialRootAddress = String(
      initialRootAddressFromUrlRef.current || "",
    ).trim();
    if (!initialRootAddress) return;

    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress(initialRootAddress);
    setIsConnectionsView(true);

    initialRootAddressFromUrlRef.current = null;
  }, [closeTransfersModal]);

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
  }, [resetTransactionState, selectedNode]);

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

    fetchJsonWithTimeout(endpoint, {}, MAPS_API_REQUEST_TIMEOUT_MS)
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

  const clearActiveContext = useCallback(() => {
    if (isCommandPaletteOpen) {
      setIsCommandPaletteOpen(false);
      return true;
    }
    if (isSavedViewsOpen) {
      setIsSavedViewsOpen(false);
      return true;
    }
    if (isTraceToolOpen) {
      setIsTraceToolOpen(false);
      return true;
    }
    if (isCompareModeOpen) {
      setIsCompareModeOpen(false);
      return true;
    }
    if (isDiagnosticsOpen) {
      setIsDiagnosticsOpen(false);
      return true;
    }
    if (isExportPresetsOpen) {
      setIsExportPresetsOpen(false);
      return true;
    }
    if (isMobileInspectOpen) {
      setIsMobileInspectOpen(false);
      return true;
    }
    if (isOnboardingVisible) {
      setIsOnboardingVisible(false);
      return true;
    }
    if (isExportMenuOpen) {
      setIsExportMenuOpen(false);
      return true;
    }
    if (isTransfersModalOpen) {
      closeTransfersModal();
      return true;
    }
    if (selectedNode) {
      setSelectedNode(null);
      return true;
    }

    return false;
  }, [
    closeTransfersModal,
    isCommandPaletteOpen,
    isCompareModeOpen,
    isDiagnosticsOpen,
    isExportMenuOpen,
    isExportPresetsOpen,
    isMobileInspectOpen,
    isOnboardingVisible,
    isSavedViewsOpen,
    isTraceToolOpen,
    isTransfersModalOpen,
    selectedNode,
  ]);

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
      const targetTag = String(event.target?.tagName || "").toLowerCase();
      const isTypingTarget =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        event.target?.isContentEditable;

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        document.getElementById("header-search-input")?.focus();
        return;
      }

      if (
        !isTypingTarget &&
        (event.ctrlKey || event.metaKey) &&
        String(event.key || "").toLowerCase() === "k"
      ) {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if (String(event.key || "").toLowerCase() === "g" && !isTypingTarget) {
        event.preventDefault();
        bubbleMapActionsRef.current?.fitToView?.();
        return;
      }

      if (String(event.key || "").toLowerCase() === "f" && !isTypingTarget) {
        event.preventDefault();
        setIsFocusMode((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        if (clearActiveContext()) return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearActiveContext]);

  const trustStatus = useMemo(() => {
    const apiHealthy =
      !isUsingMockApiFallback &&
      !String(mapDataStatus || "")
        .toLowerCase()
        .includes("failed") &&
      !String(mapDataStatus || "")
        .toLowerCase()
        .includes("unavailable");

    return {
      apiHealthy,
    };
  }, [isUsingMockApiFallback, mapDataStatus]);

  const executiveSummary = useMemo(() => {
    const summaryPool = Array.isArray(displaySummaryNodes)
      ? displaySummaryNodes
      : [];
    const visibleWallets = filteredNodes.length;
    const visibleConnections = filteredLinks.length;
    const topWallet = summaryPool.length
      ? summaryPool.reduce((best, holder) =>
          Number(holder?.value || 0) > Number(best?.value || 0) ? holder : best,
        )
      : null;
    const topWalletShare =
      currentSupplyBase > 0 && topWallet
        ? (Number(topWallet.value || 0) / currentSupplyBase) * 100
        : Number(topWallet?.pct || 0);
    const topTenTotal = summaryPool
      .slice()
      .sort((a, b) => Number(b?.value || 0) - Number(a?.value || 0))
      .slice(0, 10)
      .reduce((sum, holder) => sum + Number(holder?.value || 0), 0);
    const concentrationTop10 =
      currentSupplyBase > 0 ? (topTenTotal / currentSupplyBase) * 100 : 0;

    return {
      visibleWallets,
      visibleConnections,
      topWalletLabel: topWallet?.shortAddr || topWallet?.label || "N/A",
      topWalletShare,
      concentrationTop10,
    };
  }, [
    currentSupplyBase,
    displaySummaryNodes,
    filteredLinks.length,
    filteredNodes.length,
  ]);

  const hasMapError = useMemo(() => {
    const statusText = String(mapDataStatus || "").toLowerCase();
    return (
      statusText.includes("failed") ||
      statusText.includes("unavailable") ||
      statusText.includes("unable")
    );
  }, [mapDataStatus]);

  const mapRecoveryState = useMemo(() => {
    if (isMapLoading || filteredNodes.length > 0) {
      return null;
    }

    const canClearSearch = Boolean(searchQuery);
    const canClearLegend = Boolean(activeHolderTypeFilter);
    const canClearConnections = Boolean(isConnectionsView);

    if (hasMapError) {
      return {
        title: "Live data is temporarily unavailable",
        copy: "The graph request failed or timed out. Retry the request or reset filters to continue with a stable view.",
        actions: [
          {
            key: "retry",
            label: "Retry",
            onClick: handleRetryGraphLoad,
          },
          {
            key: "reset",
            label: "Reset View",
            onClick: handleClearConnections,
          },
        ],
      };
    }

    if (isConnectionsView) {
      return {
        title: "No connected wallets for this address",
        copy: "Try another root wallet or return to token overview to continue exploring holder distribution.",
        actions: [
          {
            key: "clear-connections",
            label: "Back to Token Overview",
            onClick: handleClearConnections,
          },
          {
            key: "retry-connections",
            label: "Retry Connections",
            onClick: handleRetryGraphLoad,
          },
        ],
      };
    }

    if (canClearSearch || canClearLegend || canClearConnections) {
      return {
        title: "No wallets match current filters",
        copy: "Clear one or more filters to recover the graph and continue analysis.",
        actions: [
          canClearSearch
            ? {
                key: "clear-search",
                label: "Clear Search",
                onClick: () => setSearchQuery(""),
              }
            : null,
          canClearLegend
            ? {
                key: "clear-legend",
                label: "Clear Legend Filter",
                onClick: () => setActiveHolderTypeFilter(""),
              }
            : null,
          {
            key: "reset-all",
            label: "Reset View",
            onClick: handleClearConnections,
          },
        ].filter(Boolean),
      };
    }

    return {
      title: "No graph data available",
      copy: "The selected token did not return a renderable graph yet. Retry or switch tokens.",
      actions: [
        {
          key: "retry-empty",
          label: "Retry",
          onClick: handleRetryGraphLoad,
        },
      ],
    };
  }, [
    activeHolderTypeFilter,
    filteredNodes.length,
    handleClearConnections,
    hasMapError,
    isConnectionsView,
    isMapLoading,
    searchQuery,
  ]);

  const traceComputation = useMemo(() => {
    const fromId = String(traceFromNodeId || "").trim();
    const toId = String(traceToNodeId || "").trim();
    if (!fromId || !toId || fromId === toId) {
      return {
        nodeIds: [],
        linkKeys: [],
        status:
          fromId && toId && fromId === toId
            ? "Select two different wallets to trace a path."
            : "",
      };
    }

    const adjacency = new Map();
    filteredLinks.forEach((link) => {
      const source = getLinkEndpointId(link?.source);
      const target = getLinkEndpointId(link?.target);
      if (!source || !target) return;
      if (!adjacency.has(source)) adjacency.set(source, []);
      if (!adjacency.has(target)) adjacency.set(target, []);
      adjacency.get(source).push(target);
      adjacency.get(target).push(source);
    });

    if (!adjacency.has(fromId) || !adjacency.has(toId)) {
      return {
        nodeIds: [],
        linkKeys: [],
        status:
          "Selected wallets are not connected in the current visible graph.",
      };
    }

    const queue = [fromId];
    const visited = new Set([fromId]);
    const prev = new Map();

    while (queue.length) {
      const current = queue.shift();
      if (current === toId) break;
      (adjacency.get(current) || []).forEach((nextNodeId) => {
        if (visited.has(nextNodeId)) return;
        visited.add(nextNodeId);
        prev.set(nextNodeId, current);
        queue.push(nextNodeId);
      });
    }

    if (!visited.has(toId)) {
      return {
        nodeIds: [],
        linkKeys: [],
        status: "No path found between these wallets in the current view.",
      };
    }

    const pathNodeIds = [];
    let cursor = toId;
    while (cursor) {
      pathNodeIds.push(cursor);
      if (cursor === fromId) break;
      cursor = prev.get(cursor);
    }
    pathNodeIds.reverse();

    const pathLinkKeys = [];
    for (let index = 0; index < pathNodeIds.length - 1; index += 1) {
      const left = pathNodeIds[index];
      const right = pathNodeIds[index + 1];
      pathLinkKeys.push(getLinkKey(left, right));
      pathLinkKeys.push(getLinkKey(right, left));
    }

    return {
      nodeIds: pathNodeIds,
      linkKeys: pathLinkKeys,
      status: `Trace path found across ${Math.max(0, pathNodeIds.length - 1)} hop(s).`,
    };
  }, [filteredLinks, traceFromNodeId, traceToNodeId]);

  const diagnosticsDetails = useMemo(() => {
    const syncLag =
      Number.isFinite(blockSyncTargetHeight) && Number.isFinite(blockSyncHeight)
        ? Math.max(0, Number(blockSyncTargetHeight) - Number(blockSyncHeight))
        : null;
    return {
      apiHealth: trustStatus.apiHealthy ? "Online" : "Degraded",
      source: isUsingMockApiFallback ? "Mock fallback" : "Live API",
      syncLag,
      mapStatus: mapDataStatus || "Ready",
      lastApiErrorSource: lastApiError?.source || "None",
      lastApiErrorCode: lastApiError?.code || "None",
      lastApiErrorStatus: Number.isFinite(Number(lastApiError?.status))
        ? String(lastApiError.status)
        : "None",
      lastApiErrorRequestId: lastApiError?.requestId || "None",
      lastApiErrorMessage: lastApiError?.message || "None",
      lastApiErrorAt: Number.isFinite(Number(lastApiError?.recordedAt))
        ? new Date(lastApiError.recordedAt).toISOString()
        : "None",
      indexerUpdated: Number.isFinite(blockSyncUpdatedAt)
        ? new Date(blockSyncUpdatedAt).toISOString()
        : "Waiting",
      marketUpdated: Number.isFinite(priceLastUpdatedAt)
        ? new Date(priceLastUpdatedAt).toISOString()
        : "Waiting",
    };
  }, [
    blockSyncHeight,
    blockSyncTargetHeight,
    blockSyncUpdatedAt,
    isUsingMockApiFallback,
    lastApiError,
    mapDataStatus,
    priceLastUpdatedAt,
    trustStatus.apiHealthy,
  ]);

  useEffect(() => {
    setTraceStatusMessage(traceComputation.status || "");
  }, [traceComputation.status]);

  useEffect(() => {
    let isMounted = true;

    async function refreshCurrentTokenSnapshot() {
      const currentKey = String(selectedTokenSymbol || "").trim();
      if (!currentKey) {
        setCurrentSnapshotStatus("");
        return;
      }

      setCurrentSnapshotStatus(`Loading ${currentKey} snapshot...`);

      const result = await fetchTokenSnapshot(
        MAPS_API_BASE_URL,
        MAPS_API_REQUEST_TIMEOUT_MS,
        currentKey,
      );

      if (!isMounted) return;

      if (result.snapshot) {
        setTokenSnapshots((current) => ({
          ...current,
          [currentKey]:
            normalizeTokenSnapshot(result.snapshot) || result.snapshot,
        }));
        setCurrentSnapshotStatus(
          result.fallbackUsed ? "Using fallback snapshot data." : "",
        );
        return;
      }

      setCurrentSnapshotStatus(`Unable to load ${currentKey} snapshot.`);
    }

    refreshCurrentTokenSnapshot().catch(() => {
      if (!isMounted) return;
      const currentKey = String(selectedTokenSymbol || "").trim();
      if (!currentKey) return;
      setCurrentSnapshotStatus(`Unable to load ${currentKey} snapshot.`);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTokenSymbol]);

  const currentTokenSnapshot = useMemo(() => {
    const currentKey = String(selectedTokenSymbol || "").trim();
    if (!currentKey) return null;
    return tokenSnapshots[currentKey] || null;
  }, [selectedTokenSymbol, tokenSnapshots]);

  const compareSnapshot = useMemo(() => {
    const compareKey = String(compareTokenSymbol || "").trim();
    if (!compareKey) return null;
    return tokenSnapshots[compareKey] || null;
  }, [compareTokenSymbol, tokenSnapshots]);

  useEffect(() => {
    let isMounted = true;

    async function ensureCompareSnapshot() {
      const compareKey = String(compareTokenSymbol || "").trim();
      if (!compareKey) {
        setCompareSnapshotStatus("");
        return;
      }

      setCompareSnapshotStatus(`Loading ${compareKey} snapshot...`);

      const result = await fetchTokenSnapshot(
        MAPS_API_BASE_URL,
        MAPS_API_REQUEST_TIMEOUT_MS,
        compareKey,
      );

      if (!isMounted) return;

      if (result.snapshot) {
        setTokenSnapshots((current) => ({
          ...current,
          [compareKey]:
            normalizeTokenSnapshot(result.snapshot) || result.snapshot,
        }));
        setCompareSnapshotStatus(
          result.fallbackUsed ? "Using fallback snapshot data." : "",
        );
        return;
      }

      setCompareSnapshotStatus(`Unable to load ${compareKey} snapshot.`);
    }

    ensureCompareSnapshot().catch(() => {
      if (!isMounted) return;
      const compareKey = String(compareTokenSymbol || "").trim();
      if (!compareKey) return;
      setCompareSnapshotStatus(`Unable to load ${compareKey} snapshot.`);
    });

    return () => {
      isMounted = false;
    };
  }, [compareTokenSymbol]);

  const saveCurrentView = useCallback(() => {
    const label = String(savedViewName || "").trim();
    if (!label) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: label,
      token: selectedTokenSymbol,
      searchQuery,
      rootAddress: searchedRootAddress,
      isConnectionsView,
      legendFilter: activeHolderTypeFilter,
      densityMode,
      physicsMode,
      labelDensityMode,
      createdAt: Date.now(),
    };
    setSavedViews((current) => [entry, ...current].slice(0, 16));
    setSavedViewName("");
    setIsSavedViewsOpen(true);
  }, [
    activeHolderTypeFilter,
    densityMode,
    isConnectionsView,
    labelDensityMode,
    physicsMode,
    savedViewName,
    searchQuery,
    searchedRootAddress,
    selectedTokenSymbol,
  ]);

  const applySavedView = useCallback(
    (view) => {
      if (!view) return;
      setSelectedTokenSymbol(String(view.token || selectedTokenSymbol));
      setSearchQuery(String(view.searchQuery || ""));
      setSearchedRootAddress(String(view.rootAddress || ""));
      setIsConnectionsView(Boolean(view.isConnectionsView));
      setActiveHolderTypeFilter(String(view.legendFilter || ""));
      setDensityMode(
        String(view.densityMode || "comfortable") === "compact"
          ? "compact"
          : "comfortable",
      );
      setPhysicsMode(
        String(view.physicsMode || "balanced") === "fast"
          ? "fast"
          : String(view.physicsMode || "balanced") === "detailed"
            ? "detailed"
            : "balanced",
      );
      setLabelDensityMode(
        String(view.labelDensityMode || "balanced") === "minimal"
          ? "minimal"
          : String(view.labelDensityMode || "balanced") === "detailed"
            ? "detailed"
            : "balanced",
      );
      setIsSavedViewsOpen(false);
    },
    [selectedTokenSymbol],
  );

  const removeSavedView = useCallback((viewId) => {
    setSavedViews((current) => current.filter((view) => view.id !== viewId));
  }, []);

  function exportVisibleGraphPreset() {
    const graphPayload = {
      token: selectedTokenSymbol,
      nodes: filteredNodes,
      links: filteredLinks,
      exportedAt: new Date().toISOString(),
    };
    downloadBlobFile(
      JSON.stringify(graphPayload, null, 2),
      "application/json;charset=utf-8",
      `phantasma-visible-graph-${selectedTokenSymbol.toLowerCase()}.json`,
    );
    setIsExportPresetsOpen(false);
  }

  function exportTopHoldersPreset() {
    const headers = ["Rank", "Address", "Label", "Amount", "Share (%)", "Type"];
    const rows = filteredNodes.slice(0, 50).map((node, index) => {
      const share =
        currentSupplyBase > 0
          ? ((Number(node?.value || 0) / currentSupplyBase) * 100).toFixed(4)
          : Number(node?.pct || 0).toFixed(4);
      return [
        index + 1,
        node.id,
        node.label,
        Number(node.value || 0),
        share,
        node.type,
      ];
    });
    downloadBlobFile(
      rowsToCsv(headers, rows),
      "text/csv;charset=utf-8",
      `phantasma-top-holders-${selectedTokenSymbol.toLowerCase()}.csv`,
    );
    setIsExportPresetsOpen(false);
  }

  function exportFilteredTransactionsPreset() {
    const rows = buildExportRows();
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
    downloadBlobFile(
      rowsToCsv(headers, csvRows),
      "text/csv;charset=utf-8",
      `phantasma-filtered-transactions-${selectedTokenSymbol.toLowerCase()}.csv`,
    );
    setIsExportPresetsOpen(false);
  }

  useEffect(() => {
    if (
      !isSavedViewsOpen &&
      !isCompareModeOpen &&
      !isDiagnosticsOpen &&
      !isExportPresetsOpen
    ) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;
      const popoutConfigs = [
        {
          isOpen: isSavedViewsOpen,
          popoutRef: savedViewsPopoutRef,
          triggerRef: savedViewsButtonRef,
          close: () => setIsSavedViewsOpen(false),
        },
        {
          isOpen: isCompareModeOpen,
          popoutRef: comparePopoutRef,
          triggerRef: compareButtonRef,
          close: () => setIsCompareModeOpen(false),
        },
        {
          isOpen: isDiagnosticsOpen,
          popoutRef: diagnosticsPopoutRef,
          triggerRef: diagnosticsButtonRef,
          close: () => setIsDiagnosticsOpen(false),
        },
        {
          isOpen: isExportPresetsOpen,
          popoutRef: exportPresetsPopoutRef,
          triggerRef: exportPresetsButtonRef,
          close: () => setIsExportPresetsOpen(false),
        },
      ];

      popoutConfigs.forEach((config) => {
        if (!config.isOpen) return;

        const isInsidePopout = config.popoutRef.current?.contains(target);
        const isOnTrigger = config.triggerRef.current?.contains(target);
        if (isInsidePopout || isOnTrigger) return;

        config.close();
      });
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [
    isCompareModeOpen,
    isDiagnosticsOpen,
    isExportPresetsOpen,
    isSavedViewsOpen,
  ]);

  useEffect(() => {
    if (!isTraceToolOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      const isInsideTracePanel = traceToolPanelRef.current?.contains(target);
      const isOnTraceToggle = traceToggleButtonRef.current?.contains(target);
      if (isInsideTracePanel || isOnTraceToggle) return;
      setIsTraceToolOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTraceToolOpen]);

  const commandPaletteActions = useMemo(
    () => [
      {
        id: "search-focus",
        label: "Focus search input",
        shortcut: "/",
        run: () => document.getElementById("header-search-input")?.focus(),
      },
      {
        id: "fit",
        label: "Fit graph to view",
        shortcut: "G",
        run: () => bubbleMapActionsRef.current?.fitToView?.(),
      },
      {
        id: "focus",
        label: isFocusMode ? "Disable Focus Mode" : "Enable Focus Mode",
        shortcut: "F",
        run: () => setIsFocusMode((current) => !current),
      },
      {
        id: "clear-context",
        label: "Clear active context",
        shortcut: "Esc",
        run: clearActiveContext,
      },
      {
        id: "connections-clear",
        label: "Clear connections mode",
        run: handleClearConnections,
      },
      {
        id: "legend-clear",
        label: "Clear legend filter",
        run: () => setActiveHolderTypeFilter(""),
      },
      {
        id: "retry",
        label: "Retry graph load",
        run: handleRetryGraphLoad,
      },
      {
        id: "diagnostics",
        label: "Open diagnostics details",
        run: () => setIsDiagnosticsOpen(true),
      },
      {
        id: "trace",
        label: "Open node-to-node trace tool",
        run: () => setIsTraceToolOpen(true),
      },
      {
        id: "compare",
        label: "Open token compare mode",
        run: () => setIsCompareModeOpen(true),
      },
      {
        id: "export-graph",
        label: "Export visible graph preset",
        run: exportVisibleGraphPreset,
      },
    ],
    [
      clearActiveContext,
      handleClearConnections,
      isFocusMode,
      setIsFocusMode,
      setActiveHolderTypeFilter,
    ],
  );

  const filteredCommandPaletteActions = useMemo(() => {
    const query = String(commandPaletteQuery || "")
      .trim()
      .toLowerCase();
    if (!query) return commandPaletteActions;
    return commandPaletteActions.filter((action) =>
      action.label.toLowerCase().includes(query),
    );
  }, [commandPaletteActions, commandPaletteQuery]);

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
  }, [activeTransactionFilter, setActiveTransactionFilter]);

  const clampedMapLoadingProgress = Math.max(
    0,
    Math.min(100, Math.round(mapLoadingProgress)),
  );
  const mapLoadingPhaseLabel =
    mapLoadingDisplayedPhase === "balances"
      ? "Balance normalization"
      : mapLoadingDisplayedPhase === "addresses"
        ? "Address mapping"
        : mapLoadingDisplayedPhase === "topology"
          ? "Topology assembly"
          : "Ready";
  const mapLoadingStageDetail = isMapLoadingReadyState
    ? "Graph ready"
    : mapLoadingDisplayedPhase === "balances"
      ? "Fetching token balances"
      : mapLoadingDisplayedPhase === "addresses"
        ? "Resolving wallet relationships"
        : isMapLoadingSlow
          ? "Still processing a larger graph payload"
          : "Preparing graph render";
  const isBalancesComplete =
    mapLoadingDisplayedPhase !== "balances" && mapLoadingDisplayedPhase !== "";
  const isAddressComplete =
    mapLoadingDisplayedPhase === "topology" ||
    mapLoadingDisplayedPhase === "ready";
  const isTopologyComplete = mapLoadingDisplayedPhase === "ready";
  const mapLoadingAriaStatus =
    mapLoadingDisplayedPhase === "ready"
      ? "Graph ready"
      : `Graph processing phase: ${mapLoadingPhaseLabel}`;
  const hasMapLoadingEvidence =
    Number.isFinite(mapLoadingEvidence?.wallets) ||
    Number.isFinite(mapLoadingEvidence?.links);
  const mapLoadingNodeCount = Number.isFinite(mapLoadingEvidence?.wallets)
    ? Math.max(0, Math.round(mapLoadingEvidence.wallets))
    : 0;
  const mapLoadingEdgeCount = Number.isFinite(mapLoadingEvidence?.links)
    ? Math.max(0, Math.round(mapLoadingEvidence.links))
    : 0;
  const mapLoadingEvidenceDetail = hasMapLoadingEvidence
    ? `${mapLoadingNodeCount.toLocaleString()} nodes - ${mapLoadingEdgeCount.toLocaleString()} edges loaded`
    : "Scanning graph structure";
  const activeViewLabel = isConnectionsView
    ? activeGraphRootAddress
      ? `Connections around ${shortenAddress(activeGraphRootAddress)}`
      : "Connections view"
    : searchedRootAddress
      ? `Focused on ${shortenAddress(searchedRootAddress)}`
      : "Token overview";
  const activeLegendLabel = activeHolderTypeFilter
    ? HOLDER_TYPES[activeHolderTypeFilter]?.label || activeHolderTypeFilter
    : "All wallet tiers";
  const shellStatusLabel = isMapLoading
    ? `Loading ${selectedTokenSymbol} graph`
    : mapDataStatus || "Ready";
  const commandPaletteButtonLabel = isMobileViewport ? "Actions" : "Command";
  const commandPaletteHeadingLabel = isMobileViewport
    ? "Action Menu"
    : "Command Palette";
  const footerMapStatus = useMemo(() => {
    const statusText = String(mapDataStatus || "").trim();
    if (!statusText) return "";

    if (statusText.toLowerCase().startsWith("live graph loaded from ")) {
      return "";
    }

    return statusText;
  }, [mapDataStatus]);
  const isAddressGraphFallbackVisible = /^Address graph unavailable/i.test(
    String(footerMapStatus || "").trim(),
  );

  const effectiveStatsCollapsed = isFocusMode ? true : isStatsCollapsed;
  const onboardingTutorialStepCount = ONBOARDING_TUTORIAL_STEPS.length;
  const onboardingTutorialStepIndex = Math.min(
    Math.max(onboardingTutorialStep, 0),
    Math.max(onboardingTutorialStepCount - 1, 0),
  );
  const currentOnboardingStep =
    ONBOARDING_TUTORIAL_STEPS[onboardingTutorialStepIndex] ||
    ONBOARDING_TUTORIAL_STEPS[0];
  const isOnboardingFirstStep = onboardingTutorialStepIndex <= 0;
  const isOnboardingLastStep =
    onboardingTutorialStepIndex >= onboardingTutorialStepCount - 1;
  const activeTutorialTarget =
    isOnboardingVisible && isOnboardingAt === "tutorial"
      ? String(currentOnboardingStep?.target || "").trim()
      : "";

  function handleReplayTutorial() {
    setUserSkillLevel("beginner");
    setIsOnboardingAt("tutorial");
    setOnboardingTutorialStep(0);
    setIsOnboardingVisible(true);
  }

  return (
    <div
      className={`app-root theme-${colorTheme} density-${densityMode} ${isFocusMode ? "is-focus-mode" : ""} ${activeMotionCue ? `motion-${activeMotionCue}` : ""}`}
    >
      <Header
        onSearch={handleHeaderSearch}
        searchInputValue={isConnectionsView ? searchedRootAddress : searchQuery}
        tokenInfo={activeTokenInfo}
        blockSyncHeight={blockSyncHeight}
        blockSyncTargetHeight={blockSyncTargetHeight}
        colorTheme={colorTheme}
        onThemeChange={setColorTheme}
        graphEdgeLimit={graphEdgeLimit}
        graphNodeLimit={graphNodeLimit}
        defaultGraphEdgeLimit={MAPS_API_GRAPH_EDGE_LIMIT}
        defaultGraphNodeLimit={MAPS_API_GRAPH_NODE_LIMIT}
        onGraphSettingsApply={handleGraphSettingsApply}
        isGraphMaxModeEnabled={isTokenGraphMaxModeActive}
        canUseGraphMaxMode={true}
        isConnectionsView={isConnectionsView}
        availableNodeCount={
          isConnectionsView
            ? maxModeScopeGraph.nodes.length
            : activeHolderTypeFilter
              ? maxModeScopeGraph.nodes.length
              : Number.isFinite(activeTokenInfo?.globalHolderCount)
                ? activeTokenInfo.globalHolderCount
                : overallMaxGraphStats.wallets
        }
        availableEdgeCount={
          isConnectionsView
            ? maxModeScopeGraph.links.length
            : activeHolderTypeFilter
              ? maxModeScopeGraph.links.length
              : overallMaxGraphStats.connections
        }
        renderedNodeCount={filteredNodes.length}
        renderedEdgeCount={filteredLinks.length}
        densityMode={densityMode}
        onDensityModeChange={setDensityMode}
        trustStatus={trustStatus}
        isFocusMode={isFocusMode}
        onFocusModeChange={setIsFocusMode}
        physicsMode={physicsMode}
        onPhysicsModeChange={setPhysicsMode}
        labelDensityMode={labelDensityMode}
        onLabelDensityModeChange={setLabelDensityMode}
        onReplayTutorial={handleReplayTutorial}
        tutorialHighlightTarget={activeTutorialTarget}
      />
      <div className="app-shell-bar" aria-live="polite">
        <div className="app-shell-bar-primary">
          <span
            className="app-shell-pill"
            title="Currently selected token symbol"
          >
            {selectedTokenSymbol}
          </span>
          <span className="app-shell-kicker" title="Current graph perspective">
            {activeViewLabel}
          </span>
          <span
            className="app-shell-copy"
            title="Latest map loading or data status"
          >
            {shellStatusLabel}
          </span>
        </div>
        <div className="app-shell-bar-secondary">
          <span
            className="app-shell-metric"
            title="How many wallets and links are currently visible in the graph"
          >
            <span className="app-shell-metric-label">Visible</span>
            <strong>
              {filteredNodes.length.toLocaleString()} wallets /{" "}
              {filteredLinks.length.toLocaleString()} links
            </strong>
          </span>
          <span
            className="app-shell-metric"
            title="Current legend filter scope used to display wallet tiers"
          >
            <span className="app-shell-metric-label">Legend</span>
            <strong>{activeLegendLabel}</strong>
          </span>
          <button
            type="button"
            ref={commandButtonRef}
            className={`app-shell-action-btn ${activeTutorialTarget === "command" ? "tutorial-highlight" : ""}`}
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label={
              isMobileViewport ? "Open actions menu" : "Open command palette"
            }
            title={
              isMobileViewport
                ? "Open actions menu"
                : "Open command palette (Ctrl+K)"
            }
          >
            {commandPaletteButtonLabel}
          </button>
          <button
            type="button"
            ref={savedViewsButtonRef}
            className={`app-shell-action-btn ${activeTutorialTarget === "views" ? "tutorial-highlight" : ""}`}
            onClick={() => setIsSavedViewsOpen((open) => !open)}
            aria-label="Open saved views"
            title="Save or load a named graph view"
          >
            Views
          </button>
          <button
            type="button"
            ref={traceToggleButtonRef}
            className={`app-shell-action-btn ${activeTutorialTarget === "trace" ? "tutorial-highlight" : ""}`}
            onClick={() => setIsTraceToolOpen((open) => !open)}
            aria-expanded={isTraceToolOpen}
            aria-controls="map-trace-tool"
            aria-label={
              isTraceToolOpen ? "Hide trace path tool" : "Open trace path tool"
            }
            title={
              isTraceToolOpen ? "Hide trace path tool" : "Open trace path tool"
            }
          >
            {isTraceToolOpen ? "Hide Trace" : "Trace Path"}
          </button>
          <button
            type="button"
            ref={compareButtonRef}
            className={`app-shell-action-btn ${activeTutorialTarget === "compare" ? "tutorial-highlight" : ""}`}
            onClick={() => setIsCompareModeOpen((open) => !open)}
            aria-label="Open compare mode"
            title="Compare this token snapshot with another token"
          >
            Compare
          </button>
          <button
            type="button"
            ref={exportPresetsButtonRef}
            className="app-shell-action-btn"
            onClick={() => setIsExportPresetsOpen((open) => !open)}
            aria-label="Open export presets"
            title="Export common reporting presets"
          >
            Exports
          </button>
          <button
            type="button"
            ref={diagnosticsButtonRef}
            className={`app-shell-action-btn ${activeTutorialTarget === "diagnostics" ? "tutorial-highlight" : ""}`}
            onClick={() => setIsDiagnosticsOpen((open) => !open)}
            aria-label="Open diagnostics panel"
            title="Show source and sync diagnostics details"
          >
            Diagnostics
          </button>
        </div>
      </div>
      {isSavedViewsOpen ? (
        <div
          ref={savedViewsPopoutRef}
          className="app-shell-popout app-shell-views-popout"
          role="dialog"
          aria-modal="false"
          aria-labelledby="saved-views-heading"
        >
          <div className="app-shell-popout-head">
            <strong id="saved-views-heading">Saved Views</strong>
            <button
              type="button"
              aria-label="Close saved views"
              onClick={() => setIsSavedViewsOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="app-shell-views-create-row">
            <input
              type="text"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="Name this view"
            />
            <button type="button" onClick={saveCurrentView}>
              Save
            </button>
          </div>
          <div className="app-shell-views-list">
            {savedViews.length ? (
              savedViews.map((view) => (
                <div key={view.id} className="app-shell-view-row">
                  <button type="button" onClick={() => applySavedView(view)}>
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSavedView(view.id)}
                    className="app-shell-view-delete"
                    aria-label="Delete saved view"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="app-shell-empty-copy">No saved views yet.</div>
            )}
          </div>
        </div>
      ) : null}
      {isCompareModeOpen ? (
        <div
          ref={comparePopoutRef}
          className="app-shell-popout app-shell-compare-popout"
          role="dialog"
          aria-modal="false"
          aria-labelledby="compare-heading"
        >
          <div className="app-shell-popout-head">
            <strong id="compare-heading">Compare Snapshot</strong>
            <button
              type="button"
              aria-label="Close compare snapshot"
              onClick={() => setIsCompareModeOpen(false)}
            >
              Close
            </button>
          </div>
          <label className="app-shell-compare-picker">
            <span>Compare against</span>
            <select
              value={compareTokenSymbol}
              onChange={(event) => setCompareTokenSymbol(event.target.value)}
            >
              <option value="">Select token</option>
              {availableTokenSymbols
                .filter((token) => token !== selectedTokenSymbol)
                .map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
            </select>
          </label>
          <div className="app-shell-compare-grid">
            <div>
              <div className="app-shell-compare-kicker">Current</div>
              <strong>
                {currentTokenSnapshot?.token || selectedTokenSymbol}
              </strong>
              {currentSnapshotStatus ? <p>{currentSnapshotStatus}</p> : null}
              <p>
                Wallets:{" "}
                {getSnapshotWalletCount(currentTokenSnapshot).toLocaleString()}
              </p>
              <p>
                Links:{" "}
                {getSnapshotLinkCount(currentTokenSnapshot).toLocaleString()}
              </p>
              <p>
                Top 10: {Number(currentTokenSnapshot?.top10 || 0).toFixed(1)}%
              </p>
              <p>
                Top wallet: {currentTokenSnapshot?.topWalletLabel || "N/A"} (
                {Number(currentTokenSnapshot?.topWalletShare || 0).toFixed(2)}%)
              </p>
            </div>
            <div>
              <div className="app-shell-compare-kicker">Selected</div>
              <strong>{compareSnapshot?.token || "N/A"}</strong>
              {compareSnapshotStatus ? <p>{compareSnapshotStatus}</p> : null}
              <p>
                Wallets:{" "}
                {getSnapshotWalletCount(compareSnapshot).toLocaleString()}
              </p>
              <p>
                Links: {getSnapshotLinkCount(compareSnapshot).toLocaleString()}
              </p>
              <p>Top 10: {Number(compareSnapshot?.top10 || 0).toFixed(1)}%</p>
              <p>
                Top wallet: {compareSnapshot?.topWalletLabel || "N/A"} (
                {Number(compareSnapshot?.topWalletShare || 0).toFixed(2)}%)
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {isDiagnosticsOpen ? (
        <div
          ref={diagnosticsPopoutRef}
          className="app-shell-popout app-shell-diagnostics-popout"
          role="dialog"
          aria-modal="false"
          aria-labelledby="diagnostics-heading"
        >
          <div className="app-shell-popout-head">
            <strong id="diagnostics-heading">Data Diagnostics</strong>
            <button
              type="button"
              aria-label="Close diagnostics"
              onClick={() => setIsDiagnosticsOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="app-shell-diagnostics-list">
            <p>API health: {diagnosticsDetails.apiHealth}</p>
            <p>Source: {diagnosticsDetails.source}</p>
            <p>
              Sync lag:{" "}
              {Number.isFinite(diagnosticsDetails.syncLag)
                ? `${diagnosticsDetails.syncLag} blocks`
                : "Waiting"}
            </p>
            <p>Map status: {diagnosticsDetails.mapStatus}</p>
            <p>
              Last API error source: {diagnosticsDetails.lastApiErrorSource}
            </p>
            <p>Last API error code: {diagnosticsDetails.lastApiErrorCode}</p>
            <p>
              Last API error status: {diagnosticsDetails.lastApiErrorStatus}
            </p>
            <p>
              Last API requestId: {diagnosticsDetails.lastApiErrorRequestId}
            </p>
            <p>
              Last API error message: {diagnosticsDetails.lastApiErrorMessage}
            </p>
            <p>Last API error at: {diagnosticsDetails.lastApiErrorAt}</p>
            <p>Indexer update: {diagnosticsDetails.indexerUpdated}</p>
            <p>Market update: {diagnosticsDetails.marketUpdated}</p>
          </div>
        </div>
      ) : null}
      {isExportPresetsOpen ? (
        <div
          ref={exportPresetsPopoutRef}
          className="app-shell-popout app-shell-export-popout"
          role="dialog"
          aria-modal="false"
          aria-labelledby="export-presets-heading"
        >
          <div className="app-shell-popout-head">
            <strong id="export-presets-heading">Export Presets</strong>
            <button
              type="button"
              aria-label="Close export presets"
              onClick={() => setIsExportPresetsOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="app-shell-export-actions">
            <button type="button" onClick={exportVisibleGraphPreset}>
              Visible Graph JSON
            </button>
            <button type="button" onClick={exportTopHoldersPreset}>
              Top Holders CSV
            </button>
            <button type="button" onClick={exportFilteredTransactionsPreset}>
              Filtered Transactions CSV
            </button>
          </div>
        </div>
      ) : null}
      {isCommandPaletteOpen ? (
        <div
          className="command-palette-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-heading"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div
            className="command-palette"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="command-palette-heading" className="visually-hidden">
              {commandPaletteHeadingLabel}
            </h3>
            <input
              type="text"
              value={commandPaletteQuery}
              onChange={(event) => setCommandPaletteQuery(event.target.value)}
              placeholder={
                isMobileViewport ? "Search actions" : "Type a command"
              }
              aria-label={
                isMobileViewport ? "Search actions" : "Search commands"
              }
              autoFocus
            />
            <div className="command-palette-list">
              {filteredCommandPaletteActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  title={
                    !isMobileViewport && action.shortcut
                      ? `Shortcut: ${action.shortcut}`
                      : undefined
                  }
                  onClick={() => {
                    action.run();
                    setIsCommandPaletteOpen(false);
                    setCommandPaletteQuery("");
                  }}
                >
                  <span>{action.label}</span>
                  {!isMobileViewport && action.shortcut ? (
                    <span
                      className="command-palette-shortcut"
                      aria-hidden="true"
                    >
                      {action.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {isOnboardingVisible && isOnboardingAt === "skill-selection" ? (
        <div
          className="onboarding-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-heading"
        >
          <div className="onboarding-card onboarding-card-minimal">
            <p className="onboarding-eyebrow">Phantasma Maps</p>
            <h3 id="welcome-heading" className="onboarding-title">
              Welcome to the wallet graph
            </h3>
            <p className="onboarding-intro">
              Explore token holders, spot concentration, and trace wallet
              relationships in a live interactive map.
            </p>
            <div className="skill-selection">
              <p className="skill-prompt">What's your experience level?</p>
              <button
                type="button"
                className="skill-button beginner-btn"
                onClick={() => {
                  handleReplayTutorial();
                }}
              >
                <span className="skill-button-icon" aria-hidden="true">
                  ◎
                </span>
                <span className="skill-button-label">I'm New Here</span>
                <span className="skill-description">Show me the basics</span>
              </button>
              <button
                type="button"
                className="skill-button poweruser-btn"
                onClick={() => {
                  setUserSkillLevel("power-user");
                  setIsOnboardingVisible(false);
                }}
              >
                <span className="skill-button-icon" aria-hidden="true">
                  ↗
                </span>
                <span className="skill-button-label">I Know My Way Around</span>
                <span className="skill-description">Skip to the app</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isOnboardingVisible && isOnboardingAt === "tutorial" ? (
        <div
          className="tour-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="tour-heading"
        >
          <p className="onboarding-eyebrow">
            Guided Tour · Step {onboardingTutorialStepIndex + 1} of{" "}
            {onboardingTutorialStepCount}
          </p>
          <h3 id="tour-heading" className="tour-panel-title">
            {currentOnboardingStep?.title || "Quick Start"}
          </h3>
          <p className="tour-panel-detail">
            {currentOnboardingStep?.detail || ""}
          </p>
          {currentOnboardingStep?.tip ? (
            <p className="onboarding-tip">{currentOnboardingStep.tip}</p>
          ) : null}
          <div
            className="onboarding-progress-bar tour-progress-bar"
            aria-hidden="true"
          >
            <span
              style={{
                width: `${((onboardingTutorialStepIndex + 1) / onboardingTutorialStepCount) * 100}%`,
              }}
            />
          </div>
          <div className="onboarding-tutorial-actions">
            <button
              type="button"
              className="onboarding-tutorial-btn"
              onClick={() =>
                setOnboardingTutorialStep((current) => Math.max(0, current - 1))
              }
              disabled={isOnboardingFirstStep}
            >
              Previous
            </button>
            <button
              type="button"
              className="onboarding-tutorial-btn"
              onClick={() => setIsOnboardingVisible(false)}
            >
              Skip
            </button>
            <button
              type="button"
              className="onboarding-tutorial-btn is-primary"
              onClick={() => {
                if (isOnboardingLastStep) {
                  setIsOnboardingVisible(false);
                  return;
                }
                setOnboardingTutorialStep((current) =>
                  Math.min(onboardingTutorialStepCount - 1, current + 1),
                );
              }}
            >
              {isOnboardingLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      ) : null}
      <div className="main-layout">
        <div
          className={`map-area ${activeTutorialTarget === "map" ? "tutorial-highlight" : ""}`}
        >
          <BubbleMap
            nodes={filteredNodes}
            links={filteredLinks}
            onNodeClick={setSelectedNode}
            onNodeHover={setHoveredNode}
            selectedNodeId={selectedNode?.id}
            currentSupply={currentSupplyBase}
            colorTheme={colorTheme}
            preserveUnconnectedNodes={isTokenGraphMaxModeActive}
            physicsMode={physicsMode}
            labelDensityMode={labelDensityMode}
            traceNodeIds={traceComputation.nodeIds}
            traceLinkKeys={traceComputation.linkKeys}
            onReady={(actions) => {
              bubbleMapActionsRef.current = actions;
            }}
          />
          <div className="map-global-filter-chips" aria-live="polite">
            {searchQuery ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={() => setSearchQuery("")}
              >
                Search: {searchQuery} ×
              </button>
            ) : null}
            {activeHolderTypeFilter ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={() => setActiveHolderTypeFilter("")}
              >
                Tier: {activeHolderTypeFilter} ×
              </button>
            ) : null}
            {isConnectionsView ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={handleClearConnections}
              >
                Connections mode ×
              </button>
            ) : null}
            {traceComputation.nodeIds.length ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={() => {
                  setTraceFromNodeId("");
                  setTraceToNodeId("");
                }}
              >
                Trace active ×
              </button>
            ) : null}
          </div>
          <div className="map-trace-tool-wrap">
            {isTraceToolOpen ? (
              <div
                ref={traceToolPanelRef}
                id="map-trace-tool"
                className="map-trace-tool"
                role="group"
                aria-label="Trace path tool"
              >
                <label>
                  <span>From wallet</span>
                  <input
                    type="text"
                    className="map-trace-search"
                    value={traceFromQuery}
                    onChange={(event) => setTraceFromQuery(event.target.value)}
                    placeholder="Search label or address"
                    aria-label="Search source wallet"
                  />
                  <select
                    className="map-trace-select"
                    size={isMobileViewport ? 4 : 6}
                    value={traceFromNodeId}
                    onChange={(event) => setTraceFromNodeId(event.target.value)}
                    aria-label="Select source wallet"
                  >
                    <option value="">Select</option>
                    {traceFromOptions.length ? (
                      traceFromOptions.map((node) => (
                        <option key={node.id} value={node.id}>
                          {buildTraceOptionLabel(node)}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        No wallets match that search
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  <span>To wallet</span>
                  <input
                    type="text"
                    className="map-trace-search"
                    value={traceToQuery}
                    onChange={(event) => setTraceToQuery(event.target.value)}
                    placeholder="Search label or address"
                    aria-label="Search destination wallet"
                  />
                  <select
                    className="map-trace-select"
                    size={isMobileViewport ? 4 : 6}
                    value={traceToNodeId}
                    onChange={(event) => setTraceToNodeId(event.target.value)}
                    aria-label="Select destination wallet"
                  >
                    <option value="">Select</option>
                    {traceToOptions.length ? (
                      traceToOptions.map((node) => (
                        <option key={node.id} value={node.id}>
                          {buildTraceOptionLabel(node)}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        No wallets match that search
                      </option>
                    )}
                  </select>
                </label>
                <div className="map-trace-status" aria-live="polite">
                  {traceComputation.status ||
                    traceStatusMessage ||
                    "Search by wallet label or address, then select two wallets to trace."}
                </div>
              </div>
            ) : null}
          </div>
          {isMapLoaderVisible ? (
            <div
              className={`map-loading-overlay ${isMapLoaderExiting ? "is-exiting" : ""}`}
              style={loadingThemeStyle}
              aria-live="off"
            >
              <div className="visually-hidden" role="status" aria-atomic="true">
                {mapLoadingAriaStatus}
              </div>
              <div className="map-loading-center">
                <svg
                  className="map-loading-ring"
                  viewBox="0 0 56 56"
                  aria-hidden="true"
                >
                  <circle
                    className="map-loading-ring-track"
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="2"
                  />
                  <circle
                    className="map-loading-ring-fill"
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                      strokeDashoffset: `${144.51 - (144.51 * clampedMapLoadingProgress) / 100}`,
                    }}
                  />
                  <circle
                    className="map-loading-ring-sweep"
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text
                    className="map-loading-ring-pct"
                    x="28"
                    y="28"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {clampedMapLoadingProgress}%
                  </text>
                </svg>
                <div key={mapLoadingStageDetail} className="map-loading-stage">
                  {mapLoadingStageDetail}
                </div>
                <div className="map-loading-evidence" aria-live="off">
                  {mapLoadingEvidenceDetail}
                </div>
              </div>
            </div>
          ) : null}
          {mapRecoveryState ? (
            <div className="map-empty-state" aria-live="polite">
              <div className="map-empty-state-title">
                {mapRecoveryState.title}
              </div>
              <div className="map-empty-state-copy">
                {mapRecoveryState.copy}
              </div>
              <div className="map-empty-state-actions">
                {mapRecoveryState.actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="map-empty-state-button"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
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
                <span>Type</span>
                <strong>
                  {HOLDER_TYPES[infoNode.type]?.label || infoNode.type}
                </strong>
              </div>
            </div>
          )}
          {resolvedSelectedNode && (
            <div
              className="map-sheet-scrim"
              onClick={() => {
                setSelectedNode(null);
                setHoveredNode(null);
              }}
              aria-hidden="true"
            />
          )}
          {resolvedSelectedNode && (
            <div
              className={
                activeTutorialTarget === "selected-node"
                  ? "tutorial-highlight"
                  : ""
              }
            >
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
                onOpenTransactions={() => {
                  setIsTransfersModalOpen(true);
                  triggerMotionCue("modal");
                }}
                isTransactionsLoading={isSelectedNodeTransactionsLoading}
              />
            </div>
          )}
          {isMobileViewport && resolvedSelectedNode ? (
            <div className="mobile-inspect-entry">
              <button
                type="button"
                className="mobile-inspect-toggle"
                onClick={() => setIsMobileInspectOpen((open) => !open)}
              >
                {isMobileInspectOpen ? "Hide Inspect" : "Inspect"}
              </button>
            </div>
          ) : null}
          {isMobileViewport && resolvedSelectedNode && isMobileInspectOpen ? (
            <div
              className="mobile-inspect-sheet"
              role="dialog"
              aria-modal="false"
              aria-labelledby="mobile-inspect-heading"
            >
              <div className="mobile-inspect-head">
                <strong id="mobile-inspect-heading">
                  {resolvedSelectedNode.label}
                </strong>
                <button
                  type="button"
                  aria-label="Close mobile inspect panel"
                  onClick={() => setIsMobileInspectOpen(false)}
                >
                  Close
                </button>
              </div>
              <p>{resolvedSelectedNode.shortAddr}</p>
              <p>
                Share:{" "}
                {fmtSharePct(
                  resolvedSelectedNode.value,
                  currentSupplyBase,
                  resolvedSelectedNode.pct,
                )}
              </p>
              <p>
                Amount: {fmtTokenAmount(resolvedSelectedNode.value)}{" "}
                {activeTokenInfo.name}
              </p>
              <div className="mobile-inspect-actions">
                <button
                  type="button"
                  onClick={() =>
                    handleShowNodeConnections(resolvedSelectedNode.id)
                  }
                >
                  Show Connections
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTransfersModalOpen(true);
                    setIsMobileInspectOpen(false);
                  }}
                >
                  Transactions
                </button>
              </div>
            </div>
          ) : null}
          <div className="map-hint">
            <span className="map-hint-text">
              Scroll to zoom · Drag to pan · Click a bubble for details
            </span>
            {footerMapStatus ? (
              <span className="map-hint-text map-hint-status">
                {isAddressGraphFallbackVisible ? (
                  <span
                    className="map-hint-badge map-hint-badge-warning"
                    title="Address graph API failed, so this view is derived from the token-wide graph around the requested wallet."
                  >
                    Fallback View
                  </span>
                ) : null}
                <span>{footerMapStatus}</span>
              </span>
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
          summaryHolders={displaySummaryNodes}
          tokenInfo={activeTokenInfo}
          availableTokens={availableTokenSymbols}
          selectedTokenSymbol={selectedTokenSymbol}
          onTokenChange={setSelectedTokenSymbol}
          tokenSelectorStatus={tokenSelectorStatus}
          selectedNode={resolvedSelectedNode}
          onNodeSelect={setSelectedNode}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
          onOpenTransactions={() => {
            setIsTransfersModalOpen(true);
            triggerMotionCue("modal");
          }}
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
          isCollapsed={effectiveStatsCollapsed}
          onToggleCollapse={() =>
            setIsStatsCollapsed((collapsed) => !collapsed)
          }
          isLoading={isMapLoading}
          executiveSummary={executiveSummary}
          mapDataStatus={mapDataStatus}
          onRetryMapLoad={handleRetryGraphLoad}
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
