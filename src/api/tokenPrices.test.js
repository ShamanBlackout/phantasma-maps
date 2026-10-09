import {
  fetchTrackedTokenQuote,
  parseExplorerTokenQuote,
} from "./tokenPrices";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

const explorerKcalPayload = {
  total_results: 1,
  tokens: [{ symbol: "KCAL", price: { usd: 2.4738e-8 } }],
};

afterEach(() => {
  delete global.fetch;
});

test("parses explorer token quotes without inventing a 24h change", () => {
  expect(parseExplorerTokenQuote(explorerKcalPayload, "kcal")).toEqual({
    price: 2.4738e-8,
    priceChange24h: null,
  });
  expect(parseExplorerTokenQuote(explorerKcalPayload, "SOUL")).toBeNull();
  expect(
    parseExplorerTokenQuote({ tokens: [{ symbol: "KCAL", price: {} }] }, "KCAL"),
  ).toBeNull();
});

test("falls back to the Phantasma explorer when SaturnX is unreachable", async () => {
  global.fetch = jest.fn(async (url) => {
    if (String(url).includes("saturnx")) throw new TypeError("Failed to fetch");
    return jsonResponse(explorerKcalPayload);
  });

  const result = await fetchTrackedTokenQuote("KCAL");

  expect(result.ok).toBe(true);
  expect(result.source).toBe("phantasma-explorer");
  expect(result.quote.price).toBe(2.4738e-8);
  // SaturnX is attempted once (no retries) so the fallback is not delayed.
  expect(
    global.fetch.mock.calls.filter(([url]) => String(url).includes("saturnx")),
  ).toHaveLength(1);
});

test("prefers SaturnX quotes because they include 24h change", async () => {
  global.fetch = jest.fn(async (url) =>
    String(url).includes("saturnx")
      ? jsonResponse({ symbol: "KCAL", price: 3e-8, priceChange24h: -4.5 })
      : jsonResponse(explorerKcalPayload),
  );

  const result = await fetchTrackedTokenQuote("KCAL");

  expect(result).toMatchObject({
    ok: true,
    source: "saturnx",
    quote: { price: 3e-8, priceChange24h: -4.5 },
  });
});

test("reports failure when no source has a price", async () => {
  global.fetch = jest.fn(async () => jsonResponse({ tokens: [] }));

  const result = await fetchTrackedTokenQuote("NOPE");

  expect(result.ok).toBe(false);
});

test("uses the maps API price route and skips direct sources when it answers", async () => {
  global.fetch = jest.fn(async () =>
    jsonResponse({
      data: {
        tokenSymbol: "KCAL",
        priceUsd: 2.4738e-8,
        priceChange24h: null,
        source: "coingecko",
      },
    }),
  );

  const result = await fetchTrackedTokenQuote("KCAL", {
    apiBaseUrl: "http://api.test",
  });

  expect(result).toMatchObject({
    ok: true,
    source: "api:coingecko",
    quote: { price: 2.4738e-8, priceChange24h: null },
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe("http://api.test/prices/KCAL");
});

test("does not query direct sources when the maps API has no price", async () => {
  global.fetch = jest.fn(async () =>
    jsonResponse({ data: { tokenSymbol: "CROWN", priceUsd: null, source: null } }),
  );

  const result = await fetchTrackedTokenQuote("CROWN", {
    apiBaseUrl: "http://api.test",
  });

  expect(result.ok).toBe(false);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("falls back to direct sources when the maps API is unreachable", async () => {
  global.fetch = jest.fn(async (url) => {
    if (String(url).startsWith("http://api.test")) {
      throw new TypeError("Failed to fetch");
    }
    if (String(url).includes("saturnx")) throw new TypeError("Failed to fetch");
    return jsonResponse(explorerKcalPayload);
  });

  const result = await fetchTrackedTokenQuote("KCAL", {
    apiBaseUrl: "http://api.test",
  });

  expect(result.ok).toBe(true);
  expect(result.source).toBe("phantasma-explorer");
});
