import { useEffect } from "react";
import {
  buildApiErrorRecord,
  buildTokenNotFoundStatus,
  formatApiErrorMeta,
  isTokenNotFoundError,
} from "../api/apiErrors";
import {
  MAPS_API_BASE_URL,
  MAPS_API_GRAPH_DEPTH,
  MAPS_API_GRAPH_EDGE_LIMIT,
  MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
  MAPS_API_REQUEST_TIMEOUT_MS,
  resolveMapLoadingProfile,
} from "../config/appConfig";
import {
  buildGraphDataFromApi,
  buildNeighborFocusedGraph,
  shortenAddress,
} from "../graph/graphData";
import {
  createGraphEndpoint as buildGraphEndpoint,
  fetchConnectionsForAddress as fetchConnectionsForAddressFromApi,
  fetchTopHolders as fetchTopHoldersFromApi,
} from "../api/mapsApi";
import { fetchJsonWithTimeout } from "../api/http";
import {
  buildConnectionsGraphFromConnections,
  buildTopHoldersConnectionsGraph,
  buildTopHoldersGraph,
  mergeSummaryNodesWithTopHolders,
} from "../graph/graphBuilders";

export default function useTokenGraphLoader({
  activeGraphRootAddress,
  activeTokenInfo,
  apiTokenInfo,
  graphEdgeLimit,
  graphNodeLimit,
  isConnectionsView,
  isGraphEnrichmentEnabled,
  isGraphMaxModeEnabled,
  mapRefreshNonce,
  searchedRootAddress,
  selectedMockTokenData,
  selectedTokenSymbol,
  setConnectionsGraphContext,
  setHoveredNode,
  setIsGraphEnrichmentEnabled,
  setIsGraphEnrichmentLoading,
  setIsMapLoading,
  setIsMapLoadingReadyState,
  setIsUsingMockApiFallback,
  setLastApiError,
  setMapDataStatus,
  setMapLinks,
  setMapLoadingDisplayedPhase,
  setMapLoadingEvidence,
  setMapLoadingProfile,
  setMapLoadingProgress,
  setMapNodes,
  setOverallMaxGraphStats,
  setSelectedNode,
  setSummaryNodes,
  setTokenSelectorStatus,
  setTrackedTokenSupply,
}) {
  useEffect(() => {
    let isMounted = true;

    async function fetchMapGraph() {
      function applyTokenNotFoundGraphState(errorLike, source = "graph") {
        setLastApiError(
          buildApiErrorRecord(
            errorLike,
            source,
            "Requested token is not available in the database",
          ),
        );
        setIsUsingMockApiFallback(false);
        setTrackedTokenSupply(0);
        setMapNodes([]);
        setSummaryNodes([]);
        setMapLinks([]);
        setMapLoadingEvidence({ wallets: 0, links: 0 });
        setMapDataStatus(
          buildTokenNotFoundStatus(selectedTokenSymbol, errorLike),
        );
        setIsMapLoading(false);
      }

      const defaultLoadingProfile = resolveMapLoadingProfile(200, 300);
      setIsMapLoading(true);
      setIsMapLoadingReadyState(false);
      setMapLoadingProgress(8);
      setMapLoadingProfile(defaultLoadingProfile);
      setMapLoadingEvidence({ wallets: null, links: null });
      setMapLoadingDisplayedPhase("balances");
      setSelectedNode(null);
      setHoveredNode(null);
      setMapDataStatus(
        activeGraphRootAddress
          ? `Generating maps for ${selectedTokenSymbol} around ${shortenAddress(activeGraphRootAddress)}...`
          : `Generating maps for ${selectedTokenSymbol}...`,
      );

      const effectiveGraphEdgeLimit = graphEdgeLimit;
      const isTopLevelTokenRequest =
        !isConnectionsView &&
        !String(searchedRootAddress || "").trim() &&
        !String(activeGraphRootAddress || "").trim();
      const shouldUseMaxEndpoint =
        isTopLevelTokenRequest && isGraphMaxModeEnabled;

      const graphEndpoint = buildGraphEndpoint(
        MAPS_API_BASE_URL,
        selectedTokenSymbol,
        {
          rootAddress: activeGraphRootAddress || "",
          depth: MAPS_API_GRAPH_DEPTH,
          edgeLimit: effectiveGraphEdgeLimit,
          defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
          useMaxEndpoint: shouldUseMaxEndpoint,
          topHoldersLimit: shouldUseMaxEndpoint
            ? MAPS_API_GRAPH_TOP_HOLDERS_LIMIT
            : 0,
        },
      );
      let result = await fetchJsonWithTimeout(
        graphEndpoint,
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!result.ok && shouldUseMaxEndpoint) {
        const standardGraphFallbackEndpoint = buildGraphEndpoint(
          MAPS_API_BASE_URL,
          selectedTokenSymbol,
          {
            rootAddress: "",
            depth: MAPS_API_GRAPH_DEPTH,
            edgeLimit: effectiveGraphEdgeLimit,
            defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
            useMaxEndpoint: false,
            topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          },
        );

        const standardGraphFallbackResult = await fetchJsonWithTimeout(
          standardGraphFallbackEndpoint,
          {},
          MAPS_API_REQUEST_TIMEOUT_MS,
        );

        if (standardGraphFallbackResult.ok) {
          result = standardGraphFallbackResult;
          setMapDataStatus(
            `Max graph view is temporarily unavailable. Showing the standard ${selectedTokenSymbol} live map instead.`,
          );
        }
      }

      setMapLoadingProgress(42);

      if (!isMounted) return;

      if (!result.ok) {
        setLastApiError(
          buildApiErrorRecord(result, "graph", "Graph request failed"),
        );

        if (isTokenNotFoundError(result)) {
          applyTokenNotFoundGraphState(result, "graph");
          return;
        }

        if (isConnectionsView && activeGraphRootAddress) {
          try {
            const connectionsResult = await fetchConnectionsForAddressFromApi(
              MAPS_API_BASE_URL,
              MAPS_API_REQUEST_TIMEOUT_MS,
              activeGraphRootAddress,
              selectedTokenSymbol,
            );

            let balanceFallbackGraph = null;
            const tokenGraphFallbackEndpoint = buildGraphEndpoint(
              MAPS_API_BASE_URL,
              selectedTokenSymbol,
              {
                rootAddress: "",
                depth: MAPS_API_GRAPH_DEPTH,
                edgeLimit: effectiveGraphEdgeLimit,
                defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
                topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
              },
            );
            const tokenGraphFallbackResult = await fetchJsonWithTimeout(
              tokenGraphFallbackEndpoint,
              {},
              MAPS_API_REQUEST_TIMEOUT_MS,
            );

            if (isTokenNotFoundError(tokenGraphFallbackResult)) {
              applyTokenNotFoundGraphState(tokenGraphFallbackResult, "graph");
              return;
            }

            if (tokenGraphFallbackResult.ok) {
              const graphDecimals = apiTokenInfo?.decimals ?? 0;
              balanceFallbackGraph = buildGraphDataFromApi(
                tokenGraphFallbackResult.payload,
                graphDecimals,
              );
            }

            if (!isMounted) return;

            setConnectionsGraphContext({
              items: Array.isArray(connectionsResult.items)
                ? connectionsResult.items
                : [],
              rootAddress: activeGraphRootAddress,
              fallbackGraph: balanceFallbackGraph,
              currentSupply:
                Number(balanceFallbackGraph?.totalSupply) ||
                Number(activeTokenInfo?.currentSupply) ||
                Number(activeTokenInfo?.totalSupply) ||
                0,
            });

            const tableFocusedGraph = buildConnectionsGraphFromConnections(
              connectionsResult.items,
              activeGraphRootAddress,
              balanceFallbackGraph,
              Number(balanceFallbackGraph?.totalSupply) ||
                Number(activeTokenInfo?.currentSupply) ||
                Number(activeTokenInfo?.totalSupply) ||
                0,
            );

            if (
              tableFocusedGraph &&
              Array.isArray(tableFocusedGraph.nodes) &&
              tableFocusedGraph.nodes.length
            ) {
              setMapLoadingEvidence({
                wallets: tableFocusedGraph.nodes.length,
                links: Array.isArray(tableFocusedGraph.links)
                  ? tableFocusedGraph.links.length
                  : 0,
              });
              setIsUsingMockApiFallback(false);
              setMapNodes(tableFocusedGraph.nodes);
              setSummaryNodes(tableFocusedGraph.nodes);
              setMapLinks(tableFocusedGraph.links);
              setTrackedTokenSupply(tableFocusedGraph.totalValue || 0);

              if (tableFocusedGraph.rootNodeId) {
                const focusedRootNode = tableFocusedGraph.nodes.find(
                  (node) => node.id === tableFocusedGraph.rootNodeId,
                );
                setSelectedNode(focusedRootNode || null);
              }

              setMapDataStatus(
                `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:table-only]`,
              );
              setMapLoadingProgress(100);
              setIsMapLoading(false);
              return;
            }
          } catch (error) {
            if (!isMounted) return;
            if (isTokenNotFoundError(error)) {
              applyTokenNotFoundGraphState(error, "connections");
              return;
            }
            // Fall through to status handling below.
          }
        }

        if (activeGraphRootAddress && !isConnectionsView) {
          try {
            const tokenGraphFallbackEndpoint = buildGraphEndpoint(
              MAPS_API_BASE_URL,
              selectedTokenSymbol,
              {
                rootAddress: "",
                depth: MAPS_API_GRAPH_DEPTH,
                edgeLimit: effectiveGraphEdgeLimit,
                defaultEdgeLimit: MAPS_API_GRAPH_EDGE_LIMIT,
                topHoldersLimit: MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
              },
            );
            const tokenGraphFallbackResult = await fetchJsonWithTimeout(
              tokenGraphFallbackEndpoint,
              {},
              MAPS_API_REQUEST_TIMEOUT_MS,
            );

            if (isTokenNotFoundError(tokenGraphFallbackResult)) {
              applyTokenNotFoundGraphState(tokenGraphFallbackResult, "graph");
              return;
            }

            if (tokenGraphFallbackResult.ok) {
              const graphDecimals = apiTokenInfo?.decimals ?? 0;
              const fallbackGraph = buildGraphDataFromApi(
                tokenGraphFallbackResult.payload,
                graphDecimals,
              );
              const focusedFallbackGraph = buildNeighborFocusedGraph(
                fallbackGraph,
                activeGraphRootAddress,
              );

              if (
                focusedFallbackGraph &&
                Array.isArray(focusedFallbackGraph.nodes) &&
                focusedFallbackGraph.nodes.length
              ) {
                if (!isMounted) return;

                setIsUsingMockApiFallback(false);
                setTrackedTokenSupply(
                  Number(fallbackGraph?.totalSupply) ||
                    Number(focusedFallbackGraph.totalValue) ||
                    0,
                );
                setMapNodes(focusedFallbackGraph.nodes);
                setSummaryNodes(focusedFallbackGraph.nodes);
                setMapLinks(focusedFallbackGraph.links || []);
                setMapLoadingEvidence({
                  wallets: focusedFallbackGraph.nodes.length,
                  links: Array.isArray(focusedFallbackGraph.links)
                    ? focusedFallbackGraph.links.length
                    : 0,
                });

                if (focusedFallbackGraph.rootNodeId) {
                  const focusedRootNode = focusedFallbackGraph.nodes.find(
                    (node) => node.id === focusedFallbackGraph.rootNodeId,
                  );
                  setSelectedNode(focusedRootNode || null);
                }

                setMapDataStatus(
                  `This wallet's detailed graph is temporarily unavailable. Showing related wallets from the ${selectedTokenSymbol} token network around ${shortenAddress(activeGraphRootAddress)} instead.`,
                );
                setMapLoadingProgress(100);
                setIsMapLoading(false);
                return;
              }
            }
          } catch (error) {
            if (!isMounted) return;
            if (isTokenNotFoundError(error)) {
              applyTokenNotFoundGraphState(error, "graph");
              return;
            }
            // Fall through to status handling below.
          }
        }

        if (result.status === 0) {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus(
              `Unable to load wallet connections right now. Please check your network and try again.${formatApiErrorMeta(result)}`,
            );
            setMapLoadingEvidence({ wallets: null, links: null });
          } else {
            const fallbackNodes = selectedMockTokenData?.holders || [];
            const fallbackLinks = selectedMockTokenData?.links || [];
            const hasMockFallback = fallbackNodes.length > 0;

            setIsUsingMockApiFallback(hasMockFallback);
            if (hasMockFallback) {
              setTrackedTokenSupply(
                selectedMockTokenData?.tokenInfo?.totalSupply || 0,
              );
              setMapNodes(fallbackNodes);
              setSummaryNodes(fallbackNodes);
              setMapLinks(fallbackLinks);
              setMapLoadingEvidence({
                wallets: fallbackNodes.length,
                links: fallbackLinks.length,
              });
              setTokenSelectorStatus("API unavailable; showing mock tokens");
              setMapDataStatus(
                `Using cached data while the network service recovers...${formatApiErrorMeta(result)}`,
              );
            } else {
              setTrackedTokenSupply(0);
              setMapNodes([]);
              setSummaryNodes([]);
              setMapLinks([]);
              setMapLoadingEvidence({ wallets: 0, links: 0 });
              setMapDataStatus(
                `Unable to load ${selectedTokenSymbol} from the live API. The token selector remains available; retry when the API recovers.${formatApiErrorMeta(result)}`,
              );
            }
          }
        } else {
          if (isConnectionsView) {
            setIsUsingMockApiFallback(false);
            setMapDataStatus(
              `Couldn't load wallet connections (error ${result.status}). Try again or explore the token map.${formatApiErrorMeta(result)}`,
            );
          } else {
            setIsUsingMockApiFallback(false);
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setSummaryNodes([]);
            setMapLinks([]);
            setMapDataStatus(
              `Network service temporarily unavailable (error ${result.status}). Retrying...${formatApiErrorMeta(result)}`,
            );
          }
        }
        setIsMapLoading(false);
        return;
      }

      setIsUsingMockApiFallback(false);
      setMapLoadingProgress(62);

      const graphDecimals = apiTokenInfo?.decimals ?? 0;
      const mappedGraph = buildGraphDataFromApi(result.payload, graphDecimals);
      const shouldTrackOverallMaxStats =
        !isConnectionsView && !String(activeGraphRootAddress || "").trim();
      const applyResolvedGraphState = ({
        focusedGraph,
        summaryNodes,
        mapLinks,
        baseGraph,
        usedConnectionsTable = false,
      }) => {
        if (shouldTrackOverallMaxStats) {
          const mappedLinkCount = Array.isArray(mappedGraph?.links)
            ? mappedGraph.links.length
            : 0;
          const baseLinkCount = Array.isArray(baseGraph?.links)
            ? baseGraph.links.length
            : 0;

          setOverallMaxGraphStats({
            wallets: Array.isArray(summaryNodes) ? summaryNodes.length : 0,
            connections: Math.max(mappedLinkCount, baseLinkCount),
          });
        }

        setMapNodes(focusedGraph.nodes);
        setSummaryNodes(summaryNodes);
        setMapLinks(mapLinks);
        setMapLoadingEvidence({
          wallets: Array.isArray(summaryNodes) ? summaryNodes.length : 0,
          links: Array.isArray(mapLinks) ? mapLinks.length : 0,
        });
        setMapLoadingProgress(94);
        setTrackedTokenSupply(
          mappedGraph?.totalSupply > 0
            ? mappedGraph.totalSupply
            : focusedGraph.totalValue || 0,
        );
        if (focusedGraph.rootNodeId) {
          const focusedRootNode = focusedGraph.nodes.find(
            (node) => node.id === focusedGraph.rootNodeId,
          );
          setSelectedNode(focusedRootNode || null);
        }
        setMapDataStatus(
          activeGraphRootAddress
            ? isConnectionsView
              ? usedConnectionsTable
                ? `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:table]`
                : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)} [connections-phase:base]`
              : `Live graph loaded for ${shortenAddress(activeGraphRootAddress)}`
            : `Live graph loaded from ${graphEndpoint}`,
        );
        setMapLoadingProgress(100);
        setIsMapLoading(false);
      };
      setMapLoadingProfile(
        resolveMapLoadingProfile(
          Array.isArray(mappedGraph?.nodes) ? mappedGraph.nodes.length : 0,
          Array.isArray(mappedGraph?.links) ? mappedGraph.links.length : 0,
        ),
      );
      setMapLoadingEvidence({
        wallets: Array.isArray(mappedGraph?.nodes)
          ? mappedGraph.nodes.length
          : 0,
        links: Array.isArray(mappedGraph?.links) ? mappedGraph.links.length : 0,
      });

      const isTopLevelTokenGraph = isTopLevelTokenRequest;

      const shouldFetchTopHolders =
        isTopLevelTokenGraph &&
        !isGraphMaxModeEnabled &&
        MAPS_API_GRAPH_TOP_HOLDERS_LIMIT > 0 &&
        isGraphEnrichmentEnabled;

      const shouldApplyTopHoldersSeed = shouldFetchTopHolders;

      let seededGraph = null;
      let topHoldersForSummary = [];

      if (!shouldFetchTopHolders) {
        setIsGraphEnrichmentLoading(false);
      }

      if (shouldFetchTopHolders && Array.isArray(mappedGraph?.nodes)) {
        applyResolvedGraphState({
          focusedGraph: mappedGraph,
          summaryNodes: mappedGraph.nodes,
          mapLinks: Array.isArray(mappedGraph?.links) ? mappedGraph.links : [],
          baseGraph: mappedGraph,
        });
      }

      if (shouldFetchTopHolders) {
        setIsGraphEnrichmentLoading(true);
        try {
          const topHoldersResult = await fetchTopHoldersFromApi(
            MAPS_API_BASE_URL,
            MAPS_API_REQUEST_TIMEOUT_MS,
            selectedTokenSymbol,
            MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          );
          topHoldersForSummary = Array.isArray(topHoldersResult.items)
            ? topHoldersResult.items
            : [];

          if (shouldApplyTopHoldersSeed) {
            const topHolderAddresses = topHoldersResult.items
              .map((item) => String(item?.address || "").trim())
              .filter(Boolean);

            const connectionPayloads = await Promise.all(
              topHolderAddresses.map(async (address) => {
                try {
                  const result = await fetchConnectionsForAddressFromApi(
                    MAPS_API_BASE_URL,
                    MAPS_API_REQUEST_TIMEOUT_MS,
                    address,
                    selectedTokenSymbol,
                  );

                  return {
                    address,
                    items: result.items,
                  };
                } catch (error) {
                  if (isTokenNotFoundError(error)) {
                    throw error;
                  }
                  return {
                    address,
                    items: [],
                  };
                }
              }),
            );

            const topHolderConnectionsGraph = buildTopHoldersConnectionsGraph({
              topHolders: topHoldersResult.items,
              connectionsByAddress: connectionPayloads,
              fallbackGraph: mappedGraph,
              currentSupply: mappedGraph?.totalSupply || 0,
              decimals: graphDecimals,
            });

            if (shouldApplyTopHoldersSeed) {
              seededGraph = topHolderConnectionsGraph;
            }
          }
        } catch (error) {
          if (!isMounted) return;
          if (isTokenNotFoundError(error)) {
            applyTokenNotFoundGraphState(error, "top-holders");
            return;
          }
          setIsGraphEnrichmentEnabled(false);
          seededGraph = null;
        } finally {
          if (isMounted) {
            setIsGraphEnrichmentLoading(false);
          }
        }

        if (!seededGraph && shouldApplyTopHoldersSeed) {
          seededGraph = buildTopHoldersGraph(
            mappedGraph,
            MAPS_API_GRAPH_TOP_HOLDERS_LIMIT,
          );
        }
      }

      const baseGraph = seededGraph || mappedGraph;
      const baseFocusedGraph = isConnectionsView
        ? baseGraph
        : searchedRootAddress
          ? buildNeighborFocusedGraph(baseGraph, activeGraphRootAddress)
          : baseGraph;
      let focusedGraph = baseFocusedGraph;
      let usedConnectionsTable = false;

      if (isConnectionsView && activeGraphRootAddress) {
        try {
          setMapLoadingProgress(74);
          const connectionsResult = await fetchConnectionsForAddressFromApi(
            MAPS_API_BASE_URL,
            MAPS_API_REQUEST_TIMEOUT_MS,
            activeGraphRootAddress,
            selectedTokenSymbol,
          );

          setMapLoadingProgress(84);

          if (!isMounted) return;

          setConnectionsGraphContext({
            items: Array.isArray(connectionsResult.items)
              ? connectionsResult.items
              : [],
            rootAddress: activeGraphRootAddress,
            fallbackGraph: mappedGraph,
            currentSupply: mappedGraph?.totalSupply || 0,
          });

          const tableFocusedGraph = buildConnectionsGraphFromConnections(
            connectionsResult.items,
            activeGraphRootAddress,
            mappedGraph,
            mappedGraph?.totalSupply || 0,
          );

          if (
            tableFocusedGraph &&
            Array.isArray(tableFocusedGraph.nodes) &&
            tableFocusedGraph.nodes.length
          ) {
            focusedGraph = tableFocusedGraph;
            usedConnectionsTable = true;
          }
        } catch (error) {
          if (!isMounted) return;
          if (isTokenNotFoundError(error)) {
            applyTokenNotFoundGraphState(error, "connections");
            return;
          }
          // Fall back to the base graph if precomputed connections are unavailable.
        }
      }

      if (!focusedGraph) {
        if (!mappedGraph || !mappedGraph.nodes.length) {
          if (isConnectionsView) {
            setMapDataStatus(
              "No transaction history found for this wallet in the current time range.",
            );
          } else {
            setTrackedTokenSupply(0);
            setMapNodes([]);
            setSummaryNodes([]);
            setMapLinks([]);
            setMapDataStatus(
              "No holder data available for this token. It may be newly added.",
            );
          }
          setIsMapLoading(false);
          return;
        }

        focusedGraph = baseFocusedGraph;
      }

      if (!focusedGraph || !focusedGraph.nodes.length) {
        if (isConnectionsView) {
          setMapDataStatus(
            "This wallet address wasn't found in the current token holder list.",
          );
        } else {
          setTrackedTokenSupply(0);
          setMapNodes([]);
          setSummaryNodes([]);
          setMapLinks([]);
          setMapDataStatus(
            "This wallet address wasn't found in the current token holder list.",
          );
        }
        setIsMapLoading(false);
        return;
      }

      const summaryBaseNodes =
        isTopLevelTokenGraph && Array.isArray(mappedGraph?.nodes)
          ? shouldApplyTopHoldersSeed
            ? [
                ...mappedGraph.nodes,
                ...(Array.isArray(baseGraph?.nodes) ? baseGraph.nodes : []),
              ]
            : mappedGraph.nodes
          : focusedGraph.nodes;

      const mergedSummaryNodes =
        shouldFetchTopHolders && Array.isArray(mappedGraph?.nodes)
          ? mergeSummaryNodesWithTopHolders(
              summaryBaseNodes,
              topHoldersForSummary,
              graphDecimals,
            )
          : summaryBaseNodes;

      const resolvedMapLinks =
        isTopLevelTokenGraph &&
        isGraphMaxModeEnabled &&
        Array.isArray(mappedGraph?.links)
          ? mappedGraph.links
          : focusedGraph.links;

      applyResolvedGraphState({
        focusedGraph,
        summaryNodes: mergedSummaryNodes,
        mapLinks: resolvedMapLinks,
        baseGraph,
        usedConnectionsTable,
      });
    }

    fetchMapGraph().catch(() => {
      if (!isMounted) return;
      if (isConnectionsView) {
        setIsUsingMockApiFallback(false);
        setMapDataStatus(
          "Couldn't process the wallet connections. Try selecting a different wallet.",
        );
      } else {
        setIsUsingMockApiFallback(false);
        setTrackedTokenSupply(0);
        setMapNodes([]);
        setSummaryNodes([]);
        setMapLinks([]);
        setMapDataStatus(
          "Couldn't load the token holder map. Please refresh or try another token.",
        );
      }
      setIsMapLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [
    activeGraphRootAddress,
    activeTokenInfo?.currentSupply,
    activeTokenInfo?.totalSupply,
    apiTokenInfo?.decimals,
    graphEdgeLimit,
    graphNodeLimit,
    isGraphEnrichmentEnabled,
    isGraphMaxModeEnabled,
    isConnectionsView,
    searchedRootAddress,
    selectedMockTokenData,
    selectedTokenSymbol,
    mapRefreshNonce,
    setConnectionsGraphContext,
    setHoveredNode,
    setIsGraphEnrichmentEnabled,
    setIsGraphEnrichmentLoading,
    setIsMapLoading,
    setIsMapLoadingReadyState,
    setIsUsingMockApiFallback,
    setLastApiError,
    setMapDataStatus,
    setMapLinks,
    setMapLoadingDisplayedPhase,
    setMapLoadingEvidence,
    setMapLoadingProfile,
    setMapLoadingProgress,
    setMapNodes,
    setOverallMaxGraphStats,
    setSelectedNode,
    setSummaryNodes,
    setTokenSelectorStatus,
    setTrackedTokenSupply,
  ]);
}
