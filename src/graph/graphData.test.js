import {
  applyCurrentSupplyToNodes,
  buildGraphDataFromApi,
  buildNeighborFocusedGraph,
  buildTracePathGraph,
} from "./graphData";

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
