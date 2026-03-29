import React, { useState } from "react";

export default function Header({ onSearch, tokenInfo }) {
  const [input, setInput] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(input.trim());
  }

  function handleClear() {
    setInput("");
    onSearch("");
  }

  const priceUp = tokenInfo.priceChange24h >= 0;

  return (
    <header className="header">
      <div className="header-logo">
        <span className="header-logo-icon">◈</span>
        <span className="header-logo-text">
          Phantasma<span className="header-logo-accent">Maps</span>
        </span>
      </div>

      <form className="header-search" onSubmit={handleSubmit}>
        <span className="header-search-icon">⌕</span>
        <input
          className="header-search-input"
          type="text"
          placeholder="Search address or holder name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {input && (
          <button
            type="button"
            className="header-search-clear"
            onClick={handleClear}
          >
            ✕
          </button>
        )}
        <button type="submit" className="header-search-btn">
          Search
        </button>
      </form>

      <div className="header-meta">
        <div className="header-chain">
          <span className="header-chain-dot" />
          <span>Phantasma</span>
        </div>
        <div className="header-price">
          <span className="header-price-symbol">{tokenInfo.name}</span>
          <span className="header-price-value">
            ${tokenInfo.price.toFixed(3)}
          </span>
          <span className={`header-price-change ${priceUp ? "up" : "down"}`}>
            {priceUp ? "▲" : "▼"} {Math.abs(tokenInfo.priceChange24h)}%
          </span>
        </div>
      </div>
    </header>
  );
}
