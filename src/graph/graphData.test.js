import {
  applyCurrentSupplyToNodes,
  buildGraphDataFromApi,
  buildNeighborFocusedGraph,
  buildTracePathGraph,
} from "./graphData";
import { buildTopHoldersConnectionsGraph } from "./graphBuilders";

test("holder enrichment counts normalized bidirectional connections once", () => {
  const graph = buildTopHoldersConnectionsGraph({
    topHolders: [
      { address: "PA", netBalance: "600000000" },
      { address: "PB", netBalance: "400000000" },
    ],
    connectionsByAddress: [
      { address: "PA", items: [{ counterparty: "PB", totalVolume: 1.25, transactionCount: 2 }] },
      { address: "PB", items: [{ counterparty: "PA", totalVolume: 1.25, transactionCount: 2 }] },
    ],
    currentSupply: 10,
    decimals: 8,
  });
  expect(graph.links).toHaveLength(1);
  expect(graph.links[0]).toMatchObject({
    transactionVolume: 1.25,
    bidirectional: true,
  });
  expect(graph.nodes.map(({ value, transactionCount }) => [value, transactionCount]))
    .toEqual([[6, 2], [4, 2]]);
});

test("holder enrichment never substitutes transfer volume for wallet balance", () => {
  const graph = buildTopHoldersConnectionsGraph({
    topHolders: [{ address: "PA", netBalance: "600000000" }],
    connectionsByAddress: [{
      address: "PA",
      items: [
        { counterparty: "PB", totalVolume: 1000, transactionCount: 2 },
        { counterparty: "PC", totalVolume: 10, transactionCount: 1 },
      ],
    }],
    fallbackGraph: { nodes: [{ id: "PB", value: 2 }] },
    currentSupply: 10,
    decimals: 8,
  });
  expect(graph.nodes.map(({ id, value }) => [id, value]))
    .toEqual([["PA", 6], ["PB", 2], ["PC", 0]]);
  expect(graph.totalValue).toBe(8);
});

test("normalizes API balances and combines parallel directed edges", () => {
  const graph = buildGraphDataFromApi(
    {
      totalSupply: 100000,
      nodes: [
        { address: "PA", balance: 60000 },
        { address: "PB", balance: 40000 },
      ],
      edges: [
        { fromAddress: "PA", toAddress: "PB", amount: 1000, txHash: "tx-1" },
        { fromAddress: "PA", toAddress: "PB", amount: 2000, txHash: "tx-2" },
      ],
    },
    3,
  );

  expect(graph.nodes.map(({ value, pct }) => [value, pct])).toEqual([
    [60, "60.00"],
    [40, "40.00"],
  ]);
  expect(graph.links).toEqual([
    {
      source: "PA",
      target: "PB",
      transactionVolume: 3,
      sentTransactions: 2,
      receivedTransactions: 2,
      transactionHash: "tx-1",
    },
  ]);
});

test("prefers API-normalized amounts when token decimals are unknown", () => {
  const graph = buildGraphDataFromApi(
    {
      nodes: [
        {
          address: "PA",
          balance: "123456789012500000",
          balanceNormalized: "1234567890.125",
        },
        { address: "PB", balance: "250000000", balanceNormalized: "2.5" },
        { address: "PC", balance: "500", balanceNormalized: null },
      ],
      edges: [
        {
          fromAddress: "PA",
          toAddress: "PB",
          amount: "150000000",
          amountNormalized: "1.5",
        },
        { fromAddress: "PB", toAddress: "PC", amount: "700" },
      ],
    },
    0,
  );

  expect(graph.nodes.map(({ id, value }) => [id, value])).toEqual([
    ["PA", 1234567890.125],
    ["PB", 2.5],
    ["PC", 500],
  ]);
  expect(
    graph.links.map(({ source, transactionVolume }) => [
      source,
      transactionVolume,
    ]),
  ).toEqual([
    ["PA", 1.5],
    ["PB", 700],
  ]);
});

test("focuses a graph on root connections and emphasizes the root", () => {
  const graph = {
    nodes: [
      { id: "root", value: 20 },
      { id: "near", value: 10 },
      { id: "unrelated", value: 80 },
    ],
    links: [
      { source: "root", target: "near" },
      { source: "near", target: "unrelated" },
    ],
  };

  const focused = buildNeighborFocusedGraph(graph, "root");

  expect(focused.nodes.map((node) => node.id)).toEqual(["root", "near"]);
  expect(focused.nodes[0]).toMatchObject({
    isSearchRoot: true,
    visualValue: 20,
  });
  expect(focused.links).toEqual([{ source: "root", target: "near" }]);
  expect(buildNeighborFocusedGraph(graph, "missing")).toBeNull();
});

test("constructs trace graph nodes and directed links from path results", () => {
  const graph = buildTracePathGraph(
    [{ nodePath: ["PA", "PB", "PC"], hopCount: 2, totalVolume: 20 }],
    new Map([["PB", { id: "PB", label: "Known", value: 4 }]]),
  );

  expect(graph.nodes).toHaveLength(3);
  expect(graph.nodes[1]).toMatchObject({
    id: "PB",
    label: "Known",
    tracePathIndex: 1,
    tracePathLane: 0,
  });
  expect(graph.links.map(({ source, target, transactionVolume }) => [
    source,
    target,
    transactionVolume,
  ])).toEqual([
    ["PA", "PB", 10],
    ["PB", "PC", 10],
  ]);
  expect(buildTracePathGraph([], new Map())).toBeNull();
});

test("recalculates holder shares when current supply is available", () => {
  const nodes = [{ id: "PA", value: 5, pct: "50.00", type: "dominant" }];

  expect(applyCurrentSupplyToNodes(nodes, 100)[0]).toMatchObject({
    pct: "5.00",
    type: "major",
  });
  expect(applyCurrentSupplyToNodes(nodes, 0)).toBe(nodes);
});
