import { inferHolderType, normalizeAmount, shortenAddress } from "./graphData";
import { MOCK_TOKEN_DATA_BY_SYMBOL } from "../data/mockData";
import { normalizePositiveInteger } from "../lib/format";

export function getLinkEndpointId(endpoint) {
  if (endpoint && typeof endpoint === "object") {
    return String(endpoint.id || "").trim();
  }

  return String(endpoint || "").trim();
}

export function buildTopHoldersGraph(graphData, holderLimit = 10) {
  const safeNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const safeLinks = Array.isArray(graphData?.links) ? graphData.links : [];

  if (!safeNodes.length) {
    return null;
  }

  const normalizedLimit = normalizePositiveInteger(holderLimit, 10);
  const topHolderNodes = safeNodes
    .slice()
    .sort((left, right) => Number(right?.value || 0) - Number(left?.value || 0))
    .slice(0, normalizedLimit);

  if (!topHolderNodes.length) {
    return null;
  }

  const seedHolderIds = new Set(topHolderNodes.map((node) => node.id));
  const visibleNodeIds = new Set(seedHolderIds);
  const seededLinks = [];

  safeLinks.forEach((link) => {
    const source = getLinkEndpointId(link?.source);
    const target = getLinkEndpointId(link?.target);
    if (!source || !target) return;

    if (seedHolderIds.has(source) || seedHolderIds.has(target)) {
      seededLinks.push(link);
      visibleNodeIds.add(source);
      visibleNodeIds.add(target);
    }
  });

  const visibleLinks = safeLinks.filter((link) => {
    const source = getLinkEndpointId(link?.source);
    const target = getLinkEndpointId(link?.target);
    return visibleNodeIds.has(source) && visibleNodeIds.has(target);
  });
  const visibleNodes = safeNodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleTotal = visibleNodes.reduce(
    (sum, node) => sum + Number(node?.value || 0),
    0,
  );

  return {
    nodes: visibleNodes,
    links: visibleLinks.length ? visibleLinks : seededLinks,
    totalValue: visibleTotal,
    totalSupply: Number(graphData?.totalSupply || 0),
  };
}

export function buildTopHoldersConnectionsGraph({
  topHolders,
  connectionsByAddress,
  fallbackGraph,
  currentSupply,
  decimals = 0,
}) {
  const holderItems = Array.isArray(topHolders) ? topHolders : [];
  const safeConnections = Array.isArray(connectionsByAddress)
    ? connectionsByAddress
    : [];
  const fallbackNodes = Array.isArray(fallbackGraph?.nodes)
    ? fallbackGraph.nodes
    : [];

  if (!holderItems.length) {
    return null;
  }

  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;
  const fallbackNodeById = new Map(
    fallbackNodes.map((node) => [String(node?.id || "").trim(), node]),
  );
  const nodeVolumeMap = new Map();
  const nodeStatsMap = new Map();
  const nodeTransactionCountMap = new Map();
  const linkMap = new Map();
  const totalSupply = Number(currentSupply) || 0;

  function ensureStats(nodeId) {
    if (!nodeStatsMap.has(nodeId)) {
      nodeStatsMap.set(nodeId, {
        sentTransactions: 0,
        receivedTransactions: 0,
      });
    }
    return nodeStatsMap.get(nodeId);
  }

  function addVolume(nodeId, value) {
    const safeValue = Number(value) || 0;
    if (safeValue <= 0) return;
    nodeVolumeMap.set(nodeId, (nodeVolumeMap.get(nodeId) || 0) + safeValue);
  }

  function addTransactionCount(nodeId, count) {
    const safeCount = Number(count) || 0;
    if (safeCount <= 0) return;
    nodeTransactionCountMap.set(
      nodeId,
      (nodeTransactionCountMap.get(nodeId) || 0) + safeCount,
    );
  }

  const holderAddressSet = new Set(
    holderItems
      .map((item) => String(item?.address || "").trim())
      .filter(Boolean),
  );

  holderItems.forEach((item) => {
    const holderId = String(item?.address || "").trim();
    if (!holderId) return;

    const holderValue = normalizeAmount(item?.netBalance) / divisor;
    addVolume(holderId, holderValue);
    ensureStats(holderId);
  });

  safeConnections.forEach(({ address, items }) => {
    const holderId = String(address || "").trim();
    if (!holderId) return;

    const rows = Array.isArray(items) ? items : [];
    rows.forEach((entry) => {
      const counterpartyId = String(entry?.counterparty || "").trim();
      if (!counterpartyId || counterpartyId === holderId) return;

      const rawVolume = normalizeAmount(entry?.totalVolume);
      const normalizedVolume = rawVolume / divisor;
      const txCount = Math.max(
        1,
        Math.floor(Number(entry?.transactionCount) || 0),
      );
      const linkKey = `${holderId}->${counterpartyId}`;

      // Keep holder amount balance-based; connection volume should not inflate it.
      // Skip counterparties that are already top holders — their balance is tracked from holderItems.
      if (!holderAddressSet.has(counterpartyId)) {
        addVolume(counterpartyId, normalizedVolume);
      }

      const holderStats = ensureStats(holderId);
      holderStats.sentTransactions += txCount;
      holderStats.receivedTransactions += txCount;
      addTransactionCount(holderId, txCount);

      const counterpartyStats = ensureStats(counterpartyId);
      counterpartyStats.sentTransactions += txCount;
      counterpartyStats.receivedTransactions += txCount;
      addTransactionCount(counterpartyId, txCount);

      const existingLink = linkMap.get(linkKey);
      if (existingLink) {
        existingLink.transactionVolume += normalizedVolume;
        existingLink.sentTransactions += txCount;
        existingLink.receivedTransactions += txCount;
      } else {
        linkMap.set(linkKey, {
          source: holderId,
          target: counterpartyId,
          transactionVolume: normalizedVolume,
          sentTransactions: txCount,
          receivedTransactions: txCount,
          transactionHash: "",
        });
      }
    });
  });

  if (!nodeVolumeMap.size) {
    return null;
  }

  const nodes = [...nodeVolumeMap.entries()]
    .map(([nodeId, fallbackValue]) => {
      const fallbackNode = fallbackNodeById.get(nodeId);
      const value = Math.max(
        Number(fallbackNode?.value || 0),
        Number(fallbackValue || 0),
      );
      const pct = totalSupply > 0 ? (value / totalSupply) * 100 : 0;
      const stats = ensureStats(nodeId);

      return {
        id: nodeId,
        label:
          String(fallbackNode?.label || "").trim() || shortenAddress(nodeId),
        shortAddr: shortenAddress(nodeId),
        value,
        pct: pct.toFixed(2),
        type: inferHolderType(nodeId, pct),
        sentTransactions: stats.sentTransactions,
        receivedTransactions: stats.receivedTransactions,
        transactionCount: nodeTransactionCountMap.get(nodeId) || 0,
      };
    })
    .sort(
      (left, right) => Number(right?.value || 0) - Number(left?.value || 0),
    );

  return {
    nodes,
    links: [...linkMap.values()],
    totalValue: nodes.reduce((sum, node) => sum + Number(node?.value || 0), 0),
    totalSupply,
  };
}

export function limitGraphForDisplay(
  nodes,
  links,
  maxNodes,
  maxEdges,
  rootNodeId = "",
) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeLinks = Array.isArray(links) ? links : [];

  if (!safeNodes.length) {
    return {
      nodes: [],
      links: [],
    };
  }

  const normalizedMaxEdges = normalizePositiveInteger(
    maxEdges,
    safeLinks.length || 1,
  );
  const normalizedMaxNodes = normalizePositiveInteger(
    maxNodes,
    safeNodes.length || 1,
  );
  const nodeById = new Map(
    safeNodes.map((node) => [String(node?.id || "").trim(), node]),
  );
  const normalizedRootNodeId = String(rootNodeId || "").trim();
  const limitedLinks = safeLinks.slice(0, normalizedMaxEdges);
  const prioritizedNodeIds = [];
  const seenNodeIds = new Set();

  function addNodeId(nodeId) {
    const normalizedNodeId = String(nodeId || "").trim();
    if (!normalizedNodeId || seenNodeIds.has(normalizedNodeId)) return;
    if (!nodeById.has(normalizedNodeId)) return;
    seenNodeIds.add(normalizedNodeId);
    prioritizedNodeIds.push(normalizedNodeId);
  }

  addNodeId(normalizedRootNodeId);

  limitedLinks.forEach((link) => {
    addNodeId(link?.source);
    addNodeId(link?.target);
  });

  safeNodes
    .slice()
    .sort((leftNode, rightNode) => {
      if (String(leftNode?.id || "") === normalizedRootNodeId) return -1;
      if (String(rightNode?.id || "") === normalizedRootNodeId) return 1;
      return Number(rightNode?.value || 0) - Number(leftNode?.value || 0);
    })
    .forEach((node) => addNodeId(node?.id));

  const allowedNodeIds = new Set(
    prioritizedNodeIds.slice(0, normalizedMaxNodes),
  );
  const limitedNodes = safeNodes.filter((node) => allowedNodeIds.has(node.id));
  const fullyLimitedLinks = limitedLinks.filter(
    (link) =>
      allowedNodeIds.has(getLinkEndpointId(link?.source)) &&
      allowedNodeIds.has(getLinkEndpointId(link?.target)),
  );

  return {
    nodes: limitedNodes,
    links: fullyLimitedLinks,
  };
}

export function buildConnectionsGraphFromConnections(
  connections,
  rootAddress,
  fallbackGraph,
  currentSupply = 0,
  minimumConnectionBalance = 0,
) {
  const normalizedRoot = String(rootAddress || "").trim();
  const normalizedMinimumConnectionBalance = normalizeAmount(
    minimumConnectionBalance,
  );
  if (!normalizedRoot || !Array.isArray(connections) || !connections.length) {
    return null;
  }

  const fallbackNodes = Array.isArray(fallbackGraph?.nodes)
    ? fallbackGraph.nodes
    : [];
  const fallbackNodeById = new Map(
    fallbackNodes.map((node) => [node.id, node]),
  );
  const nodeStats = new Map();
  const nodeTransactionCounts = new Map();

  function ensureNodeStats(nodeId) {
    if (!nodeStats.has(nodeId)) {
      nodeStats.set(nodeId, {
        sentTransactions: 0,
        receivedTransactions: 0,
      });
    }
    return nodeStats.get(nodeId);
  }

  function addNodeTransactionCount(nodeId, count) {
    const safeCount = Number(count) || 0;
    if (safeCount <= 0) return;
    nodeTransactionCounts.set(
      nodeId,
      (nodeTransactionCounts.get(nodeId) || 0) + safeCount,
    );
  }

  const links = [];
  const nodeIds = new Set([normalizedRoot]);
  let rootTransactionCount = 0;

  connections.forEach((connection) => {
    const counterparty = String(connection?.counterparty || "").trim();
    if (!counterparty || counterparty === normalizedRoot) return;

    const counterpartyBalance = normalizeAmount(
      fallbackNodeById.get(counterparty)?.value,
    );
    if (counterpartyBalance < normalizedMinimumConnectionBalance) return;

    const volume = normalizeAmount(
      connection?.totalVolume ?? connection?.total_volume,
    );
    const transactionCount = normalizePositiveInteger(
      connection?.transactionCount ?? connection?.transaction_count,
      0,
    );

    links.push({
      source: normalizedRoot,
      target: counterparty,
      transactionVolume: volume,
      sentTransactions: transactionCount,
      receivedTransactions: transactionCount,
    });

    nodeIds.add(counterparty);
    ensureNodeStats(counterparty).receivedTransactions += transactionCount;
    addNodeTransactionCount(counterparty, transactionCount);
    rootTransactionCount += transactionCount;
  });

  if (!links.length) return null;

  ensureNodeStats(normalizedRoot).sentTransactions = rootTransactionCount;
  ensureNodeStats(normalizedRoot).receivedTransactions = rootTransactionCount;
  nodeTransactionCounts.set(normalizedRoot, rootTransactionCount);

  const baseNodes = [...nodeIds].map((nodeId) => {
    const fallbackNode = fallbackNodeById.get(nodeId);
    const knownValue = Number(fallbackNode?.value);
    const value = Number.isFinite(knownValue) ? Math.max(knownValue, 0) : 0;
    const pct =
      Number.isFinite(currentSupply) && currentSupply > 0
        ? (value / currentSupply) * 100
        : Number(fallbackNode?.pct) || 0;
    const label =
      String(fallbackNode?.label || "").trim() || shortenAddress(nodeId);
    const stats = ensureNodeStats(nodeId);

    return {
      ...fallbackNode,
      id: nodeId,
      label,
      shortAddr: fallbackNode?.shortAddr || shortenAddress(nodeId),
      value,
      pct: pct.toFixed(2),
      type: fallbackNode?.type || inferHolderType(label, pct),
      sentTransactions: stats.sentTransactions,
      receivedTransactions: stats.receivedTransactions,
      transactionCount: nodeTransactionCounts.get(nodeId) || 0,
      isSearchRoot: nodeId === normalizedRoot,
    };
  });

  const counterpartyVisualValues = baseNodes
    .filter((node) => node.id !== normalizedRoot)
    .map((node) => Math.max(node.value || 1, 1));
  const maxCounterpartyVisual = counterpartyVisualValues.length
    ? Math.max(...counterpartyVisualValues)
    : 1;

  const emphasizedNodes = baseNodes.map((node) => {
    if (node.id === normalizedRoot) {
      return {
        ...node,
        visualValue: Math.max(node.value || 1, maxCounterpartyVisual * 2.1),
      };
    }

    return {
      ...node,
      visualValue: Math.max(node.value || 1, 1),
    };
  });

  const totalValue = emphasizedNodes.reduce(
    (sum, node) => sum + Number(node.value || 0),
    0,
  );

  return {
    nodes: emphasizedNodes,
    links,
    totalValue,
    rootNodeId: normalizedRoot,
  };
}

export function mergeSummaryNodesWithTopHolders(
  summaryNodes,
  topHolders,
  decimals = 0,
) {
  const safeSummaryNodes = Array.isArray(summaryNodes) ? summaryNodes : [];
  const safeTopHolders = Array.isArray(topHolders) ? topHolders : [];

  if (!safeTopHolders.length) {
    return safeSummaryNodes;
  }

  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;
  const mergedById = new Map(
    safeSummaryNodes.map((node) => [String(node?.id || "").trim(), node]),
  );

  safeTopHolders.forEach((holder) => {
    const address = String(holder?.address || "").trim();
    if (!address) return;

    const holderValue = normalizeAmount(holder?.netBalance) / divisor;
    const existingNode = mergedById.get(address);

    if (existingNode) {
      mergedById.set(address, {
        ...existingNode,
        value: Math.max(Number(existingNode?.value || 0), holderValue),
      });
      return;
    }

    mergedById.set(address, {
      id: address,
      label: shortenAddress(address),
      shortAddr: shortenAddress(address),
      value: holderValue,
      pct: "0.00",
      type: "minor",
      sentTransactions: 0,
      receivedTransactions: 0,
    });
  });

  return [...mergedById.values()];
}

export function getMockTokenData(tokenSymbol) {
  const mockTokenData = MOCK_TOKEN_DATA_BY_SYMBOL[tokenSymbol] || null;
  if (!mockTokenData) return null;

  return {
    ...mockTokenData,
    holders: Array.isArray(mockTokenData.holders)
      ? mockTokenData.holders.map((holder) => ({
          ...holder,
          type: inferHolderType(holder.label, Number(holder.pct)),
        }))
      : [],
  };
}
