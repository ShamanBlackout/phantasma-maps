export const HOLDER_COLOR_PALETTES = {
  dark: {
    team: "#ff6b6b",
    exchange: "#ffa502",
    contract: "#a29bfe",
    whale: "#00cec9",
    regular: "#74b9ff",
  },
  light: {
    team: "#ff9aa8",
    exchange: "#ffd27a",
    contract: "#c8ccff",
    whale: "#8debe7",
    regular: "#b6dcff",
  },
  "ghost-blue": {
    team: "#ff8da0",
    exchange: "#ffd27f",
    contract: "#6f8fff",
    whale: "#3fa7ff",
    regular: "#5a9dff",
  },
  "kcal-red": {
    team: "#ff7171",
    exchange: "#ffb16b",
    contract: "#d4a6ff",
    whale: "#ff8d8d",
    regular: "#ffb3b3",
  },
};

export const GRAPH_THEME_STYLES = {
  dark: {
    linkBase: "rgba(100,160,255,0.12)",
    linkActive: "rgba(120,220,255,0.55)",
    linkWidthBase: 1,
    linkWidthActive: 2,
    selectedFillOpacity: 0.84,
    fadedFillOpacity: 0.34,
    selectedStrokeWidth: 3,
    defaultStrokeWidth: 1.5,
    hoverGlowOpacity: 0.2,
    hoverStroke: "rgba(255,255,255,0.55)",
    hoverStrokeWidth: 1.5,
    hoverStrokeOpacity: 0.65,
    baseGlowOpacity: 0.08,
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
    linkBase: "rgba(72,136,210,0.28)",
    linkActive: "rgba(120,180,255,0.78)",
    linkWidthBase: 1,
    linkWidthActive: 2,
    selectedFillOpacity: 0.86,
    fadedFillOpacity: 0.33,
    selectedStrokeWidth: 3.1,
    defaultStrokeWidth: 1.5,
    hoverGlowOpacity: 0.22,
    hoverStroke: "rgba(150,205,255,0.86)",
    hoverStrokeWidth: 1.7,
    hoverStrokeOpacity: 0.75,
    baseGlowOpacity: 0.11,
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
