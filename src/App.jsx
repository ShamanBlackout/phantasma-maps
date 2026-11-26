import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import TransactionsModal from "./components/TransactionsModal";
import SelectedNodeCard from "./components/SelectedNodeCard";
import AppShellBar from "./components/AppShellBar";
import SavedViewsPopout from "./components/SavedViewsPopout";
import ComparePopout from "./components/ComparePopout";
import DiagnosticsPopout from "./components/DiagnosticsPopout";
import ExportPresetsPopout from "./components/ExportPresetsPopout";
import CommandPalette from "./components/CommandPalette";
import WelcomeDialog from "./components/WelcomeDialog";
import TourPanel from "./components/TourPanel";
import TraceLegend from "./components/TraceLegend";
import TraceToolForm from "./components/TraceToolForm";
import MapLoadingOverlay from "./components/MapLoadingOverlay";
import MobileInspectSheet from "./components/MobileInspectSheet";
import useTransactionState from "./hooks/useTransactionState";
import useUrlState, { readUrlParams } from "./hooks/useUrlState";
import useTokenMetadataPolling from "./hooks/useTokenMetadataPolling";
import useTokenTopMovers from "./hooks/useTokenTopMovers";
import useAvailableTokens from "./hooks/useAvailableTokens";
import useMapLoadingPhase from "./hooks/useMapLoadingPhase";
import useTokenGraphLoader from "./hooks/useTokenGraphLoader";
import useSoulPricePolling from "./hooks/useSoulPricePolling";
import useTrackedTokenPrice from "./hooks/useTrackedTokenPrice";
import useSyncStatusPolling from "./hooks/useSyncStatusPolling";
import useSelectedNodeTransactions from "./hooks/useSelectedNodeTransactions";
import useSelectedNodeActivity from "./hooks/useSelectedNodeActivity";
import useTraceDbPaths from "./hooks/useTraceDbPaths";
import useCompareSnapshot from "./hooks/useCompareSnapshot";
import usePopoutDismissal from "./hooks/usePopoutDismissal";
import useActiveTokenInfo from "./hooks/useActiveTokenInfo";
import useSelectedNodeTransfers from "./hooks/useSelectedNodeTransfers";
import useFilteredTransactions from "./hooks/useFilteredTransactions";
import useMapRecoveryState from "./hooks/useMapRecoveryState";
import useTraceComputation from "./hooks/useTraceComputation";
import useExecutiveSummary from "./hooks/useExecutiveSummary";
import useCommandPaletteActions from "./hooks/useCommandPaletteActions";
import { ONBOARDING_TUTORIAL_STEPS } from "./data/onboardingSteps";
import {
  applyCurrentSupplyToNodes,
  buildTracePathGraph,
  getLinkKey,
  normalizeAmount,
  shortenAddress,
} from "./graph/graphData";
import {
  fetchTransactionsPageForAddress as fetchTransactionsPageForAddressFromApi,
} from "./api/mapsApi";
import { HOLDER_TYPES, MOCK_TOKEN_SYMBOLS, TOKEN_INFO } from "./data/mockData";
import {
  ALLOWED_COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_MAPS_API_TOKEN_SYMBOL,
  DENSITY_MODE_STORAGE_KEY,
  DISCOVERY_HINTS_DISMISSED_KEY,
  FOCUS_MODE_STORAGE_KEY,
  MAP_LOADING_COMPLETE_HOLD_MS,
  MAP_LOADING_EXIT_MS,
  MAP_LOADING_SLOW_THRESHOLD_MS,
  MAPS_API_BASE_URL,
  MAPS_API_GRAPH_EDGE_LIMIT,
  MAPS_API_GRAPH_NODE_LIMIT,
  MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
  MAPS_API_REQUEST_TIMEOUT_MS,
  MOBILE_MEDIA_QUERY,
  ONBOARDING_DISMISSED_STORAGE_KEY,
  PHANTASMA_EXPLORER_BASE,
  PHANTASMA_TX_EXPLORER_BASE,
  resolveMapLoadingProfile,
  SAVED_VIEWS_STORAGE_KEY,
  STATS_PANEL_STORAGE_KEY,
  TOKEN_SNAPSHOT_HISTORY_STORAGE_KEY,
  TOKEN_SNAPSHOTS_STORAGE_KEY,
  TOKEN_SYMBOL_STORAGE_KEY,
  TRACE_LEGEND_UI_STORAGE_KEY,
  TRACE_PATH_COLOR_PALETTE,
  TRACE_PATH_HIGHLIGHT_LIMIT,
  TRACE_PATH_LIST_LIMIT,
  TRACE_PATH_RENDER_LIMIT,
  TRACE_TOOL_UI_STORAGE_KEY,
  USER_SKILL_LEVEL_KEY,
} from "./config/appConfig";
import {
  fetchTokenSnapshot,
  mergeSnapshotIntoHistory,
  normalizeTokenSnapshot,
  normalizeTokenSnapshotHistory,
} from "./graph/tokenSnapshots";
import {
  fmtSharePct,
  fmtTokenAmount,
  fmtUsdAmount,
  formatUtcDateTime,
  isLikelyWalletAddress,
  makeExportFileName,
  normalizePositiveInteger,
  parseTimestampMs,
  parseUtcDateTimeInput,
  rowsToCsv,
  toUtcDateTimeInputValue,
} from "./lib/format";
import {
  buildApiErrorRecord,
  buildTokenNotFoundStatus,
  isTokenNotFoundError,
} from "./api/apiErrors";
import {
  buildConnectionsGraphFromConnections,
  getLinkEndpointId,
  getMockTokenData,
  limitGraphForDisplay,
} from "./graph/graphBuilders";
import { hashToHue, hslToRgbString } from "./lib/color";
import "./App.css";
import "./styles/feature-polish.css";
import "./styles/ux-improvements.css";
import "./styles/onboarding.css";

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
  const traceLegendPanelRef = useRef(null);
  const pendingMobileFitKeyRef = useRef(null);
  const exportMenuRef = useRef(null);
  const exportStatusTimeoutRef = useRef(null);
  const dirFilterRef = useRef(null);
  const counterpartyFilterRef = useRef(null);
  const timeFilterRef = useRef(null);
  const amountFilterRef = useRef(null);
  const usdFilterRef = useRef(null);
  const selectedNodeActivityCacheRef = useRef(new Map());
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
  const [trackedTokenQuotes, setTrackedTokenQuotes] = useState({});
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
  const [connectionMinAmount, setConnectionMinAmount] = useState("");
  const [isTransactionsExporting, setIsTransactionsExporting] = useState(false);
  const [transactionsExportStatus, setTransactionsExportStatus] = useState("");
  const [selectedNodeSparkline, setSelectedNodeSparkline] = useState([]);
  const [isSelectedNodeActivityLoading, setIsSelectedNodeActivityLoading] =
    useState(false);
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
  const [isGraphEnrichmentEnabled, setIsGraphEnrichmentEnabled] =
    useState(false);
  const [isGraphEnrichmentLoading, setIsGraphEnrichmentLoading] =
    useState(false);
  const [overallMaxGraphStats, setOverallMaxGraphStats] = useState({
    wallets: 0,
    connections: 0,
  });
  const [isConnectionsView, setIsConnectionsView] = useState(
    () =>
      (!String(initialUrlParams.traceFrom || "").trim() ||
        !String(initialUrlParams.traceTo || "").trim()) &&
      (String(initialUrlParams.view || "token").trim() === "connections" ||
        Boolean(String(initialUrlParams.rootAddress || "").trim())),
  );
  const [connectionsGraphContext, setConnectionsGraphContext] = useState(null);
  const activeGraphRootAddress = useMemo(
    () => String(searchedRootAddress || "").trim(),
    [searchedRootAddress],
  );
  const canEnhanceTopLevelGraph =
    !isConnectionsView &&
    !String(activeGraphRootAddress || "").trim() &&
    !isGraphMaxModeEnabled &&
    MAPS_API_GRAPH_TOP_HOLDERS_LIMIT > 0;
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
  const [discoveryHintsDismissed] = useState(() => {
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
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
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
  const [traceFromQuery, setTraceFromQuery] = useState(() =>
    String(initialUrlParams.traceFrom || "").trim(),
  );
  const [traceToQuery, setTraceToQuery] = useState(() =>
    String(initialUrlParams.traceTo || "").trim(),
  );
  const [traceStopMode, setTraceStopMode] = useState(() =>
    String(initialUrlParams.traceStop || "").trim() === "through"
      ? "through"
      : "terminal",
  );
  const [isTraceToolOpen, setIsTraceToolOpen] = useState(() =>
    Boolean(
      String(initialUrlParams.traceFrom || "").trim() &&
      String(initialUrlParams.traceTo || "").trim(),
    ),
  );
  const [traceToolPosition, setTraceToolPosition] = useState(() => {
    if (typeof window === "undefined") {
      return { left: 12, top: 74 };
    }

    return {
      left: Math.max(12, window.innerWidth - 372),
      top: 74,
    };
  });
  const [isTraceLegendMinimized, setIsTraceLegendMinimized] = useState(() => {
    try {
      return (
        JSON.parse(
          window.localStorage.getItem(TRACE_LEGEND_UI_STORAGE_KEY) || "{}",
        )?.isMinimized === true
      );
    } catch {
      return false;
    }
  });
  const [traceLegendPosition, setTraceLegendPosition] = useState(() => {
    if (typeof window === "undefined") {
      return { left: 12, top: 74 };
    }

    return {
      left: Math.max(12, window.innerWidth - 372),
      top: 74,
    };
  });
  const traceLegendDragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });
  const [traceStatusMessage, setTraceStatusMessage] = useState("");
  const [traceDbPaths, setTraceDbPaths] = useState([]);
  const [isTraceDbPathsLoading, setIsTraceDbPathsLoading] = useState(false);
  const [selectedTraceDbPathKey, setSelectedTraceDbPathKey] = useState(() =>
    String(initialUrlParams.tracePath || "").trim(),
  );
  const [traceSearchNonce, setTraceSearchNonce] = useState(0);
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
  const [tokenSnapshotHistory, setTokenSnapshotHistory] = useState(() => {
    try {
      const raw = window.localStorage.getItem(
        TOKEN_SNAPSHOT_HISTORY_STORAGE_KEY,
      );
      const parsed = JSON.parse(raw || "{}");
      return normalizeTokenSnapshotHistory(parsed);
    } catch {
      return {};
    }
  });
  const [tokenAnalyticsTopMovers, setTokenAnalyticsTopMovers] = useState({});
  const [, setTokenAnalyticsTopMoversStatus] = useState("");
  const [isTokenTopMoversLoading, setIsTokenTopMoversLoading] = useState(false);
  const [topMoversHorizon, setTopMoversHorizon] = useState("7d");
  const [topMoversMode, setTopMoversMode] = useState("net");
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
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
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
    setIsGraphEnrichmentEnabled(false);
    setIsGraphEnrichmentLoading(false);
  }, [
    selectedTokenSymbol,
    isConnectionsView,
    activeGraphRootAddress,
    isGraphMaxModeEnabled,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TRACE_LEGEND_UI_STORAGE_KEY,
        JSON.stringify({
          left: traceLegendPosition.left,
          top: traceLegendPosition.top,
          isMinimized: isTraceLegendMinimized,
        }),
      );
    } catch {
      // Ignore storage access issues and keep the palette state in memory.
    }
  }, [isTraceLegendMinimized, traceLegendPosition]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TRACE_TOOL_UI_STORAGE_KEY,
        JSON.stringify({
          left: traceToolPosition.left,
          top: traceToolPosition.top,
        }),
      );
    } catch {
      // Ignore storage access issues and keep the palette state in memory.
    }
  }, [traceToolPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const paletteWidth = isTraceLegendMinimized ? 280 : 360;
    const paletteHeight = isTraceLegendMinimized ? 110 : 340;
    const maxLeft = Math.max(12, window.innerWidth - paletteWidth - 12);
    const maxTop = Math.max(12, window.innerHeight - paletteHeight - 12);

    let storedPosition = null;
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(TRACE_LEGEND_UI_STORAGE_KEY) || "{}",
      );
      const left = Number(parsed?.left);
      const top = Number(parsed?.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        storedPosition = { left, top };
      }
    } catch {
      storedPosition = null;
    }

    const nextPosition = storedPosition || { left: 12, top: 74 };
    setTraceLegendPosition({
      left: Math.min(Math.max(12, nextPosition.left), maxLeft),
      top: Math.min(Math.max(12, nextPosition.top), maxTop),
    });
  }, [isTraceLegendMinimized, isTraceToolOpen, traceDbPaths.length]);

  useEffect(() => {
    function clampTraceLegendPosition() {
      setTraceLegendPosition((current) => {
        const minWidth = isTraceLegendMinimized ? 260 : 380;
        const maxLeft = Math.max(12, window.innerWidth - minWidth - 12);
        const maxTop = Math.max(12, window.innerHeight - 84);
        return {
          left: Math.min(Math.max(12, current.left), maxLeft),
          top: Math.min(Math.max(12, current.top), maxTop),
        };
      });
    }

    window.addEventListener("resize", clampTraceLegendPosition);
    return () => window.removeEventListener("resize", clampTraceLegendPosition);
  }, [isTraceLegendMinimized]);

  const isTracePaletteDocked =
    viewportSize.width > 0 && viewportSize.width <= 768;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setTraceToolPosition({ left: 12, top: 74 });
  }, [isTraceToolOpen]);

  useEffect(() => {
    function clampTraceToolPosition() {
      setTraceToolPosition((current) => {
        const minWidth = 360;
        const minHeight = 420;
        const maxLeft = Math.max(12, window.innerWidth - minWidth - 12);
        const maxTop = Math.max(12, window.innerHeight - minHeight - 12);
        return {
          left: Math.min(Math.max(12, current.left), maxLeft),
          top: Math.min(Math.max(12, current.top), maxTop),
        };
      });
    }

    window.addEventListener("resize", clampTraceToolPosition);
    return () => window.removeEventListener("resize", clampTraceToolPosition);
  }, []);

  const handleTraceLegendPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target.closest?.("button, input, select, textarea, a, label")) {
        return;
      }

      const targetRect = event.currentTarget
        .closest(".map-trace-legend")
        ?.getBoundingClientRect();
      if (!targetRect) return;

      event.preventDefault();
      traceLegendDragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: traceLegendPosition.left,
        startTop: traceLegendPosition.top,
      };

      const handleMove = (moveEvent) => {
        if (!traceLegendDragRef.current.active) return;
        const deltaX = moveEvent.clientX - traceLegendDragRef.current.startX;
        const deltaY = moveEvent.clientY - traceLegendDragRef.current.startY;
        const panelWidth = isTraceLegendMinimized ? 260 : 380;
        const panelHeight = isTraceLegendMinimized ? 72 : 340;
        const nextLeft = Math.min(
          Math.max(12, traceLegendDragRef.current.startLeft + deltaX),
          Math.max(12, window.innerWidth - panelWidth - 12),
        );
        const nextTop = Math.min(
          Math.max(12, traceLegendDragRef.current.startTop + deltaY),
          Math.max(12, window.innerHeight - panelHeight - 12),
        );
        setTraceLegendPosition({ left: nextLeft, top: nextTop });
      };

      const handleUp = () => {
        traceLegendDragRef.current.active = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    },
    [isTraceLegendMinimized, traceLegendPosition.left, traceLegendPosition.top],
  );

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
      window.localStorage.setItem(
        TOKEN_SNAPSHOT_HISTORY_STORAGE_KEY,
        JSON.stringify(tokenSnapshotHistory),
      );
    } catch {
      // Ignore storage issues and keep snapshot history in memory.
    }
  }, [tokenSnapshotHistory]);

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
    }, 420);
  }, []);

  const urlStateOptions = useMemo(
    () => ({
      isConnectionsView,
      searchQuery,
      activeLegendFilter: activeHolderTypeFilter,
      densityMode,
      transactionDirFilter,
      transactionCounterpartyFilter,
      traceFromAddress: isLikelyWalletAddress(
        String(traceFromQuery || "").trim(),
      )
        ? String(traceFromQuery || "").trim()
        : String(traceFromNodeId || "").trim(),
      traceToAddress: isLikelyWalletAddress(String(traceToQuery || "").trim())
        ? String(traceToQuery || "").trim()
        : String(traceToNodeId || "").trim(),
      traceStopMode,
      selectedTraceDbPathKey,
    }),
    [
      activeHolderTypeFilter,
      densityMode,
      isConnectionsView,
      selectedTraceDbPathKey,
      searchQuery,
      traceFromNodeId,
      traceFromQuery,
      traceStopMode,
      traceToNodeId,
      traceToQuery,
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

  useTokenMetadataPolling({
    selectedTokenSymbol,
    setApiTokenInfo,
    setLastApiError,
    setPriceLastUpdatedAt,
  });

  useTokenTopMovers({
    selectedTokenSymbol,
    setIsTokenTopMoversLoading,
    setTokenAnalyticsTopMovers,
    setTokenAnalyticsTopMoversStatus,
  });

  const currentTokenTopMovers = useMemo(() => {
    const currentKey = String(selectedTokenSymbol || "").trim();
    if (!currentKey) return [];
    const byHorizon = tokenAnalyticsTopMovers[currentKey];
    if (!byHorizon) return [];
    const horizonData = byHorizon[topMoversHorizon] || [];
    return horizonData.filter((mover) => {
      if (topMoversMode === "inflows") return mover.deltaBalance > 0;
      if (topMoversMode === "outflows") return mover.deltaBalance < 0;
      return true;
    });
  }, [
    selectedTokenSymbol,
    tokenAnalyticsTopMovers,
    topMoversHorizon,
    topMoversMode,
  ]);

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
      setIsTraceToolOpen(false);
      setSelectedTraceDbPathKey("");
      setTraceFromNodeId("");
      setTraceToNodeId("");
      setTraceFromQuery("");
      setTraceToQuery("");
      setTraceDbPaths([]);
      setTraceStatusMessage("");
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

    setIsTraceToolOpen(false);
    setSelectedTraceDbPathKey("");
    setTraceFromNodeId("");
    setTraceToNodeId("");
    setTraceFromQuery("");
    setTraceToQuery("");
    setTraceDbPaths([]);
    setTraceStatusMessage("");
    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress(value);
    setIsConnectionsView(true);
    triggerMotionCue("connections");
  }

  function handleGoToInitialSoulGraph() {
    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress("");
    setIsConnectionsView(false);
    setConnectionMinAmount("");
    setConnectionsGraphContext(null);
    setIsGraphMaxModeEnabled(false);
    setGraphEdgeLimit(MAPS_API_GRAPH_EDGE_LIMIT);
    setGraphNodeLimit(MAPS_API_GRAPH_NODE_LIMIT);
    setSelectedTokenSymbol(DEFAULT_MAPS_API_TOKEN_SYMBOL);
  }

  const handleRetryGraphLoad = useCallback(() => {
    setMapRefreshNonce((current) => current + 1);
    setMapDataStatus("Retrying graph request...");
  }, []);

  const handleResetConnectionMinimum = useCallback(() => {
    setConnectionMinAmount("");
  }, []);

  const connectionMinPresets = useMemo(
    () => [
      { label: "50k", value: "50000" },
      { label: "100k", value: "100000" },
      { label: "500k", value: "500000" },
      { label: "1M", value: "1000000" },
    ],
    [],
  );

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

  useAvailableTokens({
    selectedTokenSymbol,
    setApiTokenSymbols,
    setLastApiError,
    setSelectedTokenSymbol,
    setTokenSelectorStatus,
  });

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

  const activeTokenInfo = useActiveTokenInfo({
    apiTokenInfo,
    isUsingMockApiFallback,
    liveTokenInfo,
    selectedMockTokenData,
    selectedTokenSymbol,
    trackedTokenQuotes,
    trackedTokenSupply,
  });

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
      return undefined;
    }

    setIsMapLoadingSlow(false);

    const slowTimerId = window.setTimeout(() => {
      setIsMapLoadingSlow(true);
    }, MAP_LOADING_SLOW_THRESHOLD_MS);

    return () => {
      window.clearTimeout(slowTimerId);
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
  useMapLoadingPhase({
    isMapLoaderVisible,
    mapLoadingDisplayedPhase,
    mapLoadingPhaseShownAtRef,
    mapLoadingPhaseTarget,
    mapLoadingProfile,
    setMapLoadingDisplayedPhase,
  });

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

  useTokenGraphLoader({
    activeGraphRootAddress,
    activeTokenInfo,
    apiTokenInfo,
    graphEdgeLimit,
    graphNodeLimit,
    isConnectionsView,
    isGraphEnrichmentEnabled,
    isGraphMaxModeEnabled,
    mapRefreshNonce,
    searchedRootAddress,
    selectedMockTokenData,
    selectedTokenSymbol,
    setConnectionsGraphContext,
    setHoveredNode,
    setIsGraphEnrichmentEnabled,
    setIsGraphEnrichmentLoading,
    setIsMapLoading,
    setIsMapLoadingReadyState,
    setIsUsingMockApiFallback,
    setLastApiError,
    setMapDataStatus,
    setMapLinks,
    setMapLoadingDisplayedPhase,
    setMapLoadingEvidence,
    setMapLoadingProfile,
    setMapLoadingProgress,
    setMapNodes,
    setOverallMaxGraphStats,
    setSelectedNode,
    setSummaryNodes,
    setTokenSelectorStatus,
    setTrackedTokenSupply,
  });

  useSoulPricePolling({
    setLiveTokenInfo,
    setPriceLastUpdatedAt,
  });

  useTrackedTokenPrice({
    selectedTokenSymbol,
    setPriceLastUpdatedAt,
    setTrackedTokenQuotes,
  });

  useSyncStatusPolling({
    setBlockSyncHeight,
    setBlockSyncTargetHeight,
    setBlockSyncUpdatedAt,
    setLastApiError,
  });

  useEffect(() => {
    if (!isConnectionsView || !connectionsGraphContext) return;

    const minimumAmount = normalizeAmount(connectionMinAmount);
    const filteredGraph = buildConnectionsGraphFromConnections(
      connectionsGraphContext.items,
      connectionsGraphContext.rootAddress,
      connectionsGraphContext.fallbackGraph,
      connectionsGraphContext.currentSupply,
      minimumAmount,
    );

    if (filteredGraph && Array.isArray(filteredGraph.nodes)) {
      setIsUsingMockApiFallback(false);
      setMapNodes(filteredGraph.nodes);
      setSummaryNodes(filteredGraph.nodes);
      setMapLinks(filteredGraph.links);
      setMapLoadingEvidence({
        wallets: filteredGraph.nodes.length,
        links: Array.isArray(filteredGraph.links)
          ? filteredGraph.links.length
          : 0,
      });
      setTrackedTokenSupply(filteredGraph.totalValue || 0);
      setMapDataStatus(
        minimumAmount > 0
          ? `Live graph loaded for ${shortenAddress(connectionsGraphContext.rootAddress)} [connections filtered by balance >= ${fmtTokenAmount(minimumAmount)} ${activeTokenInfo.name}]`
          : `Live graph loaded for ${shortenAddress(connectionsGraphContext.rootAddress)} [connections-phase:table]`,
      );
      return;
    }

    if (minimumAmount > 0) {
      setIsUsingMockApiFallback(false);
      setMapNodes([]);
      setSummaryNodes([]);
      setMapLinks([]);
      setMapLoadingEvidence({ wallets: 0, links: 0 });
      setTrackedTokenSupply(0);
      setMapDataStatus(
        `No connections meet the minimum balance of ${fmtTokenAmount(minimumAmount)} ${activeTokenInfo.name}.`,
      );
    }
  }, [
    activeTokenInfo.name,
    connectionMinAmount,
    connectionsGraphContext,
    isConnectionsView,
  ]);

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

  const buildTraceSearchOptions = useCallback(
    (query, selectedId) => {
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
    },
    [filteredNodes],
  );

  const traceFromOptions = useMemo(
    () => buildTraceSearchOptions(traceFromQuery, traceFromNodeId),
    [buildTraceSearchOptions, traceFromNodeId, traceFromQuery],
  );

  const traceToOptions = useMemo(
    () => buildTraceSearchOptions(traceToQuery, traceToNodeId),
    [buildTraceSearchOptions, traceToNodeId, traceToQuery],
  );

  const traceFromAddress = useMemo(() => {
    const typed = String(traceFromQuery || "").trim();
    if (isLikelyWalletAddress(typed)) return typed;
    const selected = String(traceFromNodeId || "").trim();
    if (selected) return selected;
    return "";
  }, [traceFromNodeId, traceFromQuery]);

  const traceToAddress = useMemo(() => {
    const typed = String(traceToQuery || "").trim();
    if (isLikelyWalletAddress(typed)) return typed;
    const selected = String(traceToNodeId || "").trim();
    if (selected) return selected;
    return "";
  }, [traceToNodeId, traceToQuery]);

  const isTraceSearchReady = useMemo(
    () =>
      Boolean(
        traceFromAddress &&
        traceToAddress &&
        traceFromAddress !== traceToAddress,
      ),
    [traceFromAddress, traceToAddress],
  );

  function handleTraceToolSubmit(event) {
    event.preventDefault();

    if (!traceFromAddress || !traceToAddress) {
      setTraceDbPaths([]);
      setTraceStatusMessage("Enter or select both wallets to trace.");
      return;
    }

    if (traceFromAddress === traceToAddress) {
      setTraceDbPaths([]);
      setTraceStatusMessage("Enter two different wallet addresses to trace.");
      return;
    }

    setTraceStatusMessage("Searching database paths...");
    setSelectedTraceDbPathKey("");
    setTraceSearchNonce((current) => current + 1);
  }

  function handleShowTraceDbPath(nodePath) {
    const normalizedPath = Array.isArray(nodePath)
      ? nodePath.map((nodeId) => String(nodeId || "").trim()).filter(Boolean)
      : [];

    if (normalizedPath.length < 2) {
      setSelectedTraceDbPathKey("");
      return;
    }

    setSearchedRootAddress("");
    setIsConnectionsView(false);
    setConnectionsGraphContext(null);
    setConnectionMinAmount("");
    setSelectedTraceDbPathKey(normalizedPath.join("->"));
  }

  function handleShowAllTraceDbPaths() {
    setSelectedTraceDbPathKey("");
  }

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

  useSelectedNodeTransactions({
    activeTokenInfo,
    selectedNode,
    selectedTokenSymbol,
    setIsSelectedNodeTransactionsLoading,
    setLastApiError,
    setSelectedNodeApiTransactions,
    setSelectedNodeApiTransactionsError,
    setSelectedNodeApiTransactionsTotal,
    transactionCounterpartyFilter,
    transactionDirFilter,
    transactionEndTime,
    transactionMaxAmount,
    transactionMaxUsd,
    transactionMinAmount,
    transactionMinUsd,
    transactionPage,
    transactionSortBy,
    transactionSortDirection,
    transactionStartTime,
  });

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

  const selectedNodeTransfers = useSelectedNodeTransfers({
    activeTokenInfo,
    fallbackSelectedNodeTransfers,
    nodeById,
    selectedNode,
    selectedNodeApiTransactions,
    selectedNodeApiTransactionsError,
  });

  const filteredTransactions = useFilteredTransactions({
    selectedNode,
    selectedNodeApiTransactionsError,
    selectedNodeTransfers,
    transactionCounterpartyFilter,
    transactionDirFilter,
    transactionEndTime,
    transactionMaxAmount,
    transactionMaxUsd,
    transactionMinAmount,
    transactionMinUsd,
    transactionSortBy,
    transactionSortDirection,
    transactionStartTime,
  });

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

  const handleClearConnections = useCallback(() => {
    setSearchQuery("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress("");
    setIsConnectionsView(false);
    setConnectionMinAmount("");
    setConnectionsGraphContext(null);
  }, [closeTransfersModal]);

  useEffect(() => {
    const initialRootAddress = String(
      initialRootAddressFromUrlRef.current || "",
    ).trim();
    const hasInitialTracePair =
      Boolean(String(initialUrlParams.traceFrom || "").trim()) &&
      Boolean(String(initialUrlParams.traceTo || "").trim());
    if (!initialRootAddress) return;
    if (hasInitialTracePair) {
      initialRootAddressFromUrlRef.current = null;
      return;
    }

    setSearchQuery("");
    setIsTraceToolOpen(false);
    setSelectedTraceDbPathKey("");
    setTraceFromNodeId("");
    setTraceToNodeId("");
    setTraceFromQuery("");
    setTraceToQuery("");
    setTraceDbPaths([]);
    setTraceStatusMessage("");
    setActiveHolderTypeFilter("");
    setHoveredNode(null);
    setSelectedNode(null);
    closeTransfersModal();
    setSearchedRootAddress(initialRootAddress);
    setIsConnectionsView(true);

    initialRootAddressFromUrlRef.current = null;
  }, [
    closeTransfersModal,
    initialUrlParams.traceFrom,
    initialUrlParams.traceTo,
  ]);

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

  function mapTransactionsToExportRows(transactions) {
    return transactions.map((tx) => ({
      direction: tx.direction,
      counterparty: tx.counterpartLabel,
      address: tx.counterpartAddress || tx.counterpartAddr,
      time: tx.timeUtc,
      token: tx.token,
      amount: tx.amount,
      usdNow: tx.usd,
      transactionHash: tx.transactionHash,
    }));
  }

  async function buildExportRows() {
    if (
      !isUsingApiTransactions ||
      selectedNodeApiTransactionsError ||
      !selectedNode?.id
    ) {
      return mapTransactionsToExportRows(filteredTransactions);
    }

    const startTs = parseUtcDateTimeInput(transactionStartTime);
    const endTs = parseUtcDateTimeInput(transactionEndTime);
    const minAmount =
      transactionMinAmount === "" ? null : Number(transactionMinAmount);
    const maxAmount =
      transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
    const minUsd = transactionMinUsd === "" ? null : Number(transactionMinUsd);
    const maxUsd = transactionMaxUsd === "" ? null : Number(transactionMaxUsd);

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

    const pageSize = 100;
    const firstPage = await fetchTransactionsPageForAddressFromApi(
      MAPS_API_BASE_URL,
      MAPS_API_REQUEST_TIMEOUT_MS,
      selectedNode.id,
      selectedTokenSymbol,
      {
        page: 1,
        pageSize,
        filters: apiFilters,
      },
    );

    const allItems = Array.isArray(firstPage.items) ? [...firstPage.items] : [];
    const total = Number(firstPage.total);
    const totalPages =
      Number.isFinite(total) && total > 0 ? Math.ceil(total / pageSize) : 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const pageData = await fetchTransactionsPageForAddressFromApi(
        MAPS_API_BASE_URL,
        MAPS_API_REQUEST_TIMEOUT_MS,
        selectedNode.id,
        selectedTokenSymbol,
        {
          page,
          pageSize,
          filters: apiFilters,
        },
      );
      if (Array.isArray(pageData.items) && pageData.items.length) {
        allItems.push(...pageData.items);
      }
    }

    const exportTransactions = allItems.map((transaction, index) => {
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

    return mapTransactionsToExportRows(exportTransactions);
  }

  function downloadBlobFile(content, mimeType, fileName) {
    const blob =
      content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function exportTransactions(format) {
    if (isTransactionsExporting) {
      return;
    }

    let rows;
    setIsTransactionsExporting(true);
    setTransactionsExportStatus("Exporting transactions...");

    try {
      rows = await buildExportRows();
    } catch (error) {
      setLastApiError(
        buildApiErrorRecord(error, "transactions", "Transaction export failed"),
      );
      setTransactionsExportStatus(
        isTokenNotFoundError(error)
          ? buildTokenNotFoundStatus(selectedTokenSymbol, error)
          : "Export failed. Please try again.",
      );
      setIsExportMenuOpen(false);
      setIsTransactionsExporting(false);
      if (exportStatusTimeoutRef.current) {
        window.clearTimeout(exportStatusTimeoutRef.current);
      }
      exportStatusTimeoutRef.current = window.setTimeout(() => {
        setTransactionsExportStatus("");
      }, 3000);
      return;
    }

    try {
      if (format === "json") {
        const json = JSON.stringify(rows, null, 2);
        downloadBlobFile(
          json,
          "application/json;charset=utf-8",
          makeExportFileName(selectedNode, "json"),
        );
        setTransactionsExportStatus(
          `Export complete (${Number(rows.length || 0).toLocaleString()} rows).`,
        );
        setIsExportMenuOpen(false);
        if (exportStatusTimeoutRef.current) {
          window.clearTimeout(exportStatusTimeoutRef.current);
        }
        exportStatusTimeoutRef.current = window.setTimeout(() => {
          setTransactionsExportStatus("");
        }, 2200);
        return;
      }

      if (format === "csv" || format === "excel") {
        const headers = [
          "Direction",
          "Counterparty",
          "Address",
          "Time",
          "Token",
          "Amount",
          "USD (Now)",
          "Transaction Hash",
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
        setTransactionsExportStatus(
          `Export complete (${Number(rows.length || 0).toLocaleString()} rows).`,
        );
        setIsExportMenuOpen(false);
        if (exportStatusTimeoutRef.current) {
          window.clearTimeout(exportStatusTimeoutRef.current);
        }
        exportStatusTimeoutRef.current = window.setTimeout(() => {
          setTransactionsExportStatus("");
        }, 2200);
        return;
      }

      setTransactionsExportStatus("");
    } catch (error) {
      setLastApiError(
        buildApiErrorRecord(error, "transactions", "Transaction export failed"),
      );
      setTransactionsExportStatus("Export failed. Please try again.");
      setIsExportMenuOpen(false);
      if (exportStatusTimeoutRef.current) {
        window.clearTimeout(exportStatusTimeoutRef.current);
      }
      exportStatusTimeoutRef.current = window.setTimeout(() => {
        setTransactionsExportStatus("");
      }, 3000);
    } finally {
      setIsTransactionsExporting(false);
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
      setIsTransactionsExporting(false);
      setTransactionsExportStatus("");
      resetTransactionState();
    }
  }, [resetTransactionState, selectedNode]);

  useEffect(() => {
    return () => {
      if (exportStatusTimeoutRef.current) {
        window.clearTimeout(exportStatusTimeoutRef.current);
      }
    };
  }, []);

  useSelectedNodeActivity({
    selectedNode,
    selectedNodeActivityCacheRef,
    selectedTokenSymbol,
    setIsSelectedNodeActivityLoading,
    setLastApiError,
    setSelectedNodeSparkline,
  });

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

  const hasMapError = useMemo(() => {
    const statusText = String(mapDataStatus || "").toLowerCase();
    return (
      statusText.includes("failed") ||
      statusText.includes("unavailable") ||
      statusText.includes("unable")
    );
  }, [mapDataStatus]);

  const mapRecoveryState = useMapRecoveryState({
    activeHolderTypeFilter,
    activeTokenInfo,
    connectionMinAmount,
    filteredNodes,
    handleClearConnections,
    handleRetryGraphLoad,
    hasMapError,
    isConnectionsView,
    isMapLoading,
    searchQuery,
    setActiveHolderTypeFilter,
    setSearchQuery,
  });

  const traceComputation = useTraceComputation({
    filteredLinks,
    traceFromNodeId,
    traceToNodeId,
  });

  const selectedTraceDbPath = useMemo(() => {
    if (!selectedTraceDbPathKey) {
      return null;
    }

    return (
      traceDbPaths.find((item) => {
        const nodePath = Array.isArray(item?.nodePath) ? item.nodePath : [];
        return nodePath.join("->") === selectedTraceDbPathKey;
      }) || null
    );
  }, [selectedTraceDbPathKey, traceDbPaths]);

  const tracePathKnownNodesById = useMemo(() => {
    const nodeMap = new Map();

    [
      ...displaySummaryNodes,
      ...displayNodes,
      ...legendScopedDisplayGraph.nodes,
    ].forEach((node) => {
      const nodeId = String(node?.id || "").trim();
      if (!nodeId || nodeMap.has(nodeId)) {
        return;
      }

      nodeMap.set(nodeId, node);
    });

    return nodeMap;
  }, [displayNodes, displaySummaryNodes, legendScopedDisplayGraph.nodes]);

  const selectedTraceDbPathGraph = useMemo(
    () =>
      buildTracePathGraph(
        selectedTraceDbPath ? [selectedTraceDbPath] : [],
        tracePathKnownNodesById,
      ),
    [selectedTraceDbPath, tracePathKnownNodesById],
  );

  const selectedTraceDbPathRender = useMemo(() => {
    if (!selectedTraceDbPathGraph) {
      return null;
    }

    const nodeIds = selectedTraceDbPathGraph.nodes.map((node) => node.id);
    const linkKeys = selectedTraceDbPathGraph.links.flatMap((link) => [
      getLinkKey(link.source, link.target),
      getLinkKey(link.target, link.source),
    ]);

    return {
      nodeIds,
      linkKeys,
      pathKey:
        selectedTraceDbPath?.nodePath?.join("->") || "selected-trace-db-path",
      status: "Showing the selected database path as a focused graph.",
    };
  }, [selectedTraceDbPath, selectedTraceDbPathGraph]);

  const traceRenderableDbPaths = useMemo(() => {
    if (!Array.isArray(traceDbPaths) || !traceDbPaths.length) {
      return [];
    }

    return traceDbPaths
      .filter(
        (item) => Array.isArray(item?.nodePath) && item.nodePath.length >= 2,
      )
      .slice(0, TRACE_PATH_HIGHLIGHT_LIMIT)
      .sort((left, right) => {
        const leftHopCount = Number(left?.hopCount) || 0;
        const rightHopCount = Number(right?.hopCount) || 0;
        if (leftHopCount !== rightHopCount) {
          return leftHopCount - rightHopCount;
        }

        const leftVolume = Number(left?.totalVolume) || 0;
        const rightVolume = Number(right?.totalVolume) || 0;
        return rightVolume - leftVolume;
      })
      .slice(0, TRACE_PATH_RENDER_LIMIT);
  }, [traceDbPaths]);

  const traceListedDbPaths = useMemo(() => {
    if (!Array.isArray(traceDbPaths) || !traceDbPaths.length) {
      return [];
    }

    return traceDbPaths
      .filter(
        (item) => Array.isArray(item?.nodePath) && item.nodePath.length >= 2,
      )
      .slice(0, TRACE_PATH_HIGHLIGHT_LIMIT)
      .sort((left, right) => {
        const leftHopCount = Number(left?.hopCount) || 0;
        const rightHopCount = Number(right?.hopCount) || 0;
        if (leftHopCount !== rightHopCount) {
          return leftHopCount - rightHopCount;
        }

        const leftVolume = Number(left?.totalVolume) || 0;
        const rightVolume = Number(right?.totalVolume) || 0;
        return rightVolume - leftVolume;
      })
      .slice(0, TRACE_PATH_LIST_LIMIT);
  }, [traceDbPaths]);

  const traceDbPathHighlights = useMemo(() => {
    if (!traceListedDbPaths.length) {
      return [];
    }

    return traceRenderableDbPaths.flatMap((item, index) => {
      const nodePath = Array.isArray(item?.nodePath)
        ? item.nodePath
            .map((nodeId) => String(nodeId || "").trim())
            .filter(Boolean)
        : [];

      if (nodePath.length < 2) {
        return [];
      }

      const linkKeys = [];
      for (let nodeIndex = 0; nodeIndex < nodePath.length - 1; nodeIndex += 1) {
        const source = nodePath[nodeIndex];
        const target = nodePath[nodeIndex + 1];
        linkKeys.push(getLinkKey(source, target), getLinkKey(target, source));
      }

      return {
        pathKey: nodePath.join("->"),
        color:
          TRACE_PATH_COLOR_PALETTE[index % TRACE_PATH_COLOR_PALETTE.length],
        nodeIds: nodePath,
        linkKeys,
      };
    });
  }, [traceListedDbPaths.length, traceRenderableDbPaths]);

  const traceRenderableDbPathsGraph = useMemo(
    () => buildTracePathGraph(traceRenderableDbPaths, tracePathKnownNodesById),
    [tracePathKnownNodesById, traceRenderableDbPaths],
  );

  const renderedGraphNodes =
    traceRenderableDbPathsGraph?.nodes || filteredNodes;
  const renderedGraphLinks =
    traceRenderableDbPathsGraph?.links || filteredLinks;
  const hasTraceDbPathsGraph = Boolean(traceRenderableDbPathsGraph);

  useEffect(() => {
    if (!selectedNode) return;
    const stillExists = renderedGraphNodes.some(
      (node) => node.id === selectedNode.id,
    );
    if (!stillExists) {
      setSelectedNode(null);
    }
  }, [renderedGraphNodes, selectedNode]);

  const primaryTraceDbPathNodePath = useMemo(() => {
    if (
      Array.isArray(selectedTraceDbPath?.nodePath) &&
      selectedTraceDbPath.nodePath.length
    ) {
      return selectedTraceDbPath.nodePath;
    }

    const firstRankedTracePath = traceListedDbPaths[0];
    return Array.isArray(firstRankedTracePath?.nodePath)
      ? firstRankedTracePath.nodePath
      : [];
  }, [selectedTraceDbPath, traceListedDbPaths]);

  const executiveSummary = useExecutiveSummary({
    currentSupplyBase,
    hasTraceDbPathsGraph,
    renderedGraphLinks,
    renderedGraphNodes,
  });

  const activeTracePathHighlights = useMemo(() => {
    if (traceDbPathHighlights.length) {
      if (selectedTraceDbPathKey) {
        const selectedHighlight = traceDbPathHighlights.find(
          (path) => path.pathKey === selectedTraceDbPathKey,
        );
        if (selectedHighlight) {
          return [selectedHighlight];
        }
      }
      return traceDbPathHighlights;
    }

    if (selectedTraceDbPathRender?.nodeIds?.length > 0) {
      return [
        {
          pathKey:
            selectedTraceDbPathRender.pathKey || "selected-trace-db-path",
          color: TRACE_PATH_COLOR_PALETTE[0],
          nodeIds: selectedTraceDbPathRender.nodeIds,
          linkKeys: selectedTraceDbPathRender.linkKeys,
        },
      ];
    }

    if (traceComputation.nodeIds.length) {
      return [
        {
          pathKey: "local-trace",
          color: TRACE_PATH_COLOR_PALETTE[0],
          nodeIds: traceComputation.nodeIds,
          linkKeys: traceComputation.linkKeys,
        },
      ];
    }

    return [];
  }, [
    selectedTraceDbPathRender,
    selectedTraceDbPathKey,
    traceComputation.linkKeys,
    traceComputation.nodeIds,
    traceDbPathHighlights,
  ]);

  const activeTraceNodeIds = useMemo(
    () =>
      Array.from(
        new Set(
          activeTracePathHighlights.flatMap((path) =>
            Array.isArray(path?.nodeIds) ? path.nodeIds : [],
          ),
        ),
      ),
    [activeTracePathHighlights],
  );

  const activeTraceLinkKeys = useMemo(
    () =>
      Array.from(
        new Set(
          activeTracePathHighlights.flatMap((path) =>
            Array.isArray(path?.linkKeys) ? path.linkKeys : [],
          ),
        ),
      ),
    [activeTracePathHighlights],
  );

  const activeTraceStatus =
    traceDbPathHighlights.length > 0
      ? `${selectedTraceDbPathRender?.nodeIds?.length ? "Selected path highlighted. " : ""}Showing ${activeTracePathHighlights.length.toLocaleString()} of ${traceDbPaths.length.toLocaleString()} path(s), ranked by shortest hop count then highest volume.`
      : selectedTraceDbPathRender?.status ||
        traceComputation.status ||
        traceStatusMessage ||
        "Search current map wallets or paste full wallet addresses to trace across database paths.";

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

  useTraceDbPaths({
    isTraceToolOpen,
    selectedTokenSymbol,
    setIsTraceDbPathsLoading,
    setSelectedTraceDbPathKey,
    setTraceDbPaths,
    setTraceStatusMessage,
    traceFromAddress,
    traceSearchNonce,
    traceStopMode,
    traceToAddress,
  });

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
        setTokenSnapshotHistory((current) =>
          mergeSnapshotIntoHistory(current, currentKey, result.snapshot),
        );
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

  useCompareSnapshot({
    compareTokenSymbol,
    setCompareSnapshotStatus,
    setLastApiError,
    setTokenSnapshotHistory,
    setTokenSnapshots,
  });

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

  const exportVisibleGraphPreset = useCallback(() => {
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
  }, [filteredLinks, filteredNodes, selectedTokenSymbol]);

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
    ]);
    downloadBlobFile(
      rowsToCsv(headers, csvRows),
      "text/csv;charset=utf-8",
      `phantasma-filtered-transactions-${selectedTokenSymbol.toLowerCase()}.csv`,
    );
    setIsExportPresetsOpen(false);
  }

  usePopoutDismissal({
    compareButtonRef,
    comparePopoutRef,
    diagnosticsButtonRef,
    diagnosticsPopoutRef,
    exportPresetsButtonRef,
    exportPresetsPopoutRef,
    isCompareModeOpen,
    isDiagnosticsOpen,
    isExportPresetsOpen,
    isSavedViewsOpen,
    savedViewsButtonRef,
    savedViewsPopoutRef,
    setIsCompareModeOpen,
    setIsDiagnosticsOpen,
    setIsExportPresetsOpen,
    setIsSavedViewsOpen,
  });

  useEffect(() => {
    if (!isTraceToolOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      const isInsideTracePanel = traceToolPanelRef.current?.contains(target);
      const isInsideTraceLegend = traceLegendPanelRef.current?.contains(target);
      const isOnTraceToggle = traceToggleButtonRef.current?.contains(target);
      if (isInsideTracePanel || isInsideTraceLegend || isOnTraceToggle) return;
      setIsTraceToolOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTraceToolOpen]);

  const commandPaletteActions = useCommandPaletteActions({
    bubbleMapActionsRef,
    clearActiveContext,
    exportVisibleGraphPreset,
    handleClearConnections,
    handleRetryGraphLoad,
    isFocusMode,
    setActiveHolderTypeFilter,
    setConnectionMinAmount,
    setConnectionsGraphContext,
    setIsCompareModeOpen,
    setIsConnectionsView,
    setIsDiagnosticsOpen,
    setIsFocusMode,
    setIsTraceToolOpen,
    setSearchedRootAddress,
  });

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
        onLogoClick={handleGoToInitialSoulGraph}
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
        renderedNodeCount={renderedGraphNodes.length}
        renderedEdgeCount={renderedGraphLinks.length}
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
      <AppShellBar
        activeLegendLabel={activeLegendLabel}
        activeTutorialTarget={activeTutorialTarget}
        activeViewLabel={activeViewLabel}
        canEnhanceTopLevelGraph={canEnhanceTopLevelGraph}
        commandButtonRef={commandButtonRef}
        commandPaletteButtonLabel={commandPaletteButtonLabel}
        compareButtonRef={compareButtonRef}
        diagnosticsButtonRef={diagnosticsButtonRef}
        exportPresetsButtonRef={exportPresetsButtonRef}
        isGraphEnrichmentEnabled={isGraphEnrichmentEnabled}
        isGraphEnrichmentLoading={isGraphEnrichmentLoading}
        isMobileViewport={isMobileViewport}
        isTraceToolOpen={isTraceToolOpen}
        renderedGraphLinks={renderedGraphLinks}
        renderedGraphNodes={renderedGraphNodes}
        savedViewsButtonRef={savedViewsButtonRef}
        selectedTokenSymbol={selectedTokenSymbol}
        setConnectionMinAmount={setConnectionMinAmount}
        setConnectionsGraphContext={setConnectionsGraphContext}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        setIsCompareModeOpen={setIsCompareModeOpen}
        setIsConnectionsView={setIsConnectionsView}
        setIsDiagnosticsOpen={setIsDiagnosticsOpen}
        setIsExportPresetsOpen={setIsExportPresetsOpen}
        setIsGraphEnrichmentEnabled={setIsGraphEnrichmentEnabled}
        setIsSavedViewsOpen={setIsSavedViewsOpen}
        setIsTraceToolOpen={setIsTraceToolOpen}
        setSearchedRootAddress={setSearchedRootAddress}
        shellStatusLabel={shellStatusLabel}
        traceToggleButtonRef={traceToggleButtonRef}
      />
      {isSavedViewsOpen ? (
        <SavedViewsPopout
          applySavedView={applySavedView}
          removeSavedView={removeSavedView}
          saveCurrentView={saveCurrentView}
          savedViewName={savedViewName}
          savedViews={savedViews}
          savedViewsPopoutRef={savedViewsPopoutRef}
          setIsSavedViewsOpen={setIsSavedViewsOpen}
          setSavedViewName={setSavedViewName}
        />
      ) : null}
      {isCompareModeOpen ? (
        <ComparePopout
          activeTokenInfo={activeTokenInfo}
          availableTokenSymbols={availableTokenSymbols}
          comparePopoutRef={comparePopoutRef}
          compareSnapshot={compareSnapshot}
          compareSnapshotStatus={compareSnapshotStatus}
          compareTokenSymbol={compareTokenSymbol}
          currentSnapshotStatus={currentSnapshotStatus}
          currentTokenSnapshot={currentTokenSnapshot}
          selectedTokenSymbol={selectedTokenSymbol}
          setCompareTokenSymbol={setCompareTokenSymbol}
          setIsCompareModeOpen={setIsCompareModeOpen}
        />
      ) : null}
      {isDiagnosticsOpen ? (
        <DiagnosticsPopout
          diagnosticsDetails={diagnosticsDetails}
          diagnosticsPopoutRef={diagnosticsPopoutRef}
          setIsDiagnosticsOpen={setIsDiagnosticsOpen}
        />
      ) : null}
      {isExportPresetsOpen ? (
        <ExportPresetsPopout
          exportFilteredTransactionsPreset={exportFilteredTransactionsPreset}
          exportPresetsPopoutRef={exportPresetsPopoutRef}
          exportTopHoldersPreset={exportTopHoldersPreset}
          exportVisibleGraphPreset={exportVisibleGraphPreset}
          setIsExportPresetsOpen={setIsExportPresetsOpen}
        />
      ) : null}
      {isCommandPaletteOpen ? (
        <CommandPalette
          commandPaletteHeadingLabel={commandPaletteHeadingLabel}
          commandPaletteQuery={commandPaletteQuery}
          filteredCommandPaletteActions={filteredCommandPaletteActions}
          isMobileViewport={isMobileViewport}
          setCommandPaletteQuery={setCommandPaletteQuery}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        />
      ) : null}
      {isOnboardingVisible && isOnboardingAt === "skill-selection" ? (
        <WelcomeDialog
          handleReplayTutorial={handleReplayTutorial}
          setIsOnboardingVisible={setIsOnboardingVisible}
          setUserSkillLevel={setUserSkillLevel}
        />
      ) : null}
      {isOnboardingVisible && isOnboardingAt === "tutorial" ? (
        <TourPanel
          currentOnboardingStep={currentOnboardingStep}
          isOnboardingFirstStep={isOnboardingFirstStep}
          isOnboardingLastStep={isOnboardingLastStep}
          onboardingTutorialStepCount={onboardingTutorialStepCount}
          onboardingTutorialStepIndex={onboardingTutorialStepIndex}
          setIsOnboardingVisible={setIsOnboardingVisible}
          setOnboardingTutorialStep={setOnboardingTutorialStep}
        />
      ) : null}
      <div className="main-layout">
        <div
          className={`map-area ${activeTutorialTarget === "map" ? "tutorial-highlight" : ""}`}
        >
          <BubbleMap
            nodes={renderedGraphNodes}
            links={renderedGraphLinks}
            onNodeClick={setSelectedNode}
            onNodeHover={setHoveredNode}
            selectedNodeId={selectedNode?.id}
            currentSupply={currentSupplyBase}
            colorTheme={colorTheme}
            preserveUnconnectedNodes={
              hasTraceDbPathsGraph ||
              isTokenGraphMaxModeActive ||
              renderedGraphLinks.length === 0
            }
            physicsMode={physicsMode}
            layoutMode={hasTraceDbPathsGraph ? "path" : "organic"}
            labelDensityMode={labelDensityMode}
            traceNodeIds={activeTraceNodeIds}
            traceLinkKeys={activeTraceLinkKeys}
            tracePathHighlights={activeTracePathHighlights}
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
            {normalizeAmount(connectionMinAmount) > 0 ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={() => setConnectionMinAmount("")}
              >
                Connections min:{" "}
                {fmtTokenAmount(normalizeAmount(connectionMinAmount))}{" "}
                {activeTokenInfo.name} ×
              </button>
            ) : null}
            {activeTraceNodeIds.length ? (
              <button
                type="button"
                className="map-global-filter-chip"
                onClick={() => {
                  setSelectedTraceDbPathKey("");
                  setTraceFromNodeId("");
                  setTraceToNodeId("");
                  setTraceFromQuery("");
                  setTraceToQuery("");
                  setTraceDbPaths([]);
                  setTraceStatusMessage("");
                  setIsTraceToolOpen(false);
                }}
              >
                Trace active ×
              </button>
            ) : null}
          </div>
          {traceRenderableDbPaths.length ? (
            <TraceLegend
              handleShowAllTraceDbPaths={handleShowAllTraceDbPaths}
              handleShowTraceDbPath={handleShowTraceDbPath}
              handleTraceLegendPointerDown={handleTraceLegendPointerDown}
              isTraceLegendMinimized={isTraceLegendMinimized}
              isTracePaletteDocked={isTracePaletteDocked}
              selectedTraceDbPathKey={selectedTraceDbPathKey}
              setIsTraceLegendMinimized={setIsTraceLegendMinimized}
              traceDbPaths={traceDbPaths}
              traceLegendPanelRef={traceLegendPanelRef}
              traceLegendPosition={traceLegendPosition}
              traceRenderableDbPaths={traceRenderableDbPaths}
            />
          ) : null}
          <div className="map-trace-tool-wrap">
            {isTraceToolOpen ? (
              <TraceToolForm
                activeTraceStatus={activeTraceStatus}
                buildTraceOptionLabel={buildTraceOptionLabel}
                effectiveStatsCollapsed={effectiveStatsCollapsed}
                handleShowAllTraceDbPaths={handleShowAllTraceDbPaths}
                handleShowTraceDbPath={handleShowTraceDbPath}
                handleTraceToolSubmit={handleTraceToolSubmit}
                isMobileViewport={isMobileViewport}
                isTraceDbPathsLoading={isTraceDbPathsLoading}
                isTracePaletteDocked={isTracePaletteDocked}
                isTraceSearchReady={isTraceSearchReady}
                primaryTraceDbPathNodePath={primaryTraceDbPathNodePath}
                selectedTraceDbPathKey={selectedTraceDbPathKey}
                setIsTraceToolOpen={setIsTraceToolOpen}
                setSelectedTraceDbPathKey={setSelectedTraceDbPathKey}
                setTraceFromNodeId={setTraceFromNodeId}
                setTraceFromQuery={setTraceFromQuery}
                setTraceStopMode={setTraceStopMode}
                setTraceToNodeId={setTraceToNodeId}
                setTraceToQuery={setTraceToQuery}
                traceComputation={traceComputation}
                traceDbPathHighlights={traceDbPathHighlights}
                traceDbPaths={traceDbPaths}
                traceFromNodeId={traceFromNodeId}
                traceFromOptions={traceFromOptions}
                traceFromQuery={traceFromQuery}
                traceListedDbPaths={traceListedDbPaths}
                traceStopMode={traceStopMode}
                traceToNodeId={traceToNodeId}
                traceToolPanelRef={traceToolPanelRef}
                traceToOptions={traceToOptions}
                traceToQuery={traceToQuery}
              />
            ) : null}
          </div>
          {isMapLoaderVisible ? (
            <MapLoadingOverlay
              clampedMapLoadingProgress={clampedMapLoadingProgress}
              isMapLoaderExiting={isMapLoaderExiting}
              loadingThemeStyle={loadingThemeStyle}
              mapLoadingAriaStatus={mapLoadingAriaStatus}
              mapLoadingEvidenceDetail={mapLoadingEvidenceDetail}
              mapLoadingStageDetail={mapLoadingStageDetail}
            />
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
                isConnectionsView={isConnectionsView}
                onShowConnections={handleShowNodeConnections}
                connectionMinAmount={connectionMinAmount}
                onConnectionMinAmountChange={setConnectionMinAmount}
                onRefreshConnections={handleResetConnectionMinimum}
                connectionMinPresets={connectionMinPresets}
                onOpenTransactions={() => {
                  setIsTransfersModalOpen(true);
                  triggerMotionCue("modal");
                }}
                isTransactionsLoading={isSelectedNodeTransactionsLoading}
                isActivityLoading={isSelectedNodeActivityLoading}
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
            <MobileInspectSheet
              activeTokenInfo={activeTokenInfo}
              currentSupplyBase={currentSupplyBase}
              handleShowNodeConnections={handleShowNodeConnections}
              resolvedSelectedNode={resolvedSelectedNode}
              setIsMobileInspectOpen={setIsMobileInspectOpen}
              setIsTransfersModalOpen={setIsTransfersModalOpen}
            />
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
          topMovers={currentTokenTopMovers}
          topMoversLoading={isTokenTopMoversLoading}
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
          onShowConnectionsForAddress={handleShowNodeConnections}
          connectionMinAmount={connectionMinAmount}
          onConnectionMinAmountChange={setConnectionMinAmount}
          onRefreshConnections={handleResetConnectionMinimum}
          connectionMinPresets={connectionMinPresets}
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
          topMoversHorizon={topMoversHorizon}
          onTopMoversHorizonChange={setTopMoversHorizon}
          topMoversMode={topMoversMode}
          onTopMoversModeChange={setTopMoversMode}
        />
      </div>
      <TransactionsModal
        isOpen={isTransfersModalOpen}
        selectedNode={selectedNode}
        closeTransfersModal={closeTransfersModal}
        isSelectedNodeTransactionsLoading={isSelectedNodeTransactionsLoading}
        selectedNodeApiTransactionsError={selectedNodeApiTransactionsError}
        isTransactionsExporting={isTransactionsExporting}
        transactionsExportStatus={transactionsExportStatus}
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
