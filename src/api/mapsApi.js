import { fetchJsonWithTimeout } from "./http";

export function createTokensEndpoint(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/tokens`;
}

export function createTokenInfoEndpoint(baseUrl, tokenSymbol) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/tokens/${encodeURIComponent(tokenSymbol)}/metadata`;
}

export function createTopHoldersEndpoint(baseUrl, tokenSymbol, limit = 10) {
  const base = baseUrl.replace(/\/+$/, "");
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.floor(Number(limit))
      : 10;
  return `${base}/tokens/${encodeURIComponent(tokenSymbol)}/top-holders?limit=${normalizedLimit}`;
}

export function createGraphEndpoint(
  baseUrl,
  tokenSymbol,
  {
    rootAddress = "",
    depth = 2,
    edgeLimit = 1200,
    defaultEdgeLimit = 1200,
    includeTopHolders = 0,
  },
) {
  const base = baseUrl.replace(/\/+$/, "");
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

  const normalizedIncludeTopHolders =
    Number.isFinite(Number(includeTopHolders)) && Number(includeTopHolders) > 0
      ? Math.floor(Number(includeTopHolders))
      : 0;
  const params = new URLSearchParams();

  if (normalizedIncludeTopHolders > 0) {
    params.set("includeTopHolders", String(normalizedIncludeTopHolders));
  }

  const query = params.toString();
  return query
    ? `${base}/graph/token/${encodeURIComponent(tokenSymbol)}?${query}`
    : `${base}/graph/token/${encodeURIComponent(tokenSymbol)}`;
}

export function createConnectionsEndpoint(baseUrl, address, tokenSymbol) {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token: tokenSymbol,
  });
  return `${base}/connections/address/${encodeURIComponent(address)}?${params.toString()}`;
}

export function createTransactionsEndpoint(
  baseUrl,
  address,
  tokenSymbol,
  page = 1,
  pageSize = 250,
  filters = {},
) {
  const base = baseUrl.replace(/\/+$/, "");
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

  return `${base}/transactions?${params.toString()}`;
}

export function createSyncStatusEndpoint(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/sync-status`;
}

export function createActivityEndpoint(
  baseUrl,
  address,
  tokenSymbol,
  days = 30,
) {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ days: String(days) });
  return `${base}/tokens/${encodeURIComponent(tokenSymbol)}/activity/${encodeURIComponent(address)}?${params.toString()}`;
}

export async function fetchAllTransactionsForAddress(
  baseUrl,
  timeoutMs,
  maxPages,
  pageSize,
  address,
  tokenSymbol,
) {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) return [];

  const allItems = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPages && allItems.length < total) {
    const endpoint = createTransactionsEndpoint(
      baseUrl,
      normalizedAddress,
      tokenSymbol,
      page,
      pageSize,
    );
    const result = await fetchJsonWithTimeout(
      endpoint,
      { cache: "no-store" },
      timeoutMs,
    );

    if (!result.ok) {
      throw new Error(
        `transactions request failed with status ${result.status}`,
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
    return {
      items: [],
    };
  }

  const endpoint = createConnectionsEndpoint(
    baseUrl,
    normalizedAddress,
    tokenSymbol,
  );
  const result = await fetchJsonWithTimeout(
    endpoint,
    { cache: "no-store" },
    timeoutMs,
  );

  if (!result.ok) {
    throw new Error(`connections request failed with status ${result.status}`);
  }

  return {
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
  const result = await fetchJsonWithTimeout(
    endpoint,
    { cache: "no-store" },
    timeoutMs,
  );

  if (!result.ok) {
    throw new Error(`top holders request failed with status ${result.status}`);
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
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    };
  }

  const endpoint = createTransactionsEndpoint(
    baseUrl,
    normalizedAddress,
    tokenSymbol,
    page,
    pageSize,
    filters,
  );
  const result = await fetchJsonWithTimeout(
    endpoint,
    { cache: "no-store" },
    timeoutMs,
  );

  if (!result.ok) {
    throw new Error(`transactions request failed with status ${result.status}`);
  }

  const items = Array.isArray(result.payload?.items)
    ? result.payload.items
    : [];
  const parsedTotal = Number(result.payload?.total);
  const total =
    Number.isFinite(parsedTotal) && parsedTotal >= 0
      ? parsedTotal
      : items.length;

  return {
    items,
    total,
    page,
    pageSize,
  };
}
