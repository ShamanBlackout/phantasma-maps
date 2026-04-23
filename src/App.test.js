import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

  Object.defineProperty(global, "matchMedia", {
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
  global.matchMedia = window.matchMedia;

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

test("keeps settings widgets stable under repeated interaction", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  const appRoot = container.querySelector(".app-root");
  const settingsTrigger = screen.getByRole("button", {
    name: /open graph settings/i,
  });

  await user.click(settingsTrigger);

  const themeSelect = screen.getByRole("combobox", { name: /theme/i });
  const densitySelect = screen.getByRole("combobox", { name: /density/i });

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

  await user.selectOptions(densitySelect, "compact");
  expect(densitySelect).toHaveValue("compact");
  expect(appRoot).toHaveClass("density-compact");
  expect(window.localStorage.getItem("phantasma-maps:density-mode")).toBe(
    "compact",
  );

  await user.selectOptions(densitySelect, "comfortable");
  expect(densitySelect).toHaveValue("comfortable");
  expect(appRoot).toHaveClass("density-comfortable");
  expect(window.localStorage.getItem("phantasma-maps:density-mode")).toBe(
    "comfortable",
  );

  await user.keyboard("{Escape}");

  await waitFor(() => {
    expect(
      screen.queryByText(/Manage view controls and graph rendering density/i),
    ).not.toBeInTheDocument();
  });

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
      screen.queryByText(/Manage view controls and graph rendering density/i),
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
      screen.queryByText(/Manage view controls and graph rendering density/i),
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
      screen.queryByText(/Manage view controls and graph rendering density/i),
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

  expect(initialRenderedNodeCount).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /use max/i })).toBeEnabled();
  expect(screen.queryByText(/max active/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /use max/i }));

  await waitFor(() => {
    expect(
      screen.queryByText(/Manage view controls and graph rendering density/i),
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

test("supports onboarding dismissal and search keyboard shortcut", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByText(/Quick Start/i)).toBeInTheDocument();

  await user.keyboard("/");
  expect(document.getElementById("header-search-input")).toHaveFocus();

  await user.keyboard("{Escape}");

  await waitFor(() => {
    expect(screen.queryByText(/Quick Start/i)).not.toBeInTheDocument();
  });
});

test("renders stable shell across key viewport classes", async () => {
  const viewportCases = [
    { name: "desktop", matchesMobile: false },
    { name: "tablet", matchesMobile: false },
    { name: "mobile-768", matchesMobile: true },
    { name: "mobile-420", matchesMobile: true },
  ];

  for (const viewportCase of viewportCases) {
    window.matchMedia = createMatchMedia(viewportCase.matchesMobile);
    global.matchMedia = window.matchMedia;

    const { container, unmount } = render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /search/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Block Sync/i)).toBeInTheDocument();
      expect(container.querySelector(".app-root")).toBeTruthy();
    });

    unmount();
  }
});

test("keeps diagnostics details out of header sync and inside diagnostics panel", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  const headerSync = container.querySelector(".header-sync");
  expect(headerSync).toBeTruthy();
  expect(headerSync?.textContent || "").not.toMatch(/API\s+(Online|Degraded)/i);
  expect(headerSync?.textContent || "").not.toMatch(/Source:/i);
  expect(headerSync?.textContent || "").not.toMatch(/Sync lag:/i);

  expect(screen.queryByText(/^Source:/i)).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /open diagnostics panel/i }),
  );
  expect(await screen.findByText(/^API health:/i)).toBeInTheDocument();
  expect(await screen.findByText(/^Source:/i)).toBeInTheDocument();
  expect(screen.getByText(/^Map status:/i)).toBeInTheDocument();
});

test("closes shell popouts and trace tool on outside click", async () => {
  const user = userEvent.setup();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  await user.click(screen.getByRole("button", { name: /open saved views/i }));
  expect(
    screen.getByRole("dialog", { name: /saved views/i }),
  ).toBeInTheDocument();
  await user.pointer({ target: document.body, keys: "[MouseLeft]" });
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: /saved views/i }),
    ).not.toBeInTheDocument();
  });

  await user.click(
    screen.getByRole("button", { name: /open export presets/i }),
  );
  expect(
    screen.getByRole("dialog", { name: /export presets/i }),
  ).toBeInTheDocument();
  await user.pointer({ target: document.body, keys: "[MouseLeft]" });
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: /export presets/i }),
    ).not.toBeInTheDocument();
  });

  await user.click(
    screen.getByRole("button", { name: /open diagnostics panel/i }),
  );
  expect(
    screen.getByRole("dialog", { name: /data diagnostics/i }),
  ).toBeInTheDocument();
  await user.pointer({ target: document.body, keys: "[MouseLeft]" });
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: /data diagnostics/i }),
    ).not.toBeInTheDocument();
  });

  await user.click(screen.getByRole("button", { name: /trace path/i }));
  expect(screen.getByText(/From wallet/i)).toBeInTheDocument();
  await user.pointer({ target: document.body, keys: "[MouseLeft]" });
  await waitFor(() => {
    expect(screen.queryByText(/From wallet/i)).not.toBeInTheDocument();
  });
});

test("trace path search filters wallets by address", async () => {
  const user = userEvent.setup();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  await user.click(screen.getByRole("button", { name: /trace path/i }));
  await user.type(
    screen.getByRole("textbox", { name: /search source wallet/i }),
    "Rmj6CiDy",
  );

  const sourceSelect = screen.getByLabelText(/select source wallet/i);

  expect(
    within(sourceSelect).getByRole("option", { name: /Treasury/i }),
  ).toBeInTheDocument();
  expect(
    within(sourceSelect).queryByRole("option", { name: /Whale/i }),
  ).not.toBeInTheDocument();
});

test("compare against loads a snapshot for another token", async () => {
  const user = userEvent.setup();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Showing 2 tracked tokens/i)).toBeInTheDocument();
  });

  await user.type(
    screen.getByPlaceholderText(/search address or holder name/i),
    "Treasury",
  );
  await user.click(screen.getByRole("button", { name: /submit search/i }));

  await user.click(screen.getByRole("button", { name: /open compare mode/i }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: /compare against/i }),
    "KCAL",
  );

  const compareDialog = screen.getByRole("dialog", {
    name: /compare snapshot/i,
  });

  await waitFor(() => {
    expect(
      within(compareDialog).getByText("KCAL", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  expect(within(compareDialog).getAllByText(/Wallets:\s+2/i)).toHaveLength(2);
});
