import React, { useState, useMemo } from "react";
import Header from "./components/Header";
import BubbleMap from "./components/BubbleMap";
import StatsPanel from "./components/StatsPanel";
import { holders, links, TOKEN_INFO } from "./data/mockData";
import "./App.css";

export default function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
          />
          <div className="map-hint">
            Scroll to zoom · Drag to pan · Click a bubble for details
          </div>
        </div>
        <StatsPanel
          holders={holders}
          tokenInfo={TOKEN_INFO}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
        />
      </div>
    </div>
  );
}
