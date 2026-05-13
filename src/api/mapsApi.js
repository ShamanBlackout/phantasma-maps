import { fetchJsonWithTimeout } from "./http";

// ── Shared helpers ────────────────────────────────────────────────────────────

function normalizeBase(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

// ── Endpoint builders ─────────────────────────────────────────────────────────

export function createTokensEndpoint(baseUrl) {
  return `${normalizeBase(baseUrl)}/tokens`;
}

export function createTokenInfoEndpoint(baseUrl, tokenSymbol) {
  return `${normalizeBase(baseUrl)}/tokens/${encodeURIComponent(tokenSymbol)}/metadata`;
}

export function createTopHoldersEndpoint(baseUrl, tokenSymbol, limit = 10) {
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.floor(Number(limit))
      : 10;
  return `${normalizeBase(baseUrl)}/tokens/${encodeURIComponent(tokenSymbol)}/top-holders?limit=${normalizedLimit}`;
}

export function createGraphEndpoint(
  baseUrl,
  tokenSymbol,
  {
    rootAddress = "",
    depth = 2,
    edgeLimit = 1200,
    defaultEdgeLimit = 1200,
    useMaxEndpoint = false,
    // Pass a positive number to request top-holder annotations alongside the token graph.
    topHoldersLimit,
    withTopHolders = false,
  },
) {
  const base = normalizeBase(baseUrl);
  const activeRootAddress = String(rootAddress || "").trim();

  if (activeRootAddress) {
    const normalizedEdgeLimit =
      Number.isFinite(Number(edgeLimit)) && Number(edgeLimit) > 0
        ? Math.floor(Number(edgeLimit))
        : defaultEdgeLimit;

    const params = new URLSearchParams({
      token: tokenSymbol,
      depth: String(depth),
      edgeLimit: String(normalizedEdgeLimit),
    });
    return `${base}/graph/address/${encodeURIComponent(activeRootAddress)}?${params.toString()}`;
  }

  if (useMaxEndpoint) {
    return `${base}/graph/token/${encodeURIComponent(tokenSymbol)}/max`;
  }

  const params = new URLSearchParams();
  const normalizedTopHoldersLimit =
    Number.isFinite(Number(topHoldersLimit)) && Number(topHoldersLimit) > 0
      ? Math.floor(Number(topHoldersLimit))
      : 0;

  if (normalizedTopHoldersLimit > 0) {
    params.set("topHoldersLimit", String(normalizedTopHoldersLimit));
  } else if (withTopHolders) {
    params.set("withTopHolders", "true");
  }

  const query = params.toString();
  return query
    ? `${base}/graph/token/${encodeURIComponent(tokenSymbol)}?${query}`
    : `${base}/graph/token/${encodeURIComponent(tokenSymbol)}`;
}

export function createConnectionsEndpoint(baseUrl, address, tokenSymbol) {
  const params = new URLSearchParams({ token: tokenSymbol });
  return `${normalizeBase(baseUrl)}/connections/address/${encodeURIComponent(address)}?${params.toString()}`;
}

export function createTransactionsEndpoint(
  baseUrl,
  address,
  tokenSymbol,
  page = 1,
  pageSize = 250,
  filters = {},
) {
  const params = new URLSearchParams({
    token: tokenSymbol,
    address,
    page: String(page),
    pageSize: String(pageSize),
  });

  const direction = String(filters?.direction || "")
    .trim()
    .toLowerCase();
  if (direction === "from" || direction === "to") {
    params.set("dir", direction);
  }

  const counterparty = String(filters?.counterparty || "").trim();
  if (counterparty) {
    params.set("counterparty", counterparty);
  }

  const startTime = String(filters?.startTime || "").trim();
  if (startTime) {
    params.set("startTime", startTime);
  }

  const endTime = String(filters?.endTime || "").trim();
  if (endTime) {
    params.set("endTime", endTime);
  }

  if (Number.isFinite(filters?.minAmount)) {
    params.set("minAmount", String(filters.minAmount));
  }
  if (Number.isFinite(filters?.maxAmount)) {
    params.set("maxAmount", String(filters.maxAmount));
  }
  if (Number.isFinite(filters?.minUsd)) {
    params.set("minUsd", String(filters.minUsd));
  }
  if (Number.isFinite(filters?.maxUsd)) {
    params.set("maxUsd", String(filters.maxUsd));
  }
  if (Number.isFinite(filters?.usdRateNow)) {
    params.set("usdRateNow", String(filters.usdRateNow));
  }

  const sortBy = String(filters?.sortBy || "")
    .trim()
    .toLowerCase();
  if (sortBy === "amount" || sortBy === "usd" || sortBy === "time") {
    params.set("sortBy", sortBy);
  }

  const sortDir = String(filters?.sortDir || "")
    .trim()
    .toLowerCase();
  if (sortDir === "asc" || sortDir === "desc") {
    params.set("sortDir", sortDir);
  }

  return `${normalizeBase(baseUrl)}/transactions?${params.toString()}`;
}

export function createSyncStatusEndpoint(baseUrl) {
  return `${normalizeBase(baseUrl)}/sync-status`;
}

export function createActivityEndpoint(
  baseUrl,
  address,
  tokenSymbol,
  days = 30,
) {
  const params = new URLSearchParams({ days: String(days) });
  return `${normalizeBase(baseUrl)}/tokens/${encodeURIComponent(tokenSymbol)}/activity/${encodeURIComponent(address)}?${params.toString()}`;
}

export function createAnalyticsTimeseriesEndpoint(
  baseUrl,
  tokenSymbol,
  days = 90,
) {
  const normalizedDays =
    Number.isFinite(Number(days)) && Number(days) > 0
      ? Math.floor(Number(days))
      : 90;
  const params = new URLSearchParams({ days: String(normalizedDays) });
  return `${normalizeBase(baseUrl)}/analytics/tokens/${encodeURIComponent(tokenSymbol)}/timeseries?${params.toString()}`;
}

export function createAnalyticsTopMoversEndpoint(
  baseUrl,
  tokenSymbol,
  windowDays = 7,
  limit = 5,
) {
  const normalizedWindowDays =
    Number.isFinite(Number(windowDays)) && Number(windowDays) > 0
      ? Math.floor(Number(windowDays))
      : 7;
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.floor(Number(limit))
      : 5;
  const params = new URLSearchParams({
    windowDays: String(normalizedWindowDays),
    limit: String(normalizedLimit),
  });
  return `${normalizeBase(baseUrl)}/analytics/tokens/${encodeURIComponent(tokenSymbol)}/top-movers?${params.toString()}`;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function buildApiError(defaultMessage, result) {
  const error = new Error(result?.errorMessage || defaultMessage);
  error.code = result?.errorCode || null;
  error.status = result?.status ?? 0;
  error.retryAfterMs = result?.retryAfterMs ?? null;
  error.isNetworkError = Boolean(result?.isNetworkError);
  error.details = result?.errorDetails || null;
  error.requestId = result?.requestId || null;
  return error;
}

/**
 * Fetches all transaction pages for an address up to `maxPages`.
 * Returns `{ items, error }`. On failure `items` is whatever was collected
 * before the error and `error` describes the failure — callers can decide
 * whether to surface partial results or discard them.
 */
export async function fetchAllTransactionsForAddress(
  baseUrl,
  timeoutOrOptions,
  maxPages,
  pageSize,
  address,
  tokenSymbol,
) {
  const options =
    timeoutOrOptions && typeof timeoutOrOptions === "object"
      ? timeoutOrOptions
      : {
          timeoutMs: timeoutOrOptions,
          maxPages,
          pageSize,
          address,
          tokenSymbol,
        };

  const timeoutMs = Number(options?.timeoutMs) || 7000;
  const maxPageCount = Number(options?.maxPages) || 1;
  const resolvedPageSize = Number(options?.pageSize) || 250;
  const resolvedTokenSymbol = options?.tokenSymbol;
  const resolvedAddress = options?.address;

  const normalizedAddress = String(resolvedAddress || "").trim();
  if (!normalizedAddress) return [];

  const allItems = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPageCount && allItems.length < total) {
    const endpoint = createTransactionsEndpoint(
      baseUrl,
      normalizedAddress,
      resolvedTokenSymbol,
      page,
      resolvedPageSize,
    );
    const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

    if (!result.ok) {
      throw buildApiError(
        `Transactions request failed (HTTP ${result.status})`,
        result,
      );
    }

    const items = Array.isArray(result.payload?.items)
      ? result.payload.items
      : [];
    const nextTotal = Number(result.payload?.total ?? items.length);
    total =
      Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : items.length;
    allItems.push(...items);

    if (!items.length) break;
    page += 1;
  }

  return allItems;
}

export async function fetchConnectionsForAddress(
  baseUrl,
  timeoutMs,
  address,
  tokenSymbol,
) {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) {
    return { items: [] };
  }

  const endpoint = createConnectionsEndpoint(
    baseUrl,
    normalizedAddress,
    tokenSymbol,
  );
  const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

  if (!result.ok) {
    throw buildApiError(
      `Connections request failed (HTTP ${result.status})`,
      result,
    );
  }

  return {
    items: Array.isArray(result.payload?.items) ? result.payload.items : [],
  };
}

export async function fetchTokenAnalyticsTimeseries(
  baseUrl,
  timeoutMs,
  tokenSymbol,
  days = 90,
) {
  const normalizedTokenSymbol = String(tokenSymbol || "").trim();
  if (!normalizedTokenSymbol) {
    return { tokenSymbol: "", days: 0, items: [] };
  }

  const endpoint = createAnalyticsTimeseriesEndpoint(
    baseUrl,
    normalizedTokenSymbol,
    days,
  );
  const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

  if (!result.ok) {
    throw buildApiError(
      `Analytics timeseries request failed (HTTP ${result.status})`,
      result,
    );
  }

  return {
    tokenSymbol: String(result.payload?.tokenSymbol || normalizedTokenSymbol),
    days: Number(result.payload?.days || days),
    items: Array.isArray(result.payload?.items) ? result.payload.items : [],
  };
}

export async function fetchTokenAnalyticsTopMovers(
  baseUrl,
  timeoutMs,
  tokenSymbol,
  windowDays = 7,
  limit = 5,
) {
  const normalizedTokenSymbol = String(tokenSymbol || "").trim();
  if (!normalizedTokenSymbol) {
    return { tokenSymbol: "", windowDays: 0, limit: 0, items: [] };
  }

  const endpoint = createAnalyticsTopMoversEndpoint(
    baseUrl,
    normalizedTokenSymbol,
    windowDays,
    limit,
  );
  const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

  if (!result.ok) {
    throw buildApiError(
      `Analytics top movers request failed (HTTP ${result.status})`,
      result,
    );
  }

  return {
    tokenSymbol: String(result.payload?.tokenSymbol || normalizedTokenSymbol),
    windowDays: Number(result.payload?.windowDays || windowDays),
    limit: Number(result.payload?.limit || limit),
    items: Array.isArray(result.payload?.items) ? result.payload.items : [],
  };
}

export async function fetchTopHolders(
  baseUrl,
  timeoutMs,
  tokenSymbol,
  limit = 10,
) {
  const endpoint = createTopHoldersEndpoint(baseUrl, tokenSymbol, limit);
  const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

  if (!result.ok) {
    throw buildApiError(
      `Top holders request failed (HTTP ${result.status})`,
      result,
    );
  }

  return {
    items: Array.isArray(result.payload?.items) ? result.payload.items : [],
  };
}

export async function fetchTransactionsPageForAddress(
  baseUrl,
  timeoutMs,
  address,
  tokenSymbol,
  { page = 1, pageSize = 100, filters = {} } = {},
) {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) {
    return { items: [], total: 0, page, pageSize };
  }

  const endpoint = createTransactionsEndpoint(
    baseUrl,
    normalizedAddress,
    tokenSymbol,
    page,
    pageSize,
    filters,
  );
  const result = await fetchJsonWithTimeout(endpoint, {}, timeoutMs);

  if (!result.ok) {
    throw buildApiError(
      `Transactions request failed (HTTP ${result.status})`,
      result,
    );
  }

  const items = Array.isArray(result.payload?.items)
    ? result.payload.items
    : [];
  const parsedTotal = Number(result.payload?.total);
  const total =
    Number.isFinite(parsedTotal) && parsedTotal >= 0
      ? parsedTotal
      : items.length;

  return { items, total, page, pageSize };
}
