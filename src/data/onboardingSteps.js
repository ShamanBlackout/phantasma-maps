// Guided tour shown from the welcome dialog ("I'm New Here") and the
// settings menu's Replay Tutorial button. Each `target` must match a
// tutorial-highlight target wired in App.jsx or Header.jsx.
export const ONBOARDING_TUTORIAL_STEPS = [
  {
    title: "Search Bar",
    detail:
      "Use the top search to find a wallet address or holder label. Address searches re-center the map around that wallet, while text searches filter visible nodes.",
    tip: "Shortcut: press / to focus search instantly.",
    target: "search",
  },
  {
    title: "Graph Settings",
    detail:
      "Click the gear icon to open Display & Map Settings. This is where you control theme, density, focus mode, physics, labels, and graph limits.",
    tip: "If the graph feels heavy, lower visible wallets/connections.",
    target: "settings",
  },
  {
    title: "Theme & Density Buttons",
    detail:
      "Theme changes the visual style. Density switches between Comfortable and Compact spacing, especially useful on smaller screens.",
    tip: "Try Compact when comparing many stats at once.",
    target: "settings",
  },
  {
    title: "Focus Mode Toggle",
    detail:
      "Focus Mode hides secondary UI clutter so you can concentrate on graph exploration and selection analysis.",
    tip: "Toggle with keyboard shortcut: F.",
    target: "settings",
  },
  {
    title: "Command Button",
    detail:
      "The Command button opens quick actions like Saved Views, Compare, Trace Path, Diagnostics, and export helpers from one menu.",
    tip: "Shortcut: Ctrl+K.",
    target: "command",
  },
  {
    title: "Saved Views",
    detail:
      "Saved Views stores your current analysis state so you can return to the same token, filters, and perspective later.",
    tip: "Great for repeating weekly analysis.",
    target: "views",
  },
  {
    title: "Compare Mode",
    detail:
      "Compare mode lets you line up two token snapshots side-by-side and inspect wallet count, links, concentration, and top holder share.",
    tip: "Use it to spot distribution differences quickly.",
    target: "compare",
  },
  {
    title: "Trace Path",
    detail:
      "Trace Path highlights the shortest relationship path between two wallets so you can understand how value can move across the graph.",
    tip: "Useful for investigating wallet clusters.",
    target: "trace",
  },
  {
    title: "Diagnostics",
    detail:
      "Diagnostics shows source health, sync information, and status details when loading or API behavior needs deeper inspection.",
    tip: "Check this panel first if something looks out of date.",
    target: "diagnostics",
  },
  {
    title: "Click a Node Now",
    detail:
      "Try clicking any bubble on the map. Selecting a node opens its holder details in the right panel and enables connection and transfer actions.",
    tip: "Nodes are fully interactive during this tour — go ahead and click one.",
    target: "map",
  },
  {
    title: "Selected Node Card",
    detail:
      "After clicking a node the right panel shows wallet address, balance, share percentage, and a sparkline. From here you can open Transfers, Show Connections, or copy the address.",
    tip: "Use Show Connections to refocus the entire graph around that wallet.",
    target: "selected-node",
  },
  {
    title: "You Can Replay This Anytime",
    detail:
      "Open the gear settings menu and click Replay Tutorial to run this walkthrough again whenever you need a refresher.",
    tip: "You are ready to explore the map.",
    target: "settings",
  },
];
