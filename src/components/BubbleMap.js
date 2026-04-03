import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraphThemeStyle, getHolderPalette } from "../theme/holderPalettes";

const PAN_HINT_THRESHOLD = 20;
const PREWARM_TICKS = 220;
const BOUNDS_UPDATE_EVERY = 5;

const FIT_DURATION_MS = 220;

export default function BubbleMap({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  colorTheme,
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

  const svgRef = useRef(null);
  const boundsRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const viewportRef = useRef({ width: 0, height: 0 });
  const zoomRef = useRef(null);
  const prevGraphSignatureRef = useRef("");
  const panHintFrameRef = useRef(null);
  const pendingBoundsRef = useRef(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
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
      .map((n) => `${n.id}:${n.value}:${n.visualValue ?? ""}:${n.type}`)
      .join("|");
    const linkSig = nextLinks
      .map((l) => {
        const src = typeof l.source === "object" ? l.source?.id : l.source;
        const tgt = typeof l.target === "object" ? l.target?.id : l.target;
        return `${src}>${tgt}`;
      })
      .join("|");
    return `${nodeSig}__${linkSig}__${theme}`;
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
        viewportRef.current = { width, height };
        schedulePanHintUpdate();
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (panHintFrameRef.current !== null) {
        window.cancelAnimationFrame(panHintFrameRef.current);
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

    const el = svgRef.current;
    const width = el.clientWidth || 900;
    const height = el.clientHeight || 650;
    viewportRef.current = { width, height };
    transformRef.current = d3.zoomIdentity;

    const svg = d3.select(el);
    svg.selectAll("*").remove();

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

    // ── Force simulation ──────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation(simNodes)
      .alphaDecay(0.04)
      .alphaMin(0.02)
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((d) => d.id)
          .distance(
            (l) =>
              rScale(getRenderValue(l.source)) +
              rScale(getRenderValue(l.target)) +
              18,
          )
          .strength(0.25),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => -rScale(getRenderValue(d)) * 5.5),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.035))
      .force("y", d3.forceY(height / 2).strength(0.035))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => rScale(getRenderValue(d)) + 3)
          .strength(0.5)
          .iterations(1),
      );

    simulation.stop();
    for (let i = 0; i < PREWARM_TICKS; i += 1) {
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
      .attr("stroke-width", graphThemeStyle.linkWidthBase ?? 1);

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
        onNodeClick && onNodeClick(d);
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.18).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Outer glow ring
    nodeSel
      .append("circle")
      .attr("class", "bubble-glow")
      .attr("r", (d) => rScale(getRenderValue(d)) + 8)
      .attr("fill", (d) => holderPalette[d.type] || "#74b9ff")
      .attr("fill-opacity", graphThemeStyle.baseGlowOpacity ?? 0.08)
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
      .attr("r", (d) => rScale(getRenderValue(d)))
      .attr("fill", (d) => holderPalette[d.type] || "#74b9ff")
      .attr("fill-opacity", 0.72)
      .attr("stroke", (d) =>
        d.isSearchRoot ? "#fff3bf" : holderPalette[d.type] || "#74b9ff",
      )
      .attr("stroke-width", (d) => (d.isSearchRoot ? 3.2 : 1.5))
      .attr("stroke-opacity", (d) => (d.isSearchRoot ? 1 : 0.85));

    // Primary label (for bubbles large enough)
    nodeSel
      .filter((d) => rScale(getRenderValue(d)) > 22)
      .append("text")
      .attr("class", "bubble-label")
      .text((d) => (d.label.length > 13 ? d.label.slice(0, 11) + "…" : d.label))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (rScale(getRenderValue(d)) > 36 ? "-0.3em" : "0.35em"))
      .attr("fill", bubbleLabelColor)
      .attr("font-size", (d) => Math.min(rScale(getRenderValue(d)) / 4.2, 13))
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    // Percentage sub-label (only for large bubbles)
    nodeSel
      .filter((d) => rScale(getRenderValue(d)) > 36)
      .append("text")
      .attr("class", "bubble-pct")
      .text((d) => `${d.pct}%`)
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", bubblePctColor)
      .attr("font-size", (d) => Math.min(rScale(getRenderValue(d)) / 5.5, 11))
      .style("pointer-events", "none");

    linkSel
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

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
        transformRef.current = event.transform;
        container.attr("transform", event.transform);
        schedulePanHintUpdate();
      });

    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", () => onNodeClick && onNodeClick(null));
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
  }, [nodes, links, colorTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus effect (selection + hover): update visuals only ───────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const connectedNodeIds = new Set();
    const activeNodeId = selectedNodeId || hoveredNodeId;
    const isSelectionMode = Boolean(selectedNodeId);
    const isHoverMode = !selectedNodeId && Boolean(hoveredNodeId);

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
        !isSelectionMode || connectedNodeIds.has(d.id) ? null : "none",
      )
      .style("pointer-events", (d) =>
        !isSelectionMode || connectedNodeIds.has(d.id) ? null : "none",
      )
      .attr("opacity", (d) => {
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
        return !isSelectionMode ||
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
  ]);

  return (
    <div className="bubble-map-shell">
      <svg
        ref={svgRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent",
        }}
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
