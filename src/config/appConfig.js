import {
  DEFAULT_COINGECKO_SOUL_PRICE_URL,
  DEFAULT_EXPLORER_TOKEN_API_URL,
  DEFAULT_TRACKED_TOKEN_PRICE_API_BASE_URL,
} from "../api/tokenPrices";

export const STATS_PANEL_STORAGE_KEY = "phantasma-maps:stats-panel-collapsed";
export const USER_SKILL_LEVEL_KEY = "phantasma-maps:skill-level";
export const DISCOVERY_HINTS_DISMISSED_KEY =
  "phantasma-maps:discovery-hints-dismissed";
export const COLOR_THEME_STORAGE_KEY = "phantasma-maps:color-theme";
export const TOKEN_SYMBOL_STORAGE_KEY = "phantasma-maps:selected-token-symbol";
export const DENSITY_MODE_STORAGE_KEY = "phantasma-maps:density-mode";
export const ONBOARDING_DISMISSED_STORAGE_KEY = "phantasma-maps:onboarding-dismissed";
export const FOCUS_MODE_STORAGE_KEY = "phantasma-maps:focus-mode";
export const SAVED_VIEWS_STORAGE_KEY = "phantasma-maps:saved-views";
export const TOKEN_SNAPSHOTS_STORAGE_KEY = "phantasma-maps:token-snapshots";
export const TOKEN_SNAPSHOT_HISTORY_STORAGE_KEY =
  "phantasma-maps:token-snapshot-history";
export const TOKEN_SNAPSHOT_HISTORY_LIMIT = 96;
export const TOKEN_SNAPSHOT_HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
export const ALLOWED_COLOR_THEMES = new Set([
  "dark",
  "light",
  "ghost-blue",
  "kcal-red",
]);

function parseEnvMs(raw, fallbackMs) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function parseEnvInt(raw, fallbackValue) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallbackValue;
}

function parseEnvString(raw, fallbackValue = "") {
  if (typeof raw !== "string") return fallbackValue;
  const trimmed = raw.trim();
  if (!trimmed) return fallbackValue;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || fallbackValue;
  }

  return trimmed;
}

export const PHANTASMA_EXPLORER_BASE =
  parseEnvString(import.meta.env.REACT_APP_PHANTASMA_EXPLORER_BASE) ||
  "https://explorer.phantasma.info/address/";
export const PHANTASMA_TX_EXPLORER_BASE =
  parseEnvString(import.meta.env.REACT_APP_PHANTASMA_TX_EXPLORER_BASE) ||
  "https://explorer.phantasma.info/tx/";
export const SOUL_PRICE_API_URL =
  parseEnvString(import.meta.env.REACT_APP_SOUL_PRICE_API_URL) ||
  DEFAULT_COINGECKO_SOUL_PRICE_URL;
const TRACKED_TOKEN_PRICE_API_BASE_URL =
  parseEnvString(import.meta.env.REACT_APP_TRACKED_TOKEN_PRICES_API_URL) ||
  DEFAULT_TRACKED_TOKEN_PRICE_API_BASE_URL;
export const PHANTASMA_EXPLORER_TOKEN_API_URL =
  parseEnvString(import.meta.env.REACT_APP_PHANTASMA_EXPLORER_TOKEN_API_URL) ||
  DEFAULT_EXPLORER_TOKEN_API_URL;
export const TRACKED_TOKEN_PRICE_OPTIONS = {
  baseUrl: TRACKED_TOKEN_PRICE_API_BASE_URL,
  explorerUrl: PHANTASMA_EXPLORER_TOKEN_API_URL,
  network:
    parseEnvString(import.meta.env.REACT_APP_TRACKED_TOKEN_PRICE_NETWORK, "mainnet") ||
    "mainnet",
};
export const SOUL_PRICE_BASE_POLL_INTERVAL_MS = parseEnvMs(
  import.meta.env.REACT_APP_SOUL_PRICE_BASE_POLL_INTERVAL_MS,
  5 * 60 * 1000,
);
export const TRACKED_TOKEN_PRICE_BOOTSTRAP_RETRY_MS = 15000;
export const SOUL_PRICE_MAX_BACKOFF_MS = parseEnvMs(
  import.meta.env.REACT_APP_SOUL_PRICE_MAX_BACKOFF_MS,
  10 * 60 * 1000,
);
const DEFAULT_MAPS_API_BASE_URL =
  typeof window !== "undefined" && window.location
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://127.0.0.1:3000";
export const MAPS_API_BASE_URL =
  parseEnvString(import.meta.env.REACT_APP_MAPS_API_BASE_URL) || DEFAULT_MAPS_API_BASE_URL;
export const DEFAULT_MAPS_API_TOKEN_SYMBOL = (
  parseEnvString(import.meta.env.REACT_APP_MAPS_API_TOKEN_SYMBOL, "SOUL") || "SOUL"
).toUpperCase();
export const MAPS_API_GRAPH_DEPTH = parseEnvInt(import.meta.env.REACT_APP_MAPS_API_GRAPH_DEPTH, 2);
export const MAPS_API_GRAPH_EDGE_LIMIT = parseEnvInt(
  import.meta.env.REACT_APP_MAPS_API_GRAPH_EDGE_LIMIT,
  1200,
);
export const MAPS_API_GRAPH_NODE_LIMIT = parseEnvInt(
  import.meta.env.REACT_APP_MAPS_API_GRAPH_NODE_LIMIT,
  300,
);
export const MAPS_API_GRAPH_TOP_HOLDERS_LIMIT = parseEnvInt(
  import.meta.env.REACT_APP_MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
  100,
);
export const MAPS_API_REQUEST_TIMEOUT_MS = parseEnvMs(
  import.meta.env.REACT_APP_MAPS_API_REQUEST_TIMEOUT_MS,
  45000,
);
export const MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS = parseEnvMs(
  import.meta.env.REACT_APP_MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
  30000,
);
export const TOKEN_METADATA_POLL_INTERVAL_MS = parseEnvMs(
  import.meta.env.REACT_APP_TOKEN_METADATA_POLL_INTERVAL_MS,
  60000,
);
export const MAP_LOADING_COMPLETE_HOLD_MS = 120;
export const MAP_LOADING_EXIT_MS = 190;
export const MAP_LOADING_SLOW_THRESHOLD_MS = 3500;
const MAP_LOADING_SMALL_GRAPH_NODE_THRESHOLD = 80;
const MAP_LOADING_SMALL_GRAPH_LINK_THRESHOLD = 160;
const MAP_LOADING_LARGE_GRAPH_NODE_THRESHOLD = 700;
const MAP_LOADING_LARGE_GRAPH_LINK_THRESHOLD = 1400;
export const TRACE_TOOL_UI_STORAGE_KEY = "phantasma-maps:trace-tool-ui";
export const TRACE_LEGEND_UI_STORAGE_KEY = "phantasma-maps:trace-legend-ui";
export const TRACE_PATH_COLOR_PALETTE = [
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#5f8dff",
  "#ff9f43",
  "#a29bfe",
  "#2ed573",
  "#f368e0",
  "#00d2d3",
  "#ff7f50",
  "#7bed9f",
  "#70a1ff",
];
export const TRACE_PATH_HIGHLIGHT_LIMIT = 120;
export const TRACE_PATH_RENDER_LIMIT = 18;
export const TRACE_PATH_LIST_LIMIT = 100;

export function resolveMapLoadingProfile(nodeCount, linkCount) {
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
      phaseMinVisibleMs: 280,
      minVisibleMs: 480,
      label: "small",
    };
  }

  if (
    safeNodeCount >= MAP_LOADING_LARGE_GRAPH_NODE_THRESHOLD ||
    safeLinkCount >= MAP_LOADING_LARGE_GRAPH_LINK_THRESHOLD
  ) {
    return {
      balancesMax: 35,
      addressesMax: 70,
      showAddressPhase: true,
      phaseMinVisibleMs: 360,
      minVisibleMs: 620,
      label: "large",
    };
  }

  return {
    balancesMax: 45,
    addressesMax: 65,
    showAddressPhase: true,
    phaseMinVisibleMs: 320,
    minVisibleMs: 560,
    label: "medium",
  };
}
