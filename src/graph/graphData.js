export function shortenAddress(address) {
  if (typeof address !== "string" || address.length <= 10)
    return address || "Unknown";
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

export function inferHolderType(label, pct) {
  if (!Number.isFinite(pct) || pct < 0.1) return "minor";
  if (pct < 1) return "medium";
  if (pct < 5) return "large";
  if (pct < 10) return "major";
  return "dominant";
}

export function normalizeAmount(rawAmount) {
  const parsed = Number(rawAmount);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function getLinkKey(source, target) {
  return `${String(source || "").trim()}->${String(target || "").trim()}`;
}

export function applyCurrentSupplyToNodes(nodes, currentSupply) {
  if (!Array.isArray(nodes) || !nodes.length) return [];

  const supplyBase = Number(currentSupply);
  if (!Number.isFinite(supplyBase) || supplyBase <= 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const value = Number(node?.value) || 0;
    const pct = (value / supplyBase) * 100;

    return {
      ...node,
      pct: pct.toFixed(2),
      type: inferHolderType(node?.label, pct),
    };
  });
}

export function buildGraphDataFromApi(graphPayload, decimals = 0) {
  const apiNodes = Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : [];
  const apiEdges = Array.isArray(graphPayload?.edges) ? graphPayload.edges : [];

  if (!apiNodes.length) {
    return null;
  }

  const divisor =
    Number.isFinite(decimals) && decimals > 0 ? Math.pow(10, decimals) : 1;
  const payloadTotalSupply =
    normalizeAmount(graphPayload?.totalSupply) / divisor;
  const nodeStats = new Map();

  for (const edge of apiEdges) {
    const from = String(edge?.fromAddress || "").trim();
    const to = String(edge?.toAddress || "").trim();

    if (!from || !to) continue;

    nodeStats.set(from, {
      sentTransactions: (nodeStats.get(from)?.sentTransactions || 0) + 1,
      receivedTransactions: nodeStats.get(from)?.receivedTransactions || 0,
    });
    nodeStats.set(to, {
      sentTransactions: nodeStats.get(to)?.sentTransactions || 0,
      receivedTransactions: (nodeStats.get(to)?.receivedTransactions || 0) + 1,
    });
  }

  const discoveredTotal = apiNodes.reduce(
    (sum, node) => sum + normalizeAmount(node?.balance) / divisor,
    0,
  );
  const shareBase =
    payloadTotalSupply > 0 ? payloadTotalSupply : discoveredTotal || 1;

  const mappedNodes = apiNodes
    .map((node) => {
      const id = String(node?.address || "").trim();
      if (!id) return null;

      const value = normalizeAmount(node?.balance) / divisor;
      const pct = (value / shareBase) * 100;
      const label = String(node?.label || "").trim() || shortenAddress(id);
      const type = inferHolderType(label, pct);
      const stats = nodeStats.get(id) || {
        sentTransactions: 0,
        receivedTransactions: 0,
      };

      return {
        id,
        label,
        shortAddr: shortenAddress(id),
        value,
        pct: pct.toFixed(2),
        type,
        sentTransactions: stats.sentTransactions,
        receivedTransactions: stats.receivedTransactions,
        transactionCount: stats.sentTransactions + stats.receivedTransactions,
      };
    })
    .filter(Boolean);

  const validNodeIds = new Set(mappedNodes.map((node) => node.id));
  const edgeMap = new Map();

  for (const edge of apiEdges) {
    const source = String(edge?.fromAddress || "").trim();
    const target = String(edge?.toAddress || "").trim();

    if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue;

    const key = getLinkKey(source, target);
    const prev = edgeMap.get(key);

    if (!prev) {
      edgeMap.set(key, {
        source,
        target,
        transactionVolume: normalizeAmount(edge?.amount) / divisor,
        sentTransactions: 1,
        receivedTransactions: 1,
        transactionHash: String(edge?.txHash || ""),
      });
      continue;
    }

    prev.transactionVolume += normalizeAmount(edge?.amount) / divisor;
    prev.sentTransactions += 1;
    prev.receivedTransactions += 1;
  }

  return {
    nodes: mappedNodes,
    links: [...edgeMap.values()],
    totalValue: discoveredTotal,
    totalSupply: payloadTotalSupply > 0 ? payloadTotalSupply : 0,
  };
}

export function buildNeighborFocusedGraph(graphData, rootAddress) {
  const normalizedRoot = String(rootAddress || "").trim();
  if (!normalizedRoot) return graphData;

  const rootNode = graphData.nodes.find((node) => node.id === normalizedRoot);
  if (!rootNode) return null;

  const neighboringLinks = graphData.links.filter(
    (link) => link.source === normalizedRoot || link.target === normalizedRoot,
  );

  if (!neighboringLinks.length) {
    return {
      nodes: [
        {
          ...rootNode,
          isSearchRoot: true,
          visualValue: Math.max(rootNode.value || 1, 10),
        },
      ],
      links: [],
      totalValue: rootNode.value || 0,
      rootNodeId: normalizedRoot,
    };
  }

  const visibleNodeIds = new Set([normalizedRoot]);
  neighboringLinks.forEach((link) => {
    visibleNodeIds.add(link.source);
    visibleNodeIds.add(link.target);
  });

  const scopedNodes = graphData.nodes.filter((node) =>
    visibleNodeIds.has(node.id),
  );
  const neighborVisualValues = scopedNodes
    .filter((node) => node.id !== normalizedRoot)
    .map((node) => Math.max((node.value || 1) * 0.35, 1));
  const maxNeighborVisual = neighborVisualValues.length
    ? Math.max(...neighborVisualValues)
    : 1;

  const emphasizedNodes = scopedNodes.map((node) => {
    if (node.id === normalizedRoot) {
      return {
        ...node,
        isSearchRoot: true,
        visualValue: Math.max(node.value || 1, maxNeighborVisual * 2.1),
      };
    }

    return {
      ...node,
      isSearchRoot: false,
      visualValue: Math.max((node.value || 1) * 0.35, 1),
    };
  });

  return {
    nodes: emphasizedNodes,
    links: neighboringLinks,
    totalValue: emphasizedNodes.reduce(
      (sum, node) => sum + Number(node.value || 0),
      0,
    ),
    rootNodeId: normalizedRoot,
  };
}

export function buildTracePathGraph(pathItems, knownNodesById) {
  const normalizedPaths = (Array.isArray(pathItems) ? pathItems : [])
    .map((item) => {
      const nodePath = Array.isArray(item?.nodePath)
        ? item.nodePath
            .map((nodeId) => String(nodeId || "").trim())
            .filter(Boolean)
        : [];

      return {
        item,
        nodePath,
      };
    })
    .filter((entry) => entry.nodePath.length >= 2);

  if (!normalizedPaths.length) {
    return null;
  }

  const nodeMap = new Map();
  const linkMap = new Map();

  normalizedPaths.forEach(({ item, nodePath }, pathLaneIndex) => {
    const hopCount = Math.max(1, Number(item?.hopCount) || nodePath.length - 1);
    const totalVolume = Math.max(0, Number(item?.totalVolume) || 0);
    const averageLinkVolume = hopCount > 0 ? totalVolume / hopCount : 1;
    const fallbackNodeValue = Math.max(averageLinkVolume, 1);

    nodePath.forEach((nodeId, hopIndex) => {
      const existingNode = nodeMap.get(nodeId);
      if (existingNode) {
        existingNode.visualValue = Math.max(
          Number(existingNode.visualValue) || 0,
          fallbackNodeValue,
        );
        existingNode.tracePathIndex = Math.min(
          Number(existingNode.tracePathIndex) || hopIndex,
          hopIndex,
        );
        if (!existingNode.tracePathLanes.includes(pathLaneIndex)) {
          existingNode.tracePathLanes.push(pathLaneIndex);
        }
        return;
      }

      const knownNode = knownNodesById.get(nodeId);
      if (knownNode) {
        nodeMap.set(nodeId, {
          ...knownNode,
          isTracePathNode: true,
          tracePathIndex: hopIndex,
          tracePathLanes: [pathLaneIndex],
          visualValue: Math.max(
            Number(knownNode.visualValue) || Number(knownNode.value) || 0,
            fallbackNodeValue,
          ),
        });
        return;
      }

      nodeMap.set(nodeId, {
        id: nodeId,
        label: shortenAddress(nodeId),
        shortAddr: shortenAddress(nodeId),
        value: fallbackNodeValue,
        visualValue: fallbackNodeValue,
        pct: "0.00",
        type: inferHolderType(nodeId, 0),
        sentTransactions: 0,
        receivedTransactions: 0,
        transactionCount: 0,
        isTracePathNode: true,
        tracePathIndex: hopIndex,
        tracePathLanes: [pathLaneIndex],
      });
    });

    for (let index = 0; index < nodePath.length - 1; index += 1) {
      const source = nodePath[index];
      const target = nodePath[index + 1];
      const forwardKey = getLinkKey(source, target);
      const existingLink = linkMap.get(forwardKey);

      if (existingLink) {
        existingLink.transactionVolume =
          Number(existingLink.transactionVolume || 0) + averageLinkVolume;
        existingLink.tracePathIndex = Math.min(
          Number(existingLink.tracePathIndex) || index,
          index,
        );
        if (!existingLink.tracePathLanes.includes(pathLaneIndex)) {
          existingLink.tracePathLanes.push(pathLaneIndex);
        }
        continue;
      }

      linkMap.set(forwardKey, {
        source,
        target,
        transactionVolume: averageLinkVolume,
        tracePathIndex: index,
        tracePathLanes: [pathLaneIndex],
      });
    }
  });

  const nodes = Array.from(nodeMap.values()).map((node) => ({
    ...node,
    tracePathLane: Math.min(...(node.tracePathLanes || [0])),
  }));
  const links = Array.from(linkMap.values()).map((link) => ({
    ...link,
    tracePathLane: Math.min(...(link.tracePathLanes || [0])),
  }));

  return {
    nodes,
    links,
  };
}
