import { fetchJsonWithTimeout } from "../api/http";
import { buildGraphDataFromApi, shortenAddress } from "./graphData";
import {
  createGraphEndpoint as buildGraphEndpoint,
  createTokenInfoEndpoint as buildTokenInfoEndpoint,
} from "../api/mapsApi";
import {
  MAPS_API_GRAPH_DEPTH,
  MAPS_API_GRAPH_EDGE_LIMIT,
  MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
  TOKEN_SNAPSHOT_HISTORY_LIMIT,
  TOKEN_SNAPSHOT_HISTORY_MIN_INTERVAL_MS,
} from "../config/appConfig";
import { isTokenNotFoundError } from "../api/apiErrors";
import { getMockTokenData } from "./graphBuilders";

function buildTokenSnapshot(
  tokenSymbol,
  nodes,
  links,
  currentSupplyBase,
  globalHolderCount = null,
) {
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const normalizedLinks = Array.isArray(links) ? links : [];
  const getNodeSharePct = (holder) => {
    const pctFromNode = Number(holder?.pct);
    if (Number.isFinite(pctFromNode) && pctFromNode >= 0) {
      return pctFromNode;
    }

    if (currentSupplyBase > 0) {
      return (Number(holder?.value || 0) / currentSupplyBase) * 100;
    }

    return 0;
  };
  const topWallet = normalizedNodes.length
    ? normalizedNodes.reduce((best, holder) =>
        getNodeSharePct(holder) > getNodeSharePct(best) ? holder : best,
      )
    : null;
  const topWalletShare = topWallet
    ? Math.min(100, Math.max(0, getNodeSharePct(topWallet)))
    : 0;
  const concentrationTop10 = Math.min(
    100,
    Math.max(
      0,
      normalizedNodes
        .slice()
        .sort((a, b) => getNodeSharePct(b) - getNodeSharePct(a))
        .slice(0, 10)
        .reduce((sum, holder) => sum + getNodeSharePct(holder), 0),
    ),
  );
  const topWalletLabel = topWallet
    ? topWallet.shortAddr ||
      topWallet.label ||
      shortenAddress(topWallet.id || topWallet.address || "")
    : "N/A";

  return {
    token: tokenSymbol,
    wallets: normalizedNodes.length,
    links: normalizedLinks.length,
    globalHolderCount: Number.isFinite(Number(globalHolderCount))
      ? Math.max(0, Math.floor(Number(globalHolderCount)))
      : null,
    top10: Number(concentrationTop10 || 0),
    topWalletLabel,
    topWalletShare: Number(topWalletShare || 0),
    recordedAt: Date.now(),
  };
}

export function normalizeTokenSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const wallets = Number(snapshot.wallets ?? snapshot.visibleWallets ?? 0);
  const links = Number(snapshot.links ?? snapshot.visibleLinks ?? 0);
  const globalHolderCount = Number(
    snapshot.globalHolderCount ?? snapshot.global_holder_count,
  );
  const { visibleWallets, visibleLinks, ...rest } = snapshot;

  return {
    ...rest,
    wallets: Number.isFinite(wallets) && wallets >= 0 ? wallets : 0,
    links: Number.isFinite(links) && links >= 0 ? links : 0,
    globalHolderCount:
      Number.isFinite(globalHolderCount) && globalHolderCount >= 0
        ? Math.floor(globalHolderCount)
        : null,
  };
}

export function normalizeTokenSnapshotHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    return {};
  }

  return Object.entries(history).reduce((acc, [token, snapshots]) => {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken || !Array.isArray(snapshots)) {
      return acc;
    }

    const normalizedSnapshots = snapshots
      .map((snapshot) => normalizeTokenSnapshot(snapshot))
      .filter(Boolean)
      .sort(
        (left, right) =>
          Number(left?.recordedAt || 0) - Number(right?.recordedAt || 0),
      )
      .slice(-TOKEN_SNAPSHOT_HISTORY_LIMIT);

    if (normalizedSnapshots.length) {
      acc[normalizedToken] = normalizedSnapshots;
    }

    return acc;
  }, {});
}

export function getSnapshotWalletCount(snapshot) {
  return Number(
    snapshot?.globalHolderCount ??
      snapshot?.global_holder_count ??
      snapshot?.wallets ??
      snapshot?.visibleWallets ??
      0,
  );
}

export function mergeSnapshotIntoHistory(history, tokenSymbol, snapshot) {
  const normalizedToken = String(tokenSymbol || "").trim();
  const normalizedSnapshot = normalizeTokenSnapshot(snapshot);

  if (!normalizedToken || !normalizedSnapshot) {
    return history;
  }

  const currentHistory = Array.isArray(history?.[normalizedToken])
    ? history[normalizedToken]
        .map((entry) => normalizeTokenSnapshot(entry))
        .filter(Boolean)
    : [];
  const nextSnapshot = {
    ...normalizedSnapshot,
    recordedAt: Number(normalizedSnapshot.recordedAt) || Date.now(),
  };
  const lastSnapshot = currentHistory[currentHistory.length - 1] || null;

  if (lastSnapshot) {
    const withinDedupWindow =
      nextSnapshot.recordedAt - (Number(lastSnapshot.recordedAt) || 0) <
      TOKEN_SNAPSHOT_HISTORY_MIN_INTERVAL_MS;
    const hasSameShape =
      getSnapshotWalletCount(lastSnapshot) ===
        getSnapshotWalletCount(nextSnapshot) &&
      Number(lastSnapshot.top10 || 0) === Number(nextSnapshot.top10 || 0) &&
      Number(lastSnapshot.topWalletShare || 0) ===
        Number(nextSnapshot.topWalletShare || 0);

    if (withinDedupWindow && hasSameShape) {
      return history;
    }
  }

  return {
    ...history,
    [normalizedToken]: [...currentHistory, nextSnapshot].slice(
      -TOKEN_SNAPSHOT_HISTORY_LIMIT,
    ),
  };
}

export async function fetchTokenSnapshot(baseUrl, timeoutMs, tokenSymbol) {
  const normalizedTokenSymbol = String(tokenSymbol || "").trim();
  if (!normalizedTokenSymbol) {
    return {
      snapshot: null,
      fallbackUsed: false,
      isTokenNotFound: false,
      error: null,
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
  const metadataHolderCount = Number(
    metadataResult.payload?.holderCount ?? metadataResult.payload?.holder_count,
  );

  if (
    isTokenNotFoundError(metadataResult) ||
    isTokenNotFoundError(graphResult)
  ) {
    return {
      snapshot: null,
      fallbackUsed: false,
      isTokenNotFound: true,
      error: isTokenNotFoundError(graphResult) ? graphResult : metadataResult,
    };
  }

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
          metadataHolderCount,
        ),
        fallbackUsed: false,
        isTokenNotFound: false,
        error: null,
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
        Number(fallbackMockToken.tokenInfo?.globalHolderCount),
      ),
      fallbackUsed: true,
      isTokenNotFound: false,
      error: null,
    };
  }

  return {
    snapshot: null,
    fallbackUsed: false,
    isTokenNotFound: false,
    error: null,
  };
}
