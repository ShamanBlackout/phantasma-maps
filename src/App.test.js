import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

function createLargeGraphPayload(nodeCount = 305, edgeCount = 1300) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    address: `P${String(index + 1).padStart(33, "A")}`,
    label: `Holder ${index + 1}`,
    balance: Math.max(1, nodeCount - index),
  }));
  const edges = Array.from({ length: edgeCount }, (_, index) => ({
    fromAddress: nodes[index % nodeCount].address,
    toAddress: nodes[(index + 1) % nodeCount].address,
    amount: 1,
    txHash: `0x${String(index + 1).padStart(8, "0")}`,
  }));

  return {
    totalSupply: nodes.reduce((sum, node) => sum + node.balance, 0),
    nodes,
    edges,
  };
}

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
  window.localStorage.clear();
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
  const { container } = render(<App />);

  expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  expect(screen.getByText(/Block Sync/i)).toBeInTheDocument();
  expect(screen.getByText(/Gen3/i)).toBeInTheDocument();
  expect(screen.getByTestId("bubble-map")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });
});

test("keeps settings widgets stable under repeated interaction", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  const appRoot = container.querySelector(".app-root");
  const themeSelect = screen.getByRole("combobox", { name: /theme/i });
  const settingsTrigger = screen.getByRole("button", {
    name: /open graph settings/i,
  });

  const themeSequence = [
    { value: "light", className: "theme-light" },
    { value: "ghost-blue", className: "theme-ghost-blue" },
    { value: "kcal-red", className: "theme-kcal-red" },
    { value: "dark", className: "theme-dark" },
    { value: "light", className: "theme-light" },
    { value: "dark", className: "theme-dark" },
  ];

  for (const theme of themeSequence) {
    await user.selectOptions(themeSelect, theme.value);
    expect(themeSelect).toHaveValue(theme.value);
    expect(appRoot).toHaveClass(theme.className);
    expect(window.localStorage.getItem("phantasma-maps:color-theme")).toBe(
      theme.value,
    );
  }

  for (let index = 0; index < 6; index += 1) {
    const isCollapsing = index % 2 === 0;
    const toggle = screen.getByRole("button", {
      name: isCollapsing ? /collapse stats panel/i : /expand stats panel/i,
    });

    await user.click(toggle);

    expect(toggle).toHaveAttribute(
      "aria-expanded",
      isCollapsing ? "false" : "true",
    );
    expect(
      window.localStorage.getItem("phantasma-maps:stats-panel-collapsed"),
    ).toBe(isCollapsing ? "true" : "false");
  }

  await user.click(settingsTrigger);

  let edgeInput = screen.getByRole("textbox", {
    name: /visible connections/i,
  });
  let nodeInput = screen.getByRole("textbox", {
    name: /visible wallets/i,
  });

  await user.clear(edgeInput);
  await user.type(edgeInput, "1450abc");
  await user.clear(nodeInput);
  await user.type(nodeInput, "375xyz");

  expect(edgeInput).toHaveValue("1450");
  expect(nodeInput).toHaveValue("375");
  expect(
    screen.getAllByText(
      /Anything over the default may cause performance issues/i,
    ),
  ).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: /apply/i }));

  await waitFor(() => {
    expect(
      screen.queryByText(/Adjust graph density before rendering/i),
    ).not.toBeInTheDocument();
  });

  await user.click(settingsTrigger);

  edgeInput = screen.getByRole("textbox", {
    name: /visible connections/i,
  });
  nodeInput = screen.getByRole("textbox", {
    name: /visible wallets/i,
  });

  expect(edgeInput).toHaveValue("1450");
  expect(nodeInput).toHaveValue("375");

  await user.keyboard("{Escape}");

  await waitFor(() => {
    expect(
      screen.queryByText(/Adjust graph density before rendering/i),
    ).not.toBeInTheDocument();
  });

  await user.click(settingsTrigger);

  edgeInput = screen.getByRole("textbox", {
    name: /visible connections/i,
  });
  nodeInput = screen.getByRole("textbox", {
    name: /visible wallets/i,
  });

  await user.clear(edgeInput);
  await user.type(edgeInput, "9999");
  await user.clear(nodeInput);
  await user.type(nodeInput, "999");
  await user.click(screen.getByRole("button", { name: /reset defaults/i }));

  await waitFor(() => {
    expect(
      screen.queryByText(/Adjust graph density before rendering/i),
    ).not.toBeInTheDocument();
  });

  await user.click(settingsTrigger);

  expect(
    screen.getByRole("textbox", { name: /visible connections/i }),
  ).toHaveValue("1200");
  expect(screen.getByRole("textbox", { name: /visible wallets/i })).toHaveValue(
    "300",
  );
});

test("max graph setting renders all nodes and edges for the selected token", async () => {
  const user = userEvent.setup();
  const largeGraphPayload = createLargeGraphPayload();

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
        json: async () => largeGraphPayload,
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

  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  await user.click(
    screen.getByRole("button", { name: /open graph settings/i }),
  );

  const initialRenderedStats = container.querySelectorAll(
    ".header-settings-stat strong",
  );
  const initialRenderedNodeCount = Number(
    initialRenderedStats[0].textContent.replace(/,/g, ""),
  );
  const initialRenderedEdgeCount = Number(
    initialRenderedStats[1].textContent.replace(/,/g, ""),
  );

  expect(initialRenderedNodeCount).toBe(300);
  expect(screen.getByRole("button", { name: /use max/i })).toBeEnabled();
  expect(screen.queryByText(/max active/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /use max/i }));

  await waitFor(() => {
    expect(
      screen.queryByText(/Adjust graph density before rendering/i),
    ).not.toBeInTheDocument();
  });
  expect(screen.getByText(/max active/i)).toBeInTheDocument();

  await user.click(
    screen.getByRole("button", { name: /open graph settings/i }),
  );

  const renderedStats = container.querySelectorAll(
    ".header-settings-stat strong",
  );
  const renderedNodeCount = Number(
    renderedStats[0].textContent.replace(/,/g, ""),
  );
  const renderedEdgeCount = Number(
    renderedStats[1].textContent.replace(/,/g, ""),
  );

  expect(renderedNodeCount).toBeGreaterThan(initialRenderedNodeCount);
  expect(renderedEdgeCount).toBeGreaterThan(initialRenderedEdgeCount);
  expect(screen.getByRole("button", { name: /max enabled/i })).toBeDisabled();
});
