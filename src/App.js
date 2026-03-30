import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import { holders, links, TOKEN_INFO } from "./data/mockData";
import "./App.css";

const STATS_PANEL_STORAGE_KEY = "phantasma-maps:stats-panel-collapsed";

export default function App() {
  const bubbleMapActionsRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STATS_PANEL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STATS_PANEL_STORAGE_KEY,
        String(isStatsCollapsed),
      );
    } catch {
      // Ignore storage access issues and fall back to in-memory state.
    }
  }, [isStatsCollapsed]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return holders;
    const q = searchQuery.toLowerCase();
    return holders.filter(
      (h) =>
        h.id.toLowerCase().includes(q) ||
        h.label.toLowerCase().includes(q) ||
        h.shortAddr.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const filteredLinks = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return links.filter((l) => ids.has(l.source) && ids.has(l.target));
  }, [filteredNodes]);

  return (
    <div className="app-root">
      <Header onSearch={setSearchQuery} tokenInfo={TOKEN_INFO} />
      <div className="main-layout">
        <div className="map-area">
          <BubbleMap
            nodes={filteredNodes}
            links={filteredLinks}
            onNodeClick={setSelectedNode}
            selectedNodeId={selectedNode?.id}
            onReady={(actions) => {
              bubbleMapActionsRef.current = actions;
            }}
          />
          <div className="map-hint">
            <span className="map-hint-text">
              Scroll to zoom · Drag to pan · Click a bubble for details
            </span>
            <button
              type="button"
              className="map-hint-fit-btn"
              onClick={() => bubbleMapActionsRef.current?.fitToView?.()}
              title="Fit all bubbles into view"
            >
              ⊡ Fit to View
            </button>
          </div>
        </div>
        <StatsPanel
          holders={holders}
          tokenInfo={TOKEN_INFO}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() =>
            setIsStatsCollapsed((collapsed) => !collapsed)
          }
        />
      </div>
    </div>
  );
}
