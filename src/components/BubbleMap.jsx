import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraphThemeStyle, getHolderPalette } from "../theme/holderPalettes";
import {
  getLayoutPrewarmTicks,
  PREWARM_ALPHA_MIN,
  PREWARM_START_ALPHA,
} from "../graph/layout";

const PAN_HINT_THRESHOLD = 20;
const BOUNDS_UPDATE_EVERY = 5;
const FIT_DURATION_MS = 220;
const RESIZE_REFIT_IDLE_MS = 1800;
const GRAPH_REVEAL_LINK_DELAY_MS = 90;
const GRAPH_REVEAL_NODE_DELAY_MS = 130;
const GRAPH_REVEAL_ITEM_STAGGER_MS = 14;
const GRAPH_REVEAL_LINK_DURATION_MS = 240;
const GRAPH_REVEAL_NODE_DURATION_MS = 260;
const GRAPH_REVEAL_LABEL_DURATION_MS = 180;
const PATH_LAYOUT_MIN_STEP = 96;
const PATH_LAYOUT_MAX_STEP = 210;
const PATH_LAYOUT_MIN_LANE_SPACING = 22;
const PATH_LAYOUT_MAX_LANE_SPACING = 62;
const PATH_LAYOUT_VERTICAL_PADDING = 30;

function easeCubicOut(progress) {
  return 1 - (1 - progress) ** 3;
}

function getNodeId(endpoint) {
  return typeof endpoint === "object" ? endpoint?.id : endpoint;
}

function BubbleMap({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  currentSupply,
  colorTheme,
  preserveUnconnectedNodes = false,
  physicsMode = "balanced",
  layoutMode = "organic",
  labelDensityMode = "balanced",
  traceNodeIds = [],
  traceLinkKeys = [],
  tracePathHighlights = [],
  onReady,
}) {
  const holderPalette = getHolderPalette(colorTheme);
  const graphThemeStyle = getGraphThemeStyle(colorTheme);
  const {
    selectedFillOpacity,
    fadedFillOpacity,
    selectedStrokeWidth,
    defaultStrokeWidth,
    linkActive,
    linkBase,
    linkWidthActive,
    linkWidthBase,
  } = graphThemeStyle;
  const bubbleLabelColor = colorTheme === "light" ? "#1f3248" : "white";
  const bubblePctColor =
    colorTheme === "light" ? "rgba(31,50,72,0.72)" : "rgba(255,255,255,0.7)";
  const canvasRef = useRef(null);
  const boundsRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const viewportRef = useRef({ width: 0, height: 0, pixelRatio: 1 });
  const zoomRef = useRef(null);
  const redrawRef = useRef(() => {});
  const renderFrameRef = useRef(null);
  const panHintFrameRef = useRef(null);
  const resizeFitFrameRef = useRef(null);
  const pendingBoundsRef = useRef(null);
  const lastManualViewportChangeAtRef = useRef(0);
  const lastTouchedIdRef = useRef(null);
  const activePointerRef = useRef(null);
  const focusedNodeIndexRef = useRef(-1);
  const latestPropsRef = useRef(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [graphRenderCycle, setGraphRenderCycle] = useState(0);
  const [panHints, setPanHints] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  latestPropsRef.current = {
    selectedNodeId,
    hoveredNodeId,
    focusedNodeId,
    preserveUnconnectedNodes,
    traceNodeIds,
    traceLinkKeys,
    tracePathHighlights,
    currentSupply,
    onNodeClick,
    onNodeHover,
  };

  const updatePanHints = useCallback((nextBounds = boundsRef.current) => {
    const transform = transformRef.current;
    const { width, height } = viewportRef.current;

    if (!nextBounds || !width || !height) {
      setPanHints({ left: false, right: false, up: false, down: false });
      return;
    }

    const visibleLeft = (0 - transform.x) / transform.k;
    const visibleRight = (width - transform.x) / transform.k;
    const visibleTop = (0 - transform.y) / transform.k;
    const visibleBottom = (height - transform.y) / transform.k;
    const nextHints = {
      left: nextBounds.minX < visibleLeft - PAN_HINT_THRESHOLD,
      right: nextBounds.maxX > visibleRight + PAN_HINT_THRESHOLD,
      up: nextBounds.minY < visibleTop - PAN_HINT_THRESHOLD,
      down: nextBounds.maxY > visibleBottom + PAN_HINT_THRESHOLD,
    };

    setPanHints((current) =>
      current.left === nextHints.left &&
      current.right === nextHints.right &&
      current.up === nextHints.up &&
      current.down === nextHints.down
        ? current
        : nextHints,
    );
  }, []);

  const schedulePanHintUpdate = useCallback((nextBounds = boundsRef.current) => {
    pendingBoundsRef.current = nextBounds;
    if (panHintFrameRef.current !== null) return;
    panHintFrameRef.current = window.requestAnimationFrame(() => {
      panHintFrameRef.current = null;
      updatePanHints(pendingBoundsRef.current);
    });
  }, [updatePanHints]);

  const scheduleRedraw = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      redrawRef.current();
    });
  }, []);

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    const bounds = boundsRef.current;
    const zoom = zoomRef.current;
    if (!canvas || !bounds || !zoom) return;

    const { width, height } = viewportRef.current;
    if (!width || !height) return;

    const padding = 48;
    const boundsWidth = bounds.maxX - bounds.minX + padding * 2;
    const boundsHeight = bounds.maxY - bounds.minY + padding * 2;
    const scale = Math.min(width / boundsWidth, height / boundsHeight, 1);
    const translateX = (width - scale * (bounds.minX + bounds.maxX)) / 2;
    const translateY = (height - scale * (bounds.minY + bounds.maxY)) / 2;
    const fitTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    d3.select(canvas)
      .transition()
      .duration(FIT_DURATION_MS)
      .call(zoom.transform, fitTransform);
  }, []);

  const fitToViewRef = useRef(fitToView);
  fitToViewRef.current = fitToView;
  useEffect(() => {
    if (!onReady) return undefined;
    onReady({ fitToView: () => fitToViewRef.current() });
    return () => onReady(null);
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!width || !height) continue;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const backingWidth = Math.round(width * pixelRatio);
        const backingHeight = Math.round(height * pixelRatio);
        const didViewportChange =
          viewportRef.current.width !== width ||
          viewportRef.current.height !== height;

        viewportRef.current = { width, height, pixelRatio };
        if (canvas.width !== backingWidth) canvas.width = backingWidth;
        if (canvas.height !== backingHeight) canvas.height = backingHeight;
        scheduleRedraw();
        schedulePanHintUpdate();

        if (!didViewportChange) continue;

        if (resizeFitFrameRef.current !== null) {
          window.cancelAnimationFrame(resizeFitFrameRef.current);
        }

        resizeFitFrameRef.current = window.requestAnimationFrame(() => {
          resizeFitFrameRef.current = null;
          if (
            Date.now() - lastManualViewportChangeAtRef.current <
            RESIZE_REFIT_IDLE_MS
          ) {
            return;
          }
          fitToViewRef.current();
        });
      }
    });

    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (resizeFitFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFitFrameRef.current);
        resizeFitFrameRef.current = null;
      }
    };
  }, [schedulePanHintUpdate, scheduleRedraw]);

  useEffect(
    () => () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
      if (panHintFrameRef.current !== null) {
        window.cancelAnimationFrame(panHintFrameRef.current);
      }
      if (resizeFitFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFitFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resetHover = () => {
      setHoveredNodeId(null);
      setFocusedNodeId(null);
      latestPropsRef.current?.onNodeHover?.(null);
    };

    if (!nodes.length) {
      boundsRef.current = null;
      transformRef.current = d3.zoomIdentity;
      canvas.__graphData = null;
      redrawRef.current = () => {
        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
      };
      resetHover();
      scheduleRedraw();
      setPanHints({ left: false, right: false, up: false, down: false });
      return undefined;
    }

    focusedNodeIndexRef.current = -1;
    setFocusedNodeId(null);
    setGraphRenderCycle((cycle) => cycle + 1);

    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 650;
    viewportRef.current = {
      ...viewportRef.current,
      width,
      height,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    };
    transformRef.current = d3.zoomIdentity;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D rendering context is unavailable.");
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const getRenderValue = (node) =>
      Number.isFinite(Number(node.visualValue))
        ? Number(node.visualValue)
        : Number(node.value) || 0;
    const maxValue = d3.max(nodes, getRenderValue);
    const radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([7, 68]);
    const simNodes = nodes.map((node) => ({ ...node }));
    const nodeIndex = new Map(simNodes.map((node) => [node.id, node]));
    const simLinks = links
      .filter(
        (link) =>
          nodeIndex.has(getNodeId(link.source)) &&
          nodeIndex.has(getNodeId(link.target)),
      )
      .map((link) => ({
        ...link,
        source: getNodeId(link.source),
        target: getNodeId(link.target),
      }));
    const isPathLayout =
      layoutMode === "path" &&
      simNodes.every((node) => Number.isFinite(Number(node.tracePathIndex)));
    let pathStep = 0;

    if (isPathLayout) {
      const maxPathIndex =
        d3.max(simNodes, (node) => Number(node.tracePathIndex) || 0) || 1;
      const horizontalPadding = Math.max(56, width * 0.06);
      pathStep = Math.max(
        PATH_LAYOUT_MIN_STEP,
        Math.min(
          Math.max(
            PATH_LAYOUT_MIN_STEP,
            Math.min(PATH_LAYOUT_MAX_STEP, width * 0.2),
          ),
          Math.max(1, width - horizontalPadding * 2) / maxPathIndex,
        ),
      );
      const routeStartX = (width - pathStep * maxPathIndex) / 2;
      const laneValues = simNodes
        .map((node) => Number(node.tracePathLane))
        .filter(Number.isFinite);
      const minLane = laneValues.length ? Math.min(...laneValues) : 0;
      const maxLane = laneValues.length ? Math.max(...laneValues) : 0;
      const laneMidpoint = minLane + (maxLane - minLane) / 2;
      const laneSpan = Math.max(1, maxLane - minLane + 1);
      const laneSpacing = Math.max(
        PATH_LAYOUT_MIN_LANE_SPACING,
        Math.min(
          PATH_LAYOUT_MAX_LANE_SPACING,
          Math.max(1, height - PATH_LAYOUT_VERTICAL_PADDING * 2) /
            Math.max(1, laneSpan - 1),
        ),
      );

      simNodes.forEach((node) => {
        const laneCandidates = Array.isArray(node.tracePathLanes)
          ? node.tracePathLanes.map(Number).filter(Number.isFinite)
          : [];
        const laneAnchor = laneCandidates.length
          ? laneCandidates.reduce((sum, lane) => sum + lane, 0) /
            laneCandidates.length
          : Number(node.tracePathLane) || 0;
        const pathIndex = Number(node.tracePathIndex) || 0;
        node.desiredX = routeStartX + pathIndex * pathStep;
        node.desiredY =
          pathIndex === 0 || pathIndex === maxPathIndex
            ? height / 2
            : height / 2 + (laneAnchor - laneMidpoint) * laneSpacing;
        node.x = node.desiredX;
        node.y = node.desiredY;
      });
    }

    const revealOrderById = new Map(
      [...simNodes]
        .sort((left, right) => getRenderValue(right) - getRenderValue(left))
        .map((node, index) => [node.id, index]),
    );
    const resolvedAlphaDecay = physicsMode === "detailed" ? 0.032 : 0.04;
    const resolvedPrewarmTicks = getLayoutPrewarmTicks(resolvedAlphaDecay);
    const chargeMultiplier = isPathLayout
      ? 0.25
      : physicsMode === "fast"
        ? 4.3
        : physicsMode === "detailed"
          ? 6.2
          : 5.5;
    const linkStrength = isPathLayout
      ? 0.95
      : physicsMode === "fast"
        ? 0.2
        : physicsMode === "detailed"
          ? 0.32
          : 0.25;
    const collisionIterations = physicsMode === "detailed" ? 2 : 1;
    const simulation = d3
      .forceSimulation(simNodes)
      .alpha(PREWARM_START_ALPHA)
      .alphaDecay(resolvedAlphaDecay)
      .alphaMin(PREWARM_ALPHA_MIN)
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((node) => node.id)
          .distance((link) =>
            isPathLayout
              ? Math.max(54, pathStep * 0.8)
              : radiusScale(getRenderValue(link.source)) +
                radiusScale(getRenderValue(link.target)) +
                18,
          )
          .strength(linkStrength),
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(
            (node) => -radiusScale(getRenderValue(node)) * chargeMultiplier,
          ),
      )
      .force(
        "center",
        isPathLayout ? null : d3.forceCenter(width / 2, height / 2),
      )
      .force(
        "x",
        isPathLayout
          ? d3.forceX((node) => node.desiredX ?? width / 2).strength(0.9)
          : d3.forceX(width / 2).strength(0.035),
      )
      .force(
        "y",
        isPathLayout
          ? d3.forceY((node) => node.desiredY ?? height / 2).strength(0.78)
          : d3.forceY(height / 2).strength(0.035),
      )
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((node) => radiusScale(getRenderValue(node)) + 3)
          .strength(0.5)
          .iterations(collisionIterations),
      );

    simulation.stop();
    for (let tick = 0; tick < resolvedPrewarmTicks; tick += 1) {
      simulation.tick();
    }

    const linkIndex = new Map();
    simLinks.forEach((link) => {
      const sourceId = link.source.id;
      const targetId = link.target.id;
      if (!linkIndex.has(sourceId)) linkIndex.set(sourceId, new Set());
      if (!linkIndex.has(targetId)) linkIndex.set(targetId, new Set());
      linkIndex.get(sourceId).add(targetId);
      linkIndex.get(targetId).add(sourceId);
    });
    canvas.__simulation = simulation;
    canvas.__graphData = {
      nodes: simNodes,
      linkIndex,
      radiusScale: (node) => radiusScale(getRenderValue(node)),
    };

    const labelThreshold =
      labelDensityMode === "minimal"
        ? 30
        : labelDensityMode === "detailed"
          ? 18
          : 22;
    const percentageThreshold =
      labelDensityMode === "minimal"
        ? 42
        : labelDensityMode === "detailed"
          ? 30
          : 36;
    const graphStartedAt = performance.now();
    const defaultGlowOpacity = graphThemeStyle.baseGlowOpacity ?? 0.08;

    const getRevealProgress = (startAt, duration, now) =>
      prefersReducedMotion
        ? 1
        : easeCubicOut(Math.max(0, Math.min(1, (now - startAt) / duration)));

    const drawGraph = () => {
      const { width: viewportWidth, height: viewportHeight, pixelRatio } =
        viewportRef.current;
      if (!viewportWidth || !viewportHeight) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(
        0,
        0,
        canvas.width || viewportWidth * pixelRatio,
        canvas.height || viewportHeight * pixelRatio,
      );

      const transform = transformRef.current;
      context.setTransform(
        pixelRatio * transform.k,
        0,
        0,
        pixelRatio * transform.k,
        pixelRatio * transform.x,
        pixelRatio * transform.y,
      );

      const props = latestPropsRef.current;
      const activeNodeId = props.selectedNodeId || props.hoveredNodeId || props.focusedNodeId;
      const isHoverMode = !props.selectedNodeId && Boolean(activeNodeId);
      const shouldHideUnrelatedNodes =
        Boolean(props.selectedNodeId) && !props.preserveUnconnectedNodes;
      const connectedNodeIds = new Set(activeNodeId ? [activeNodeId] : []);
      if (activeNodeId) {
        (linkIndex.get(activeNodeId) || []).forEach((nodeId) =>
          connectedNodeIds.add(nodeId),
        );
      }

      const traceNodeSet = new Set(
        (Array.isArray(props.traceNodeIds) ? props.traceNodeIds : []).map(
          (id) => String(id || "").trim(),
        ),
      );
      const traceLinkSet = new Set(
        (Array.isArray(props.traceLinkKeys) ? props.traceLinkKeys : []).map(
          (key) => String(key || "").trim(),
        ),
      );
      const traceNodeColorMap = new Map();
      const traceLinkColorMap = new Map();
      (Array.isArray(props.tracePathHighlights)
        ? props.tracePathHighlights
        : []
      ).forEach((item) => {
        const color = String(item?.color || "").trim();
        if (!color) return;
        (Array.isArray(item?.nodeIds) ? item.nodeIds : []).forEach((id) => {
          const normalizedId = String(id || "").trim();
          if (normalizedId && !traceNodeColorMap.has(normalizedId)) {
            traceNodeColorMap.set(normalizedId, color);
          }
        });
        (Array.isArray(item?.linkKeys) ? item.linkKeys : []).forEach((key) => {
          const normalizedKey = String(key || "").trim();
          if (normalizedKey && !traceLinkColorMap.has(normalizedKey)) {
            traceLinkColorMap.set(normalizedKey, color);
          }
        });
      });
      const hasTrace =
        traceNodeSet.size > 0 ||
        traceLinkSet.size > 0 ||
        traceNodeColorMap.size > 0 ||
        traceLinkColorMap.size > 0;

      simLinks.forEach((link, index) => {
        const sourceId = link.source.id;
        const targetId = link.target.id;
        const connected = sourceId === activeNodeId || targetId === activeNodeId;
        if (shouldHideUnrelatedNodes && !connected) {
          return;
        }

        const linkKey = `${sourceId}->${targetId}`;
        const traceColor = traceLinkColorMap.get(linkKey);
        const isTraced = traceLinkSet.has(linkKey) || Boolean(traceColor);
        const revealStart =
          graphStartedAt +
          GRAPH_REVEAL_LINK_DELAY_MS +
          Math.min(index, 60) * Math.max(5, GRAPH_REVEAL_ITEM_STAGGER_MS - 6);
        const reveal = getRevealProgress(
          revealStart,
          GRAPH_REVEAL_LINK_DURATION_MS,
          performance.now(),
        );
        if (reveal <= 0) return;

        context.beginPath();
        context.moveTo(link.source.x, link.source.y);
        context.lineTo(link.target.x, link.target.y);
        context.strokeStyle = traceColor
          ? traceColor
          : isTraced
            ? linkActive
            : connected
              ? linkActive
              : linkBase;
        context.lineWidth = isTraced
          ? Math.max(linkWidthActive ?? 2, 2.4)
          : connected
            ? (linkWidthActive ?? 2)
            : (linkWidthBase ?? 1);
        context.globalAlpha = reveal * (hasTrace && !isTraced ? 0.08 : 1);
        if (isHoverMode && !connected) {
          context.globalAlpha *= 0.2;
        }
        context.stroke();
      });

      simNodes.forEach((node) => {
        const nodeId = String(node.id || "").trim();
        const isConnected = connectedNodeIds.has(nodeId);
        if (shouldHideUnrelatedNodes && !isConnected) return;

        const radius = radiusScale(getRenderValue(node));
        const traceColor = traceNodeColorMap.get(nodeId);
        const isTraced = traceNodeSet.has(nodeId) || Boolean(traceColor);
        const revealOrder = revealOrderById.get(node.id) ?? 0;
        const nodeRevealStart =
          graphStartedAt +
          GRAPH_REVEAL_NODE_DELAY_MS +
          Math.min(revealOrder, 50) * GRAPH_REVEAL_ITEM_STAGGER_MS;
        const nodeReveal = getRevealProgress(
          nodeRevealStart,
          GRAPH_REVEAL_NODE_DURATION_MS,
          performance.now(),
        );
        if (nodeReveal <= 0) return;

        const labelReveal = getRevealProgress(
          nodeRevealStart + 36,
          GRAPH_REVEAL_LABEL_DURATION_MS,
          performance.now(),
        );
        let nodeOpacity = 1;
        if (hasTrace && !isTraced) nodeOpacity = 0.24;
        if (isHoverMode && !isConnected) nodeOpacity = Math.min(nodeOpacity, 0.42);
        if (props.selectedNodeId && props.preserveUnconnectedNodes && !isConnected) {
          nodeOpacity = 0.42;
        }
        context.globalAlpha = nodeOpacity * nodeReveal;

        const fillColor = holderPalette[node.type] || "#74b9ff";
        context.beginPath();
        context.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        context.fillStyle = fillColor;
        context.globalAlpha *= defaultGlowOpacity;
        context.fill();
        context.globalAlpha = nodeOpacity * nodeReveal;

        if (node.isSearchRoot) {
          context.beginPath();
          context.arc(node.x, node.y, radius + 14, 0, Math.PI * 2);
          context.strokeStyle = "#ffe08a";
          context.lineWidth = 2.8;
          context.globalAlpha *= 0.95;
          context.stroke();
          context.globalAlpha = nodeOpacity * nodeReveal;
        }

        const active = nodeId === activeNodeId;
        const fillOpacity = activeNodeId
          ? active
            ? selectedFillOpacity
            : fadedFillOpacity
          : 0.72;
        const displayRadius = prefersReducedMotion
          ? radius
          : radius * 0.76 + (radius - radius * 0.76) * nodeReveal;
        context.beginPath();
        context.arc(node.x, node.y, displayRadius, 0, Math.PI * 2);
        context.fillStyle = fillColor;
        context.globalAlpha = nodeOpacity * nodeReveal * fillOpacity;
        context.fill();

        const strokeColor = traceColor
          ? traceColor
          : active && (props.hoveredNodeId || props.focusedNodeId)
            ? (graphThemeStyle.hoverStroke ?? "rgba(255,255,255,0.55)")
            : node.isSearchRoot
              ? "#fff3bf"
              : fillColor;
        const strokeWidth = active
          ? selectedStrokeWidth
          : isTraced
            ? Math.max(node.isSearchRoot ? 3.2 : 1.5, 2.8)
            : node.isSearchRoot
              ? 3.2
              : defaultStrokeWidth;
        context.beginPath();
        context.arc(node.x, node.y, displayRadius, 0, Math.PI * 2);
        context.strokeStyle = strokeColor;
        context.lineWidth = strokeWidth;
        context.globalAlpha =
          nodeOpacity *
          nodeReveal *
          (prefersReducedMotion ? (node.isSearchRoot ? 1 : 0.85) : 0.85);
        context.stroke();

        const showLabel = radius > labelThreshold;
        const showPercentage = radius > percentageThreshold;
        if (showLabel && labelReveal > 0) {
          context.globalAlpha = nodeOpacity * labelReveal;
          context.fillStyle = bubbleLabelColor;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `600 ${Math.min(radius / 4.2, 13)}px Inter, system-ui, sans-serif`;
          const label =
            node.label.length > 13 ? `${node.label.slice(0, 11)}…` : node.label;
          context.fillText(
            label,
            node.x,
            node.y + (showPercentage ? -4 : 0),
          );
        }
        if (showPercentage && labelReveal > 0) {
          const parsedValue = Number(node?.value);
          const share =
            Number.isFinite(props.currentSupply) && props.currentSupply > 0
              ? `${(((Number.isFinite(parsedValue) ? parsedValue : 0) / props.currentSupply) * 100).toFixed(2)}%`
              : `${(Number.isFinite(Number(node?.pct)) ? Number(node.pct) : 0).toFixed(2)}%`;
          context.globalAlpha = nodeOpacity * labelReveal;
          context.fillStyle = bubblePctColor;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `400 ${Math.min(radius / 5.5, 11)}px Inter, system-ui, sans-serif`;
          context.fillText(share, node.x, node.y + (showLabel ? 10 : 0));
        }
      });
      context.globalAlpha = 1;

      if (
        !prefersReducedMotion &&
        performance.now() - graphStartedAt <
          GRAPH_REVEAL_NODE_DELAY_MS +
            50 * GRAPH_REVEAL_ITEM_STAGGER_MS +
            GRAPH_REVEAL_NODE_DURATION_MS
      ) {
        scheduleRedraw();
      }
    };
    redrawRef.current = drawGraph;

    const computeBounds = () => ({
      minX: d3.min(
        simNodes,
        (node) => (node.x ?? width / 2) - (radiusScale(getRenderValue(node)) + 10),
      ),
      maxX: d3.max(
        simNodes,
        (node) => (node.x ?? width / 2) + (radiusScale(getRenderValue(node)) + 10),
      ),
      minY: d3.min(
        simNodes,
        (node) => (node.y ?? height / 2) - (radiusScale(getRenderValue(node)) + 10),
      ),
      maxY: d3.max(
        simNodes,
        (node) => (node.y ?? height / 2) + (radiusScale(getRenderValue(node)) + 10),
      ),
    });
    boundsRef.current = computeBounds();
    schedulePanHintUpdate(boundsRef.current);
    drawGraph();

    let tickCount = 0;
    simulation.on("tick", () => {
      scheduleRedraw();
      tickCount += 1;
      if (tickCount % BOUNDS_UPDATE_EVERY === 0) {
        boundsRef.current = computeBounds();
        schedulePanHintUpdate(boundsRef.current);
      }
    });

    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 8])
      .on("zoom", (event) => {
        if (event.sourceEvent) {
          lastManualViewportChangeAtRef.current = Date.now();
        }
        transformRef.current = event.transform;
        scheduleRedraw();
        schedulePanHintUpdate();
      });
    zoomRef.current = zoom;
    d3.select(canvas).call(zoom).on("dblclick.zoom", null);

    simulation.alpha(0.14).restart();
    resetHover();

    return () => {
      simulation.stop();
      canvas.__simulation = null;
      redrawRef.current = () => {};
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      if (panHintFrameRef.current !== null) {
        window.cancelAnimationFrame(panHintFrameRef.current);
        panHintFrameRef.current = null;
      }
      d3.select(canvas).on(".zoom", null).interrupt();
    };
  }, [
    colorTheme,
    defaultStrokeWidth,
    fadedFillOpacity,
    graphThemeStyle,
    holderPalette,
    labelDensityMode,
    layoutMode,
    links,
    linkActive,
    linkBase,
    linkWidthActive,
    linkWidthBase,
    physicsMode,
    nodes,
    bubbleLabelColor,
    bubblePctColor,
    schedulePanHintUpdate,
    scheduleRedraw,
    selectedFillOpacity,
    selectedStrokeWidth,
  ]);

  useEffect(() => {
    scheduleRedraw();
  }, [
    selectedNodeId,
    hoveredNodeId,
    focusedNodeId,
    preserveUnconnectedNodes,
    traceNodeIds,
    traceLinkKeys,
    tracePathHighlights,
    colorTheme,
    currentSupply,
    scheduleRedraw,
  ]);

  function getPointerPosition(event) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pointer =
      event.touches?.[0] || event.changedTouches?.[0] || event;
    return [pointer.clientX - rect.left, pointer.clientY - rect.top];
  }

  function getNodeAtPointer(event) {
    const point = getPointerPosition(event);
    const transform = transformRef.current;
    if (!point) return null;
    const [x, y] = transform.invert(point);
    const canvas = canvasRef.current;
    const graphData = canvas?.__graphData;
    if (!graphData) return null;
    const selectedId = latestPropsRef.current?.selectedNodeId;
    const hideUnconnected =
      selectedId && !latestPropsRef.current?.preserveUnconnectedNodes;
    const selectableIds = hideUnconnected
      ? new Set([selectedId, ...(graphData.linkIndex.get(selectedId) || [])])
      : null;

    for (let index = graphData.nodes.length - 1; index >= 0; index -= 1) {
      const node = graphData.nodes[index];
      if (selectableIds && !selectableIds.has(node.id)) continue;
      if (Math.hypot(x - node.x, y - node.y) <= graphData.radiusScale(node)) {
        return node;
      }
    }
    return null;
  }

  function updateHover(node) {
    const nextId = node?.id ?? null;
    setHoveredNodeId((currentId) => (currentId === nextId ? currentId : nextId));
    latestPropsRef.current?.onNodeHover?.(node || null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? "pointer" : "grab";
    }
    scheduleRedraw();
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const node = getNodeAtPointer(event);
    if (!node) return;

    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    const point = getPointerPosition(event);
    if (!canvas || !point) return;
    const [x, y] = transformRef.current.invert(point);
    activePointerRef.current = {
      pointerId: event.pointerId,
      node,
      startX: x,
      startY: y,
      initialX: node.x,
      initialY: node.y,
      initialFx: node.fx,
      initialFy: node.fy,
      moved: false,
      pointerType: event.pointerType,
    };
    canvas.setPointerCapture?.(event.pointerId);
    if (event.pointerType !== "touch") updateHover(node);
  }

  function handlePointerMove(event) {
    const activePointer = activePointerRef.current;
    if (activePointer?.pointerId === event.pointerId) {
      const point = getPointerPosition(event);
      if (!point) return;
      const [x, y] = transformRef.current.invert(point);
      const distance = Math.hypot(
        x - activePointer.startX,
        y - activePointer.startY,
      );
      if (distance > 2) activePointer.moved = true;
      if (activePointer.moved) {
        event.preventDefault();
        activePointer.node.fx = x;
        activePointer.node.fy = y;
        activePointer.node.x = x;
        activePointer.node.y = y;
        activePointer.node.vx = 0;
        activePointer.node.vy = 0;
        const simulation = canvasRef.current?.__simulation;
        if (simulation) simulation.alphaTarget(0.18).restart();
        scheduleRedraw();
      }
      return;
    }
    if (event.pointerType === "touch") return;
    updateHover(getNodeAtPointer(event));
  }

  function handlePointerUp(event) {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) return;
    activePointerRef.current = null;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);

    const simulation = canvasRef.current?.__simulation;
    if (simulation) simulation.alphaTarget(0);

    if (!activePointer.moved) {
      const node = activePointer.node;
      const isTouch =
        activePointer.pointerType === "touch" ||
        (typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          !window.matchMedia("(pointer: fine)").matches);
      if (isTouch) {
        if (lastTouchedIdRef.current === node.id) {
          lastTouchedIdRef.current = null;
          setHoveredNodeId(null);
          latestPropsRef.current?.onNodeHover?.(null);
          latestPropsRef.current?.onNodeClick?.(node);
        } else {
          lastTouchedIdRef.current = node.id;
          updateHover(node);
        }
      } else {
        latestPropsRef.current?.onNodeClick?.(node);
      }
    } else if (layoutMode !== "path") {
      activePointer.node.fx = null;
      activePointer.node.fy = null;
    } else {
      activePointer.node.fx = activePointer.node.x;
      activePointer.node.fy = activePointer.node.y;
    }
    scheduleRedraw();
  }

  function handlePointerCancel(event) {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) return;
    activePointerRef.current = null;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    const simulation = canvasRef.current?.__simulation;
    if (simulation) simulation.alphaTarget(0);
    if (activePointer.moved) {
      activePointer.node.x = activePointer.initialX;
      activePointer.node.y = activePointer.initialY;
      activePointer.node.fx = activePointer.initialFx ?? null;
      activePointer.node.fy = activePointer.initialFy ?? null;
    }
    scheduleRedraw();
  }

  function handleMouseDownCapture(event) {
    if (!getNodeAtPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleTouchStartCapture(event) {
    if (!getNodeAtPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleCanvasClick(event) {
    if (getNodeAtPointer(event)) return;
    lastTouchedIdRef.current = null;
    latestPropsRef.current?.onNodeClick?.(null);
    setHoveredNodeId(null);
    latestPropsRef.current?.onNodeHover?.(null);
  }

  function handleKeyDown(event) {
    const canvas = canvasRef.current;
    const graphData = canvas?.__graphData;
    if (!graphData?.nodes.length) return;

    if (event.key === "Escape") {
      focusedNodeIndexRef.current = -1;
      setFocusedNodeId(null);
      setHoveredNodeId(null);
      latestPropsRef.current?.onNodeHover?.(null);
      latestPropsRef.current?.onNodeClick?.(null);
      scheduleRedraw();
      return;
    }
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowUp" &&
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();
    if (event.key === "Enter" || event.key === " ") {
      const focusedNode = graphData.nodes[focusedNodeIndexRef.current];
      if (focusedNode) latestPropsRef.current?.onNodeClick?.(focusedNode);
      return;
    }

    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    focusedNodeIndexRef.current =
      focusedNodeIndexRef.current < 0
        ? direction > 0
          ? 0
          : graphData.nodes.length - 1
        : (focusedNodeIndexRef.current + direction + graphData.nodes.length) %
          graphData.nodes.length;
    const node = graphData.nodes[focusedNodeIndexRef.current];
    setFocusedNodeId(node.id);
    setHoveredNodeId(null);
    latestPropsRef.current?.onNodeHover?.(node);
    scheduleRedraw();
  }

  return (
    <div className="bubble-map-shell">
      <canvas
        ref={canvasRef}
        className="bubble-map-canvas"
        role="application"
        aria-label="Interactive wallet graph. Use arrow keys to move between wallets, Enter to select, and Escape to clear selection."
        tabIndex={0}
        onMouseDownCapture={handleMouseDownCapture}
        onTouchStartCapture={handleTouchStartCapture}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={(event) => {
          if (!activePointerRef.current && event.pointerType !== "touch") {
            updateHover(null);
          }
        }}
        onClick={handleCanvasClick}
        onKeyDown={handleKeyDown}
      />
      <div
        key={graphRenderCycle}
        className="graph-render-overlay"
        aria-hidden="true"
      />
      <div
        className={`map-pan-indicator map-pan-indicator-left ${panHints.left ? "is-visible" : ""}`}
      >
        <span>◀</span>
      </div>
      <div
        className={`map-pan-indicator map-pan-indicator-right ${panHints.right ? "is-visible" : ""}`}
      >
        <span>▶</span>
      </div>
      <div
        className={`map-pan-indicator map-pan-indicator-up ${panHints.up ? "is-visible" : ""}`}
      >
        <span>▲</span>
      </div>
      <div
        className={`map-pan-indicator map-pan-indicator-down ${panHints.down ? "is-visible" : ""}`}
      >
        <span>▼</span>
      </div>
    </div>
  );
}

export default React.memo(BubbleMap);
