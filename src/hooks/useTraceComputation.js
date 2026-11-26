import { useMemo } from "react";
import { getLinkEndpointId } from "../graph/graphBuilders";
import { getLinkKey } from "../graph/graphData";

export default function useTraceComputation({
  filteredLinks,
  traceFromNodeId,
  traceToNodeId,
}) {
  return useMemo(() => {
    const fromId = String(traceFromNodeId || "").trim();
    const toId = String(traceToNodeId || "").trim();
    if (!fromId || !toId || fromId === toId) {
      return {
        nodeIds: [],
        linkKeys: [],
        relevanceScore: null,
        status:
          fromId && toId && fromId === toId
            ? "Select two different wallets to trace a path."
            : "",
      };
    }

    const adjacency = new Map();
    const pairVolumeMap = new Map();
    let maxPairVolume = 0;
    filteredLinks.forEach((link) => {
      const source = getLinkEndpointId(link?.source);
      const target = getLinkEndpointId(link?.target);
      if (!source || !target) return;
      if (!adjacency.has(source)) adjacency.set(source, []);
      if (!adjacency.has(target)) adjacency.set(target, []);
      adjacency.get(source).push(target);
      adjacency.get(target).push(source);

      const pairKey = [source, target].sort().join("::");
      const nextVolume =
        (pairVolumeMap.get(pairKey) || 0) +
        (Number(link?.transactionVolume) || 0);
      pairVolumeMap.set(pairKey, nextVolume);
      if (nextVolume > maxPairVolume) {
        maxPairVolume = nextVolume;
      }
    });

    if (!adjacency.has(fromId) || !adjacency.has(toId)) {
      return {
        nodeIds: [],
        linkKeys: [],
        relevanceScore: null,
        status:
          "Selected wallets are not connected in the current visible graph.",
      };
    }

    const queue = [fromId];
    const visited = new Set([fromId]);
    const prev = new Map();

    while (queue.length) {
      const current = queue.shift();
      if (current === toId) break;
      (adjacency.get(current) || []).forEach((nextNodeId) => {
        if (visited.has(nextNodeId)) return;
        visited.add(nextNodeId);
        prev.set(nextNodeId, current);
        queue.push(nextNodeId);
      });
    }

    if (!visited.has(toId)) {
      return {
        nodeIds: [],
        linkKeys: [],
        relevanceScore: null,
        status: "No path found between these wallets in the current view.",
      };
    }

    const pathNodeIds = [];
    let cursor = toId;
    while (cursor) {
      pathNodeIds.push(cursor);
      if (cursor === fromId) break;
      cursor = prev.get(cursor);
    }
    pathNodeIds.reverse();

    const pathLinkKeys = [];
    let pathVolumeTotal = 0;
    for (let index = 0; index < pathNodeIds.length - 1; index += 1) {
      const left = pathNodeIds[index];
      const right = pathNodeIds[index + 1];
      pathLinkKeys.push(getLinkKey(left, right));
      pathLinkKeys.push(getLinkKey(right, left));

      const pairKey = [left, right].sort().join("::");
      pathVolumeTotal += pairVolumeMap.get(pairKey) || 0;
    }

    const hopCount = Math.max(0, pathNodeIds.length - 1);
    const averageHopVolume = hopCount > 0 ? pathVolumeTotal / hopCount : 0;
    const hopScore =
      hopCount <= 1 ? 100 : Math.max(28, 100 - (hopCount - 1) * 16);
    const volumeScore =
      maxPairVolume > 0
        ? Math.min(24, (averageHopVolume / maxPairVolume) * 24)
        : 0;
    const relevanceScore = Math.round(
      Math.max(20, Math.min(100, hopScore + volumeScore)),
    );
    const relevanceLabel =
      relevanceScore >= 80
        ? "strong"
        : relevanceScore >= 60
          ? "moderate"
          : "light";

    return {
      nodeIds: pathNodeIds,
      linkKeys: pathLinkKeys,
      relevanceScore,
      status: `Trace path found across ${hopCount} hop(s). Relevance ${relevanceScore}/100 (${relevanceLabel}).`,
    };
  }, [filteredLinks, traceFromNodeId, traceToNodeId]);
}
