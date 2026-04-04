export const HOLDER_COLOR_PALETTES = {
  dark: {
    dominant: "#f062a5",
    major: "#f0c85a",
    large: "#9d77ef",
    medium: "#3fbe4a",
    minor: "#5b9ff0",
  },
  light: {
    dominant: "#b48667",
    major: "#a77b4c",
    large: "#8b8f63",
    medium: "#6f8a78",
    minor: "#8a8f9d",
  },
  "ghost-blue": {
    dominant: "#d4af5a",
    major: "#7b69c7",
    large: "#3f4f98",
    medium: "#6658a8",
    minor: "#a395c6",
  },
  "kcal-red": {
    dominant: "#1f6f78",
    major: "#b89a53",
    large: "#b96f46",
    medium: "#4f6d9a",
    minor: "#d2c3a2",
  },
};

export const GRAPH_THEME_STYLES = {
  dark: {
    linkBase: "rgba(102,154,255,0.16)",
    linkActive: "rgba(118,226,242,0.74)",
    linkWidthBase: 1.15,
    linkWidthActive: 2.2,
    selectedFillOpacity: 0.88,
    fadedFillOpacity: 0.34,
    selectedStrokeWidth: 3.2,
    defaultStrokeWidth: 1.7,
    hoverGlowOpacity: 0.34,
    hoverStroke: "rgba(246,202,118,0.9)",
    hoverStrokeWidth: 2,
    hoverStrokeOpacity: 0.88,
    baseGlowOpacity: 0.16,
  },
  light: {
    linkBase: "rgba(100,132,168,0.48)",
    linkActive: "rgba(72,108,148,0.9)",
    linkWidthBase: 1.6,
    linkWidthActive: 2.8,
    selectedFillOpacity: 0.86,
    fadedFillOpacity: 0.4,
    selectedStrokeWidth: 3,
    defaultStrokeWidth: 1.45,
    hoverGlowOpacity: 0.34,
    hoverStroke: "rgba(52,86,126,0.92)",
    hoverStrokeWidth: 2.4,
    hoverStrokeOpacity: 0.95,
    baseGlowOpacity: 0.14,
  },
  "ghost-blue": {
    linkBase: "rgba(82,120,201,0.24)",
    linkActive: "rgba(116,162,255,0.9)",
    linkWidthBase: 1,
    linkWidthActive: 2.1,
    selectedFillOpacity: 0.86,
    fadedFillOpacity: 0.33,
    selectedStrokeWidth: 3.1,
    defaultStrokeWidth: 1.5,
    hoverGlowOpacity: 0.3,
    hoverStroke: "rgba(222,188,96,0.94)",
    hoverStrokeWidth: 1.9,
    hoverStrokeOpacity: 0.9,
    baseGlowOpacity: 0.16,
  },
  "kcal-red": {
    linkBase: "rgba(255,120,120,0.18)",
    linkActive: "rgba(255,165,140,0.72)",
    linkWidthBase: 1,
    linkWidthActive: 2,
    selectedFillOpacity: 0.85,
    fadedFillOpacity: 0.33,
    selectedStrokeWidth: 3,
    defaultStrokeWidth: 1.5,
    hoverGlowOpacity: 0.24,
    hoverStroke: "rgba(255,198,180,0.82)",
    hoverStrokeWidth: 1.8,
    hoverStrokeOpacity: 0.8,
    baseGlowOpacity: 0.09,
  },
};

export function getHolderPalette(theme) {
  return HOLDER_COLOR_PALETTES[theme] || HOLDER_COLOR_PALETTES.dark;
}

export function getGraphThemeStyle(theme) {
  return GRAPH_THEME_STYLES[theme] || GRAPH_THEME_STYLES.dark;
}
