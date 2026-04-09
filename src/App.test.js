import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

function createMatchMedia(matches = false) {
  return (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
}

jest.mock("./components/BubbleMap", () => {
  return function MockBubbleMap() {
    return <div data-testid="bubble-map" />;
  };
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: createMatchMedia(),
  });

  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: window.matchMedia,
  });

  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });

  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
});

beforeEach(() => {
  window.matchMedia = createMatchMedia();
  globalThis.matchMedia = window.matchMedia;

  global.fetch = jest.fn(async (input) => {
    const url = String(input);

    if (url.includes("/tokens/") && url.includes("/metadata")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          name: "Phantasma Energy",
          decimals: 0,
          maxSupplyNormalized: 1000,
          currentSupplyNormalized: 1000,
        }),
      };
    }

    if (url.endsWith("/tokens")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ items: ["SOUL", "KCAL"] }),
      };
    }

    if (url.includes("/graph/token/")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          totalSupply: 1000,
          nodes: [
            {
              address: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
              label: "Treasury",
              balance: 650,
            },
            {
              address: "P2Kd4TsHvN8wMqBbCpRsuY3K7Je5FXZ9kQ6Lmj4WXyz",
              label: "Whale",
              balance: 350,
            },
          ],
          edges: [
            {
              fromAddress: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
              toAddress: "P2Kd4TsHvN8wMqBbCpRsuY3K7Je5FXZ9kQ6Lmj4WXyz",
              amount: 25,
              txHash: "0xabc123",
            },
          ],
        }),
      };
    }

    if (url.includes("/sync-status")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          chainHeadBlockHeight: 200,
          items: [
            {
              tokenSymbol: "__chain__",
              lastBlockHeight: 100,
              updatedAt: "2026-04-08T12:00:00.000Z",
            },
          ],
        }),
      };
    }

    if (url.includes("coingecko")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          phantasma: {
            usd: 0.5,
            usd_24h_change: 1.25,
          },
        }),
      };
    }

    throw new Error(`Unhandled fetch in test: ${url}`);
  });
});

afterEach(() => {
  global.fetch.mockClear();
});

test("renders the current map application shell", async () => {
  render(<App />);

  expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  expect(screen.getByText(/Block Sync/i)).toBeInTheDocument();
  expect(screen.getByText(/Gen3/i)).toBeInTheDocument();
  expect(screen.getByTestId("bubble-map")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });
});
