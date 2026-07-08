import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraphThemeStyle, getHolderPalette } from "../theme/holderPalettes";

const PAN_HINT_THRESHOLD = 20;
const PREWARM_TICKS = 220;
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

  function formatSharePct(node) {
    const parsedValue = Number(node?.value);
    if (Number.isFinite(currentSupply) && currentSupply > 0) {
      return `${(((Number.isFinite(parsedValue) ? parsedValue : 0) / currentSupply) * 100).toFixed(2)}%`;
    }

    const fallbackPct = Number(node?.pct);
    return `${(Number.isFinite(fallbackPct) ? fallbackPct : 0).toFixed(2)}%`;
  }

  const svgRef = useRef(null);
  const boundsRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const viewportRef = useRef({ width: 0, height: 0 });
  const zoomRef = useRef(null);
  const prevGraphSignatureRef = useRef("");
  const panHintFrameRef = useRef(null);
  const resizeFitFrameRef = useRef(null);
  const pendingBoundsRef = useRef(null);
  const lastTouchedIdRef = useRef(null);
  const lastManualViewportChangeAtRef = useRef(0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [graphRenderCycle, setGraphRenderCycle] = useState(0);
  const [panHints, setPanHints] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  function updatePanHints(nextBounds = boundsRef.current) {
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

    setPanHints((current) => {
      if (
        current.left === nextHints.left &&
        current.right === nextHints.right &&
        current.up === nextHints.up &&
        current.down === nextHints.down
      ) {
        return current;
      }
      return nextHints;
    });
  }

  function schedulePanHintUpdate(nextBounds = boundsRef.current) {
    pendingBoundsRef.current = nextBounds;
    if (panHintFrameRef.current !== null) return;
    panHintFrameRef.current = window.requestAnimationFrame(() => {
      panHintFrameRef.current = null;
      updatePanHints(pendingBoundsRef.current);
    });
  }

  function buildGraphSignature(nextNodes, nextLinks, theme) {
    const nodeSig = nextNodes
      .map(
        (n) =>
          `${n.id}:${n.value}:${n.visualValue ?? ""}:${n.type}:${n.tracePathIndex ?? ""}`,
      )
      .join("|");
    const linkSig = nextLinks
      .map((l) => {
        const src = typeof l.source === "object" ? l.source?.id : l.source;
        const tgt = typeof l.target === "object" ? l.target?.id : l.target;
        return `${src}>${tgt}`;
      })
      .join("|");
    return `${nodeSig}__${linkSig}__${theme}__${physicsMode}__${layoutMode}__${labelDensityMode}`;
  }

  // ── Fit all nodes into the current viewport ─────────────────────────────
  function fitToView() {
    if (!svgRef.current || !boundsRef.current || !zoomRef.current) return;
    const el = svgRef.current;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;

    const b = boundsRef.current;
    const pad = 48;
    const bw = b.maxX - b.minX + pad * 2;
    const bh = b.maxY - b.minY + pad * 2;
    const k = Math.min(w / bw, h / bh, 1);
    const tx = (w - k * (b.minX + b.maxX)) / 2;
    const ty = (h - k * (b.minY + b.maxY)) / 2;
    const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(k);

    d3.select(el)
      .transition()
      .duration(FIT_DURATION_MS)
      .call(zoomRef.current.transform, fitTransform);
  }

  // Expose fitToView to parent without forwardRef
  const fitToViewRef = useRef(fitToView);
  fitToViewRef.current = fitToView;
  useEffect(() => {
    if (!onReady) return undefined;
    onReady({ fitToView: () => fitToViewRef.current() });
    return () => onReady(null);
  }, [onReady]);

  // ── ResizeObserver: keep viewport ref in sync ─────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!width || !height) continue;
        const prevViewport = viewportRef.current;
        const didViewportChange =
          prevViewport.width !== width || prevViewport.height !== height;
        viewportRef.current = { width, height };
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

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeFitFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFitFrameRef.current);
        resizeFitFrameRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (panHintFrameRef.current !== null) {
        window.cancelAnimationFrame(panHintFrameRef.current);
      }
      if (resizeFitFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFitFrameRef.current);
      }
    };
  }, []);

  // ── Main effect: rebuild simulation when nodes/links change ──────────────
  useEffect(() => {
    if (!svgRef.current) return;

    if (!nodes.length) {
      prevGraphSignatureRef.current = "";
      boundsRef.current = null;
      transformRef.current = d3.zoomIdentity;
      d3.select(svgRef.current).selectAll("*").remove();
      setHoveredNodeId(null);
      if (onNodeHover) onNodeHover(null);
      setPanHints({ left: false, right: false, up: false, down: false });
      return;
    }

    const graphSignature = buildGraphSignature(nodes, links, colorTheme);
    if (prevGraphSignatureRef.current === graphSignature) {
      return;
    }
    prevGraphSignatureRef.current = graphSignature;
    setGraphRenderCycle((current) => current + 1);

    const el = svgRef.current;
    const width = el.clientWidth || 900;
    const height = el.clientHeight || 650;
    viewportRef.current = { width, height };
    transformRef.current = d3.zoomIdentity;

    const svg = d3.select(el);
    svg.selectAll("*").remove();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const container = svg.append("g").style("will-change", "transform");

    // ── Scales ────────────────────────────────────────────────────────────
    const getRenderValue = (node) =>
      Number.isFinite(Number(node.visualValue))
        ? Number(node.visualValue)
        : Number(node.value) || 0;
    const maxVal = d3.max(nodes, (d) => getRenderValue(d));
    const rScale = d3.scaleSqrt().domain([0, maxVal]).range([7, 68]);

    // ── Deep-copy data so D3 can mutate freely ────────────────────────────
    const simNodes = nodes.map((d) => ({ ...d }));
    const nodeIndex = new Map(simNodes.map((d) => [d.id, d]));
    const simLinks = links
      .filter((l) => nodeIndex.has(l.source) && nodeIndex.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));
    const isPathLayout =
      layoutMode === "path" &&
      simNodes.every((node) => Number.isFinite(Number(node.tracePathIndex)));

    let pathStep = 0;
    if (isPathLayout) {
      const maxTracePathIndex = d3.max(simNodes, (node) =>
        Number.isFinite(Number(node.tracePathIndex))
          ? Number(node.tracePathIndex)
          : 0,
      );
      const hopCount = Math.max(1, Number(maxTracePathIndex) || 1);
      const horizontalPadding = Math.max(56, width * 0.06);
      const usableWidth = Math.max(1, width - horizontalPadding * 2);
      const computedPathStep = usableWidth / hopCount;
      const maxPathStep = Math.max(
        PATH_LAYOUT_MIN_STEP,
        Math.min(PATH_LAYOUT_MAX_STEP, width * 0.2),
      );
      pathStep =
        simNodes.length > 1
          ? Math.max(
              PATH_LAYOUT_MIN_STEP,
              Math.min(computedPathStep, maxPathStep),
            )
          : 0;
      const routeWidth = pathStep * hopCount;
      const routeStartX = (width - routeWidth) / 2;

      const laneValues = simNodes
        .map((node) => Number(node.tracePathLane))
        .filter((lane) => Number.isFinite(lane));
      const minLane = laneValues.length ? Math.min(...laneValues) : 0;
      const maxLane = laneValues.length ? Math.max(...laneValues) : 0;
      const laneSpan = Math.max(1, maxLane - minLane + 1);
      const laneMidpoint = minLane + (maxLane - minLane) / 2;
      const laneUsableHeight = Math.max(
        1,
        height - PATH_LAYOUT_VERTICAL_PADDING * 2,
      );
      const laneSpacing = Math.max(
        PATH_LAYOUT_MIN_LANE_SPACING,
        Math.min(
          PATH_LAYOUT_MAX_LANE_SPACING,
          laneUsableHeight / Math.max(1, laneSpan - 1),
        ),
      );
      const lastPathIndex = Math.max(0, hopCount);

      simNodes.forEach((node) => {
        const pathIndex = Number(node.tracePathIndex) || 0;
        const laneCandidates = Array.isArray(node.tracePathLanes)
          ? node.tracePathLanes
              .map((lane) => Number(lane))
              .filter((lane) => Number.isFinite(lane))
          : [];
        const laneAnchor = laneCandidates.length
          ? laneCandidates.reduce((sum, lane) => sum + lane, 0) /
            laneCandidates.length
          : Number.isFinite(Number(node.tracePathLane))
            ? Number(node.tracePathLane)
            : 0;
        const desiredX = routeStartX + pathIndex * pathStep;
        const desiredY =
          pathIndex === 0 || pathIndex === lastPathIndex
            ? height / 2
            : height / 2 + (laneAnchor - laneMidpoint) * laneSpacing;
        node.desiredX = desiredX;
        node.desiredY = desiredY;
        node.x = desiredX;
        node.y = desiredY;
      });
    }
    const revealOrderById = new Map(
      [...simNodes]
        .sort((a, b) => getRenderValue(b) - getRenderValue(a))
        .map((node, index) => [node.id, index]),
    );

    // ── Force simulation ──────────────────────────────────────────────────
    const resolvedPrewarmTicks = isPathLayout
      ? 140
      : physicsMode === "fast"
        ? 120
        : physicsMode === "detailed"
          ? 320
          : PREWARM_TICKS;
    const resolvedChargeMultiplier = isPathLayout
      ? 0.25
      : physicsMode === "fast"
        ? 4.3
        : physicsMode === "detailed"
          ? 6.2
          : 5.5;
    const resolvedLinkStrength = isPathLayout
      ? 0.95
      : physicsMode === "fast"
        ? 0.2
        : physicsMode === "detailed"
          ? 0.32
          : 0.25;
    const resolvedCollisionIterations =
      physicsMode === "fast" ? 1 : physicsMode === "detailed" ? 2 : 1;

    const simulation = d3
      .forceSimulation(simNodes)
      .alphaDecay(physicsMode === "detailed" ? 0.032 : 0.04)
      .alphaMin(0.02)
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            if (isPathLayout) {
              return Math.max(54, pathStep * 0.8);
            }

            return (
              rScale(getRenderValue(l.source)) +
              rScale(getRenderValue(l.target)) +
              18
            );
          })
          .strength(resolvedLinkStrength),
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(
            (d) => -rScale(getRenderValue(d)) * resolvedChargeMultiplier,
          ),
      )
      .force(
        "center",
        isPathLayout ? null : d3.forceCenter(width / 2, height / 2),
      )
      .force(
        "x",
        isPathLayout
          ? d3.forceX((d) => d.desiredX ?? width / 2).strength(0.9)
          : d3.forceX(width / 2).strength(0.035),
      )
      .force(
        "y",
        isPathLayout
          ? d3.forceY((d) => d.desiredY ?? height / 2).strength(0.78)
          : d3.forceY(height / 2).strength(0.035),
      )
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => rScale(getRenderValue(d)) + 3)
          .strength(0.5)
          .iterations(resolvedCollisionIterations),
      );

    simulation.stop();
    for (let i = 0; i < resolvedPrewarmTicks; i += 1) {
      simulation.tick();
    }

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = container
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("class", "bubble-link")
      .attr("stroke", graphThemeStyle.linkBase)
      .attr("stroke-width", graphThemeStyle.linkWidthBase ?? 1)
      .attr("stroke-opacity", prefersReducedMotion ? 1 : 0);

    // ── Node groups ───────────────────────────────────────────────────────
    const nodeSel = container
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("class", "bubble-node")
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        const nodeData = d3.select(this).datum();
        setHoveredNodeId(nodeData?.id ?? null);
        if (onNodeHover && nodeData) onNodeHover(nodeData);
        d3.select(this)
          .select(".bubble-glow")
          .interrupt()
          .transition()
          .duration(140)
          .attr("fill-opacity", graphThemeStyle.hoverGlowOpacity ?? 0.2)
          .attr(
            "stroke",
            graphThemeStyle.hoverStroke ?? "rgba(255,255,255,0.55)",
          )
          .attr("stroke-width", graphThemeStyle.hoverStrokeWidth ?? 1.5)
          .attr("stroke-opacity", graphThemeStyle.hoverStrokeOpacity ?? 0.65);
      })
      .on("mouseleave", function () {
        setHoveredNodeId(null);
        if (onNodeHover) onNodeHover(null);
        d3.select(this)
          .select(".bubble-glow")
          .interrupt()
          .transition()
          .duration(160)
          .attr("fill-opacity", graphThemeStyle.baseGlowOpacity ?? 0.08)
          .attr("stroke", null)
          .attr("stroke-width", 0)
          .attr("stroke-opacity", 0);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        // On touch devices: first tap previews (hover), second tap selects
        const isTouch =
          event.sourceEvent?.pointerType === "touch" ||
          (typeof window !== "undefined" &&
            !window.matchMedia("(pointer: fine)").matches);
        if (isTouch) {
          if (lastTouchedIdRef.current === d.id) {
            // Second tap on same node → select
            lastTouchedIdRef.current = null;
            if (onNodeHover) onNodeHover(null);
            setHoveredNodeId(null);
            onNodeClick && onNodeClick(d);
          } else {
            // First tap → preview (hover)
            lastTouchedIdRef.current = d.id;
            setHoveredNodeId(d.id);
            if (onNodeHover) onNodeHover(d);
          }
        } else {
          onNodeClick && onNodeClick(d);
        }
      });
    if (isPathLayout) {
      const handlePathNodePointerDown = (event, d) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const svgNode = svg.node();
        if (!svgNode) return;

        let active = true;

        const applyDragPosition = (moveEvent) => {
          if (!active) return;
          const [x, y] = d3.pointer(moveEvent, svgNode);
          d.fx = x;
          d.fy = y;
          d.x = x;
          d.y = y;
          nodeSel.attr(
            "transform",
            (node) => `translate(${node.x ?? 0},${node.y ?? 0})`,
          );
          linkSel
            .attr("x1", (link) => link.source.x)
            .attr("y1", (link) => link.source.y)
            .attr("x2", (link) => link.target.x)
            .attr("y2", (link) => link.target.y);
          simulation.alphaTarget(0.18).restart();
        };

        const handlePointerUp = () => {
          if (!active) return;
          active = false;
          window.removeEventListener("pointermove", applyDragPosition);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerUp);
          d.fx = d.x;
          d.fy = d.y;
          if (!simulation.alphaTarget()) {
            simulation.alphaTarget(0);
          }
        };

        window.addEventListener("pointermove", applyDragPosition);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
        applyDragPosition(event);
      };

      nodeSel
        .on("mousedown.drag", null)
        .on("pointerdown", handlePathNodePointerDown);
    } else {
      nodeSel.on("pointerdown", null).call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.18).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            event.sourceEvent?.preventDefault?.();
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );
    }

    // Outer glow ring
    nodeSel
      .append("circle")
      .attr("class", "bubble-glow")
      .attr("r", (d) => rScale(getRenderValue(d)) + 8)
      .attr("fill", (d) => holderPalette[d.type] || "#74b9ff")
      .attr(
        "fill-opacity",
        prefersReducedMotion ? (graphThemeStyle.baseGlowOpacity ?? 0.08) : 0,
      )
      .attr("stroke-width", 0)
      .attr("stroke-opacity", 0)
      .style("pointer-events", "none");

    // Explicit ring for searched root node, so it remains visually distinct.
    nodeSel
      .filter((d) => d.isSearchRoot)
      .append("circle")
      .attr("class", "bubble-root-ring")
      .attr("r", (d) => rScale(getRenderValue(d)) + 14)
      .attr("fill", "none")
      .attr("stroke", "#ffe08a")
      .attr("stroke-width", 2.8)
      .attr("stroke-opacity", 0.95)
      .style("pointer-events", "none");

    // Main bubble
    nodeSel
      .append("circle")
      .attr("class", "bubble-circle")
      .attr("r", (d) =>
        prefersReducedMotion
          ? rScale(getRenderValue(d))
          : rScale(getRenderValue(d)) * 0.76,
      )
      .attr("fill", (d) => holderPalette[d.type] || "#74b9ff")
      .attr("fill-opacity", prefersReducedMotion ? 0.72 : 0)
      .attr("stroke", (d) =>
        d.isSearchRoot ? "#fff3bf" : holderPalette[d.type] || "#74b9ff",
      )
      .attr("stroke-width", (d) => (d.isSearchRoot ? 3.2 : 1.5))
      .attr("stroke-opacity", (d) =>
        prefersReducedMotion ? (d.isSearchRoot ? 1 : 0.85) : 0,
      );

    // Primary label (for bubbles large enough)
    const labelThreshold =
      labelDensityMode === "minimal"
        ? 30
        : labelDensityMode === "detailed"
          ? 18
          : 22;
    const pctThreshold =
      labelDensityMode === "minimal"
        ? 42
        : labelDensityMode === "detailed"
          ? 30
          : 36;

    nodeSel
      .filter((d) => rScale(getRenderValue(d)) > labelThreshold)
      .append("text")
      .attr("class", "bubble-label")
      .text((d) => (d.label.length > 13 ? d.label.slice(0, 11) + "…" : d.label))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (rScale(getRenderValue(d)) > 36 ? "-0.3em" : "0.35em"))
      .attr("fill", bubbleLabelColor)
      .attr("font-size", (d) => Math.min(rScale(getRenderValue(d)) / 4.2, 13))
      .attr("font-weight", "600")
      .attr("opacity", prefersReducedMotion ? 1 : 0)
      .style("pointer-events", "none");

    // Percentage sub-label (only for large bubbles)
    nodeSel
      .filter((d) => rScale(getRenderValue(d)) > pctThreshold)
      .append("text")
      .attr("class", "bubble-pct")
      .text((d) => formatSharePct(d))
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", bubblePctColor)
      .attr("font-size", (d) => Math.min(rScale(getRenderValue(d)) / 5.5, 11))
      .attr("opacity", prefersReducedMotion ? 1 : 0)
      .style("pointer-events", "none");

    linkSel
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

    if (!prefersReducedMotion) {
      const linkDelay = (_, index) =>
        GRAPH_REVEAL_LINK_DELAY_MS +
        Math.min(index, 60) * Math.max(5, GRAPH_REVEAL_ITEM_STAGGER_MS - 6);
      const nodeDelay = (nodeData) =>
        GRAPH_REVEAL_NODE_DELAY_MS +
        Math.min(revealOrderById.get(nodeData.id) ?? 0, 50) *
          GRAPH_REVEAL_ITEM_STAGGER_MS;

      linkSel
        .interrupt()
        .transition()
        .delay(linkDelay)
        .duration(GRAPH_REVEAL_LINK_DURATION_MS)
        .ease(d3.easeCubicOut)
        .attr("stroke-opacity", 1);

      nodeSel
        .select(".bubble-glow")
        .interrupt()
        .transition()
        .delay(nodeDelay)
        .duration(GRAPH_REVEAL_NODE_DURATION_MS)
        .ease(d3.easeCubicOut)
        .attr("fill-opacity", graphThemeStyle.baseGlowOpacity ?? 0.08);

      nodeSel
        .select(".bubble-circle")
        .interrupt()
        .transition()
        .delay(nodeDelay)
        .duration(GRAPH_REVEAL_NODE_DURATION_MS)
        .ease(d3.easeCubicOut)
        .attr("r", (d) => rScale(getRenderValue(d)))
        .attr("fill-opacity", 0.72)
        .attr("stroke-opacity", (d) => (d.isSearchRoot ? 1 : 0.85));

      nodeSel
        .selectAll(".bubble-label, .bubble-pct")
        .interrupt()
        .transition()
        .delay((nodeData) => nodeDelay(nodeData) + 36)
        .duration(GRAPH_REVEAL_LABEL_DURATION_MS)
        .ease(d3.easeCubicOut)
        .attr("opacity", 1);
    }

    const initialBounds = {
      minX: d3.min(
        simNodes,
        (d) => (d.x ?? width / 2) - (rScale(getRenderValue(d)) + 10),
      ),
      maxX: d3.max(
        simNodes,
        (d) => (d.x ?? width / 2) + (rScale(getRenderValue(d)) + 10),
      ),
      minY: d3.min(
        simNodes,
        (d) => (d.y ?? height / 2) - (rScale(getRenderValue(d)) + 10),
      ),
      maxY: d3.max(
        simNodes,
        (d) => (d.y ?? height / 2) + (rScale(getRenderValue(d)) + 10),
      ),
    };
    boundsRef.current = initialBounds;
    schedulePanHintUpdate(initialBounds);

    // ── Tick ──────────────────────────────────────────────────────────────
    let tickCount = 0;
    simulation.on("tick", () => {
      tickCount += 1;

      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

      if (tickCount % BOUNDS_UPDATE_EVERY === 0) {
        const bounds = {
          minX: d3.min(
            simNodes,
            (d) => (d.x ?? width / 2) - (rScale(getRenderValue(d)) + 10),
          ),
          maxX: d3.max(
            simNodes,
            (d) => (d.x ?? width / 2) + (rScale(getRenderValue(d)) + 10),
          ),
          minY: d3.min(
            simNodes,
            (d) => (d.y ?? height / 2) - (rScale(getRenderValue(d)) + 10),
          ),
          maxY: d3.max(
            simNodes,
            (d) => (d.y ?? height / 2) + (rScale(getRenderValue(d)) + 10),
          ),
        };
        boundsRef.current = bounds;
        schedulePanHintUpdate(bounds);
      }
    });

    // ── Zoom / pan ────────────────────────────────────────────────────────
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 8])
      .on("zoom", (event) => {
        if (event.sourceEvent) {
          lastManualViewportChangeAtRef.current = Date.now();
        }
        transformRef.current = event.transform;
        container.attr("transform", event.transform);
        schedulePanHintUpdate();
      });

    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", () => {
      // Tapping empty canvas clears hover preview and selection
      lastTouchedIdRef.current = null;
      onNodeClick && onNodeClick(null);
    });
    simulation.alpha(0.14).restart();

    return () => {
      setHoveredNodeId(null);
      if (onNodeHover) onNodeHover(null);
      if (panHintFrameRef.current !== null) {
        window.cancelAnimationFrame(panHintFrameRef.current);
        panHintFrameRef.current = null;
      }
      simulation.stop();
    };
  }, [colorTheme, labelDensityMode, layoutMode, links, nodes, physicsMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus effect (selection + hover): update visuals only ───────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const connectedNodeIds = new Set();
    const activeNodeId = selectedNodeId || hoveredNodeId;
    const isSelectionMode = Boolean(selectedNodeId);
    const isHoverMode = !selectedNodeId && Boolean(hoveredNodeId);
    const shouldHideUnrelatedNodes =
      isSelectionMode && !preserveUnconnectedNodes;

    if (activeNodeId) {
      connectedNodeIds.add(activeNodeId);
      svg.selectAll(".bubble-link").each((d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        if (srcId === activeNodeId || tgtId === activeNodeId) {
          connectedNodeIds.add(srcId);
          connectedNodeIds.add(tgtId);
        }
      });
    }

    svg
      .selectAll(".bubble-node")
      .style("display", (d) =>
        !shouldHideUnrelatedNodes || connectedNodeIds.has(d.id) ? null : "none",
      )
      .style("pointer-events", (d) =>
        !shouldHideUnrelatedNodes || connectedNodeIds.has(d.id) ? null : "none",
      )
      .attr("opacity", (d) => {
        if (isSelectionMode && preserveUnconnectedNodes && activeNodeId) {
          return connectedNodeIds.has(d.id) ? 1 : 0.42;
        }
        if (!isHoverMode) return 1;
        return connectedNodeIds.has(d.id) ? 1 : 0.42;
      });

    svg
      .selectAll(".bubble-circle")
      .attr("fill-opacity", (d) =>
        !activeNodeId || d.id === activeNodeId
          ? selectedFillOpacity
          : fadedFillOpacity,
      )
      .attr("stroke-width", (d) =>
        d.id === activeNodeId ? selectedStrokeWidth : defaultStrokeWidth,
      );

    svg
      .selectAll(".bubble-link")
      .style("display", (d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return !shouldHideUnrelatedNodes ||
          srcId === activeNodeId ||
          tgtId === activeNodeId
          ? null
          : "none";
      })
      .attr("stroke", (d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return srcId === activeNodeId || tgtId === activeNodeId
          ? linkActive
          : linkBase;
      })
      .attr("stroke-width", (d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return srcId === activeNodeId || tgtId === activeNodeId
          ? (linkWidthActive ?? 2)
          : (linkWidthBase ?? 1);
      })
      .attr("stroke-opacity", (d) => {
        if (!isHoverMode) return 1;
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return srcId === activeNodeId || tgtId === activeNodeId ? 1 : 0.2;
      });
  }, [
    selectedNodeId,
    hoveredNodeId,
    selectedFillOpacity,
    fadedFillOpacity,
    selectedStrokeWidth,
    defaultStrokeWidth,
    linkActive,
    linkBase,
    linkWidthActive,
    linkWidthBase,
    preserveUnconnectedNodes,
  ]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const highlightItems = Array.isArray(tracePathHighlights)
      ? tracePathHighlights
      : [];
    const traceNodeSet = new Set(
      (Array.isArray(traceNodeIds) ? traceNodeIds : []).map((id) =>
        String(id || "").trim(),
      ),
    );
    const traceLinkSet = new Set(
      (Array.isArray(traceLinkKeys) ? traceLinkKeys : []).map((key) =>
        String(key || "").trim(),
      ),
    );
    const traceNodeColorMap = new Map();
    const traceLinkColorMap = new Map();

    highlightItems.forEach((item) => {
      const color = String(item?.color || "").trim();
      if (!color) {
        return;
      }

      const itemNodeIds = Array.isArray(item?.nodeIds) ? item.nodeIds : [];
      itemNodeIds.forEach((nodeId) => {
        const normalizedNodeId = String(nodeId || "").trim();
        if (!normalizedNodeId || traceNodeColorMap.has(normalizedNodeId)) {
          return;
        }
        traceNodeColorMap.set(normalizedNodeId, color);
      });

      const itemLinkKeys = Array.isArray(item?.linkKeys) ? item.linkKeys : [];
      itemLinkKeys.forEach((linkKey) => {
        const normalizedLinkKey = String(linkKey || "").trim();
        if (!normalizedLinkKey || traceLinkColorMap.has(normalizedLinkKey)) {
          return;
        }
        traceLinkColorMap.set(normalizedLinkKey, color);
      });
    });

    const hasTrace =
      traceNodeSet.size > 0 ||
      traceLinkSet.size > 0 ||
      traceNodeColorMap.size > 0 ||
      traceLinkColorMap.size > 0;

    svg.selectAll(".bubble-node").classed("is-trace-node", (d) => {
      const nodeId = String(d?.id || "").trim();
      return (
        hasTrace && (traceNodeSet.has(nodeId) || traceNodeColorMap.has(nodeId))
      );
    });

    svg.selectAll(".bubble-node").attr("opacity", (d) => {
      if (!hasTrace) return null;
      const nodeId = String(d?.id || "").trim();
      return traceNodeSet.has(nodeId) || traceNodeColorMap.has(nodeId)
        ? 1
        : 0.24;
    });

    svg.selectAll(".bubble-circle").attr("stroke", (d) => {
      const nodeId = String(d?.id || "").trim();
      const traceColor = traceNodeColorMap.get(nodeId);

      if (hasTrace && traceColor) {
        return traceColor;
      }

      return d.isSearchRoot ? "#fff3bf" : holderPalette[d.type] || "#74b9ff";
    });

    svg.selectAll(".bubble-circle").attr("stroke-width", (d) => {
      const nodeId = String(d?.id || "").trim();
      const baseStrokeWidth = d.isSearchRoot ? 3.2 : 1.5;

      if (
        hasTrace &&
        (traceNodeSet.has(nodeId) || traceNodeColorMap.has(nodeId))
      ) {
        return Math.max(baseStrokeWidth, 2.8);
      }

      return baseStrokeWidth;
    });

    svg.selectAll(".bubble-link").classed("is-trace-link", (d) => {
      const source = String(d?.source?.id ?? d?.source ?? "").trim();
      const target = String(d?.target?.id ?? d?.target ?? "").trim();
      const linkKey = `${source}->${target}`;
      return (
        hasTrace &&
        (traceLinkSet.has(linkKey) || traceLinkColorMap.has(linkKey))
      );
    });

    svg.selectAll(".bubble-link").attr("stroke", (d) => {
      const source = String(d?.source?.id ?? d?.source ?? "").trim();
      const target = String(d?.target?.id ?? d?.target ?? "").trim();
      const linkKey = `${source}->${target}`;
      const traceColor = traceLinkColorMap.get(linkKey);

      if (hasTrace && traceColor) {
        return traceColor;
      }

      if (hasTrace && traceLinkSet.has(linkKey)) {
        return linkActive;
      }

      return linkBase;
    });

    svg.selectAll(".bubble-link").attr("stroke-width", (d) => {
      const source = String(d?.source?.id ?? d?.source ?? "").trim();
      const target = String(d?.target?.id ?? d?.target ?? "").trim();
      const linkKey = `${source}->${target}`;

      if (
        hasTrace &&
        (traceLinkSet.has(linkKey) || traceLinkColorMap.has(linkKey))
      ) {
        return Math.max(linkWidthActive ?? 2, 2.4);
      }

      return linkWidthBase ?? 1;
    });

    svg.selectAll(".bubble-link").attr("stroke-opacity", (d) => {
      if (!hasTrace) return 1;
      const source = String(d?.source?.id ?? d?.source ?? "").trim();
      const target = String(d?.target?.id ?? d?.target ?? "").trim();
      const linkKey = `${source}->${target}`;
      return traceLinkSet.has(linkKey) || traceLinkColorMap.has(linkKey)
        ? 1
        : 0.08;
    });
  }, [
    holderPalette,
    linkActive,
    linkBase,
    linkWidthActive,
    linkWidthBase,
    selectedNodeId,
    hoveredNodeId,
    traceLinkKeys,
    traceNodeIds,
    tracePathHighlights,
  ]);

  return (
    <div className="bubble-map-shell">
      <svg
        ref={svgRef}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent",
        }}
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
