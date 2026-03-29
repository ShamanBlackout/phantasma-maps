import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { HOLDER_TYPES } from "../data/mockData";

const TYPE_COLOR = Object.fromEntries(
  Object.entries(HOLDER_TYPES).map(([k, v]) => [k, v.color]),
);

export default function BubbleMap({
  nodes,
  links,
  onNodeClick,
  selectedNodeId,
}) {
  const svgRef = useRef(null);

  // ── Main effect: rebuild simulation when nodes/links change ──────────────
  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;

    const el = svgRef.current;
    const width = el.clientWidth || 900;
    const height = el.clientHeight || 650;

    const svg = d3.select(el);
    svg.selectAll("*").remove();

    // ── Defs: glow filter ─────────────────────────────────────────────────
    const defs = svg.append("defs");
    const filter = defs
      .append("filter")
      .attr("id", "bubble-glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "5")
      .attr("result", "blur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // Radial gradient background
    const grad = defs
      .append("radialGradient")
      .attr("id", "bg-grad")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "70%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#0d0d2b");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#070714");

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#bg-grad)");

    const container = svg.append("g");

    // ── Scales ────────────────────────────────────────────────────────────
    const maxVal = d3.max(nodes, (d) => d.value);
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
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((d) => d.id)
          .distance(
            (l) =>
              rScale(l.source.value || 0) + rScale(l.target.value || 0) + 28,
          )
          .strength(0.25),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => -rScale(d.value) * 9),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => rScale(d.value) + 6)
          .strength(0.8),
      );

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = container
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("class", "bubble-link")
      .attr("stroke", "rgba(100,160,255,0.12)")
      .attr("stroke-width", 1);

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
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick && onNodeClick(d);
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
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
      .attr("r", (d) => rScale(d.value) + 8)
      .attr("fill", (d) => TYPE_COLOR[d.type] || "#74b9ff")
      .attr("fill-opacity", 0.08)
      .attr("filter", "url(#bubble-glow)")
      .style("pointer-events", "none");

    // Main bubble
    nodeSel
      .append("circle")
      .attr("class", "bubble-circle")
      .attr("r", (d) => rScale(d.value))
      .attr("fill", (d) => TYPE_COLOR[d.type] || "#74b9ff")
      .attr("fill-opacity", 0.72)
      .attr("stroke", (d) => TYPE_COLOR[d.type] || "#74b9ff")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.85);

    // Primary label (for bubbles large enough)
    nodeSel
      .filter((d) => rScale(d.value) > 22)
      .append("text")
      .attr("class", "bubble-label")
      .text((d) => (d.label.length > 13 ? d.label.slice(0, 11) + "…" : d.label))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (rScale(d.value) > 36 ? "-0.3em" : "0.35em"))
      .attr("fill", "white")
      .attr("font-size", (d) => Math.min(rScale(d.value) / 4.2, 13))
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    // Percentage sub-label (only for large bubbles)
    nodeSel
      .filter((d) => rScale(d.value) > 36)
      .append("text")
      .attr("class", "bubble-pct")
      .text((d) => `${d.pct}%`)
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("font-size", (d) => Math.min(rScale(d.value) / 5.5, 11))
      .style("pointer-events", "none");

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // ── Zoom / pan ────────────────────────────────────────────────────────
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 8])
      .on("zoom", (event) => container.attr("transform", event.transform));

    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", () => onNodeClick && onNodeClick(null));

    return () => {
      simulation.stop();
    };
  }, [nodes, links]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection effect: update visuals only, no simulation restart ─────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg
      .selectAll(".bubble-circle")
      .attr("fill-opacity", (d) =>
        !selectedNodeId || d.id === selectedNodeId ? 0.82 : 0.35,
      )
      .attr("stroke-width", (d) => (d.id === selectedNodeId ? 3 : 1.5));

    svg
      .selectAll(".bubble-link")
      .attr("stroke", (d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return srcId === selectedNodeId || tgtId === selectedNodeId
          ? "rgba(120,220,255,0.55)"
          : "rgba(100,160,255,0.12)";
      })
      .attr("stroke-width", (d) => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return srcId === selectedNodeId || tgtId === selectedNodeId ? 2 : 1;
      });
  }, [selectedNodeId]);

  return (
    <svg
      ref={svgRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: "#070714",
      }}
    />
  );
}
