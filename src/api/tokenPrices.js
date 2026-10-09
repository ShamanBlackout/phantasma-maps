import { fetchJsonWithTimeout } from "./http";

export const DEFAULT_TRACKED_TOKEN_PRICE_API_BASE_URL =
  "https://apiops.saturnx.cc/v1/tokens";
export const DEFAULT_EXPLORER_TOKEN_API_URL =
  "https://api-explorer.phantasma.info/api/v1/tokens";

// SaturnX is optional (it is often unreachable or ISP-filtered), so fail fast without retries.
const SATURNX_REQUEST_TIMEOUT_MS = 5000;
const EXPLORER_REQUEST_TIMEOUT_MS = 8000;
const BACKEND_REQUEST_TIMEOUT_MS = 10000;

export function parseTrackedTokenQuote(payload, tokenSymbol) {
  const normalizedSymbol = String(tokenSymbol || "")
    .trim()
    .toUpperCase();
  const dataToken =
    payload?.data &&
    !Array.isArray(payload.data) &&
    typeof payload.data === "object" &&
    (payload.data.symbol ||
      payload.data.tokenSymbol ||
      payload.data.priceUsd !== undefined ||
      payload.data.price !== undefined)
      ? payload.data
      : null;
  const directToken = dataToken
    ? dataToken
    : payload?.price !== undefined
      ? payload
      : null;
  const tokenCollection =
    payload?.tokens ??
    payload?.prices ??
    payload?.quotes ??
    payload?.data?.tokens ??
    payload?.data?.prices ??
    payload?.data?.quotes ??
    payload?.data ??
    payload;
  const candidates = directToken
    ? [directToken]
    : Array.isArray(tokenCollection)
      ? tokenCollection
      : Array.isArray(tokenCollection?.items)
        ? tokenCollection.items
        : Array.isArray(tokenCollection?.tokens)
          ? tokenCollection.tokens
          : tokenCollection && typeof tokenCollection === "object"
            ? Object.entries(tokenCollection).map(([symbol, token]) => ({
                ...(token && typeof token === "object"
                  ? token
                  : { price: token }),
                symbol: token?.symbol ?? token?.tokenSymbol ?? symbol,
              }))
            : [];

  const token = candidates.find((candidate) => {
    const symbol = String(
      candidate?.symbol ??
        candidate?.tokenSymbol ??
        candidate?.token_symbol ??
        candidate?.token ??
        candidate?.name ??
        "",
    )
      .trim()
      .toUpperCase();
    return symbol === normalizedSymbol || (!symbol && candidates.length === 1);
  });

  if (!token) return null;

  const usdPrice = Number(
    token?.priceUsd ??
      token?.price_usd ??
      token?.currentPrice ??
      token?.current_price ??
      token?.usdPrice ??
      token?.usd_price ??
      token?.price ??
      token?.usd,
  );
  if (!Number.isFinite(usdPrice)) return null;

  const usdChange24h = Number(
    token?.priceChange24h ??
      token?.price_change_24h ??
      token?.change?.h24 ??
      token?.change?.h24Percent ??
      token?.change24h ??
      token?.change_24h ??
      token?.changePercent24h ??
      token?.change_percent_24h ??
      token?.priceChange ??
      token?.price_change ??
      token?.priceChangePercentage24h ??
      token?.price_change_percentage_24h ??
      token?.change ??
      token?.changePercent ??
      token?.change_percent ??
      token?.change_24h_percent ??
      token?.percentChange24h ??
      token?.percent_change_24h ??
      token?.percentChange24H,
  );

  return {
    price: usdPrice,
    priceChange24h: Number.isFinite(usdChange24h) ? usdChange24h : null,
  };
}

export function parseExplorerTokenQuote(payload, tokenSymbol) {
  const normalizedSymbol = String(tokenSymbol || "")
    .trim()
    .toUpperCase();
  const tokens = Array.isArray(payload?.tokens)
    ? payload.tokens
    : Array.isArray(payload)
      ? payload
      : [];
  const token = tokens.find(
    (candidate) =>
      String(candidate?.symbol || "")
        .trim()
        .toUpperCase() === normalizedSymbol,
  );
  const rawPrice = token?.price?.usd ?? token?.price;
  if (rawPrice === null || rawPrice === undefined || rawPrice === "") {
    return null;
  }
  const usdPrice = Number(rawPrice);
  if (!Number.isFinite(usdPrice) || usdPrice < 0) return null;

  // The explorer only publishes spot prices, not 24h movement.
  return { price: usdPrice, priceChange24h: null };
}

async function fetchSaturnxQuote(tokenSymbol, { baseUrl, network }) {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(tokenSymbol)}?network=${encodeURIComponent(network)}`;
  const result = await fetchJsonWithTimeout(
    endpoint,
    {},
    SATURNX_REQUEST_TIMEOUT_MS,
    { maxRetries: 0 },
  );
  const quote = result.ok
    ? parseTrackedTokenQuote(result.payload, tokenSymbol)
    : null;
  return quote
    ? { ok: true, status: result.status, quote, source: "saturnx" }
    : { ok: false, status: result.status, retryAfterMs: result.retryAfterMs };
}

export async function fetchExplorerTokenQuote(
  tokenSymbol,
  { explorerUrl = DEFAULT_EXPLORER_TOKEN_API_URL } = {},
) {
  const endpoint = `${explorerUrl.replace(/\/$/, "")}?symbol=${encodeURIComponent(tokenSymbol)}&with_price=1`;
  const result = await fetchJsonWithTimeout(
    endpoint,
    {},
    EXPLORER_REQUEST_TIMEOUT_MS,
    { maxRetries: 1 },
  );
  const quote = result.ok
    ? parseExplorerTokenQuote(result.payload, tokenSymbol)
    : null;
  return quote
    ? { ok: true, status: result.status, quote, source: "phantasma-explorer" }
    : { ok: false, status: result.status, retryAfterMs: result.retryAfterMs };
}

export async function fetchBackendTokenQuote(tokenSymbol, apiBaseUrl) {
  const endpoint = `${String(apiBaseUrl).replace(/\/$/, "")}/prices/${encodeURIComponent(tokenSymbol)}`;
  const result = await fetchJsonWithTimeout(
    endpoint,
    {},
    BACKEND_REQUEST_TIMEOUT_MS,
    { maxRetries: 1 },
  );
  if (!result.ok) {
    return {
      ok: false,
      reachable: false,
      status: result.status,
      retryAfterMs: result.retryAfterMs,
    };
  }

  const priceUsd = Number(result.payload?.priceUsd);
  const rawChange = result.payload?.priceChange24h;
  const priceChange24h =
    rawChange === null || rawChange === undefined || rawChange === ""
      ? null
      : Number(rawChange);
  if (
    result.payload?.priceUsd === null ||
    result.payload?.priceUsd === undefined ||
    !Number.isFinite(priceUsd)
  ) {
    return { ok: false, reachable: true, status: result.status };
  }

  return {
    ok: true,
    reachable: true,
    status: result.status,
    quote: {
      price: priceUsd,
      priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    },
    source: `api:${result.payload?.source || "unknown"}`,
  };
}

async function fetchDirectTokenQuote(tokenSymbol, { baseUrl, network, explorerUrl }) {
  const failed = { ok: false, status: 0 };
  const [saturnx, explorer] = await Promise.all([
    fetchSaturnxQuote(tokenSymbol, { baseUrl, network }).catch(() => failed),
    fetchExplorerTokenQuote(tokenSymbol, { explorerUrl }).catch(() => failed),
  ]);

  if (saturnx.ok) return saturnx;
  if (explorer.ok) return explorer;
  return {
    ok: false,
    status: saturnx.status || explorer.status,
    retryAfterMs: Math.max(saturnx.retryAfterMs || 0, explorer.retryAfterMs || 0),
  };
}

// Prices come from the maps API, which aggregates and caches SaturnX, CoinGecko and the
// Phantasma explorer server-side. Browsers only call those sources directly when the API
// itself is unreachable (e.g. an older backend without /prices).
export async function fetchTrackedTokenQuote(
  tokenSymbol,
  {
    apiBaseUrl = null,
    baseUrl = DEFAULT_TRACKED_TOKEN_PRICE_API_BASE_URL,
    network = "mainnet",
    explorerUrl = DEFAULT_EXPLORER_TOKEN_API_URL,
  } = {},
) {
  if (apiBaseUrl) {
    const backend = await fetchBackendTokenQuote(tokenSymbol, apiBaseUrl).catch(
      () => ({ ok: false, reachable: false, status: 0 }),
    );
    if (backend.ok || backend.reachable) return backend;
  }

  return fetchDirectTokenQuote(tokenSymbol, { baseUrl, network, explorerUrl });
}
