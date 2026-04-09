PHANTASMA-MAPS(1)

NAME
phantasma-maps - React and D3 holder-map explorer for Phantasma token distribution, wallet relationships, live token metadata, and backend sync state.

SYNOPSIS
npm install
npm run start:dev
npm run build
npm run start:prod
npm run build:prod

DESCRIPTION
phantasma-maps is a single-page React application that renders a token holder graph as an interactive bubble map. The UI is designed around three concurrent data streams:

    1. Token graph data from the PhantasmaMaps API.
    2. Token metadata and live market pricing.
    3. Backend sync status for the chain ingestion pipeline.

    The application prefers live API data. If the API is unavailable at runtime, the app can fall back to structured mock datasets defined in src/data/mockData.js. The fallback is intended for resilience during development, not as a source of truth.

    The main screen is composed of three functional regions:

    1. Header: search, theme selection, block-sync status, and price display.
    2. Bubble map: D3-driven graph visualization with hover, selection, drag, zoom, and fit-to-view behavior.
    3. Stats panel: token metadata, legend filtering, holder summaries, selected-node details, and connection controls.

RUNTIME OVERVIEW
Application startup proceeds in this order:

    1. React mounts App from src/index.js.
    2. App reads localStorage for the persisted theme, selected token, and stats-panel state.
    3. App requests the tracked token list from GET /tokens.
    4. App requests metadata for the selected token from GET /tokens/:symbol/metadata.
    5. App requests graph data from either:
    	 GET /graph/token/:symbol
    	 or
    	 GET /graph/address/:address?token=:symbol&depth=:depth&edgeLimit=:limit
    6. App requests backend sync progress from GET /sync-status on a polling interval.
    7. If the selected token is SOUL, App polls CoinGecko first and CoinMarketCap second for price updates.

    Once graph data is loaded, App normalizes balances, converts API payloads into D3-friendly nodes and links, applies search and legend filters, and passes the filtered graph into BubbleMap.

DATA FLOW
Live graph path:

    1. App builds the correct endpoint for the selected token and optional root address.
    2. The raw API graph payload is normalized by buildGraphDataFromApi().
    3. If a root address is active, App attempts to fetch paginated transactions for that address.
    4. If transaction history is available, App uses buildConnectionsGraphFromTransactions() to construct a focused network around the selected wallet.
    5. If transaction history is unavailable, App falls back to buildNeighborFocusedGraph() using the loaded graph payload.
    6. The final nodes and links are rendered by BubbleMap and summarized by StatsPanel.

    Search behavior:

    1. If the search input matches a wallet-address pattern, the graph is re-rooted around that address.
    2. Otherwise, the search input is treated as a text filter against node id, label, and shortened address.

    Connection behavior:

    1. Selecting a node enables Show Connections when more direct wallet activity exists than is visible in the currently filtered graph.
    2. Triggering Show Connections focuses the app on the selected wallet and switches the graph into connection mode.
    3. Clear Connections resets the graph to the default token view or configured root address.

    Transactions behavior:

    1. Selecting a node loads paginated address transactions from the API.
    2. If the transaction endpoint fails, the app synthesizes graph-derived transactions from visible links.
    3. The transaction modal supports filtering by direction, counterparty, time range, token amount, and USD value.
    4. Filtered transactions can be exported to JSON or CSV.

API CONTRACT
The frontend expects the backend to expose the following routes:

    GET /tokens
    	Returns tracked token symbols.

    GET /tokens/:tokenSymbol/metadata
    	Returns token metadata, decimals, max supply, and current supply.

    GET /graph/token/:tokenSymbol
    	Returns a token-wide holder graph.

    GET /graph/address/:address?token=:symbol&depth=:depth&edgeLimit=:limit
    	Returns a root-address-focused graph.

    GET /transactions?token=:symbol&address=:address&page=:page&pageSize=:size
    	Returns paginated address transactions.

    GET /sync-status
    	Returns backend sync state including chainHeadBlockHeight and the internal __chain__ row used by the header sync pill.

ENVIRONMENT
The application reads these environment variables at startup:

    REACT_APP_PHANTASMA_EXPLORER_BASE
    	Base URL for wallet explorer links.

    REACT_APP_PHANTASMA_TX_EXPLORER_BASE
    	Base URL for transaction explorer links.

    REACT_APP_SOUL_PRICE_API_URL
    	Primary CoinGecko endpoint for SOUL pricing.

    REACT_APP_CMC_SOUL_QUOTES_API_URL
    	CoinMarketCap quote endpoint.

    REACT_APP_CMC_SOUL_SYMBOL
    	Market symbol used when parsing CoinMarketCap payloads.

    REACT_APP_SOUL_PRICE_BASE_POLL_INTERVAL_MS
    	Normal SOUL price poll interval.

    REACT_APP_SOUL_PRICE_MAX_BACKOFF_MS
    	Maximum retry interval after quote failures or rate limiting.

    REACT_APP_SOUL_PRICE_REQUEST_TIMEOUT_MS
    	Timeout for market-price fetches.

    REACT_APP_CMC_API_KEY
    	Optional CoinMarketCap key.

    REACT_APP_CMC_PROXY_URL
    	Optional server-side proxy for CoinMarketCap requests.

    REACT_APP_CMC_ALLOW_BROWSER_DIRECT
    	Enables direct browser calls to CoinMarketCap if explicitly set to true.

    REACT_APP_MAPS_API_BASE_URL
    	Base URL of the PhantasmaMaps API. Defaults to http://localhost:3000.

    REACT_APP_MAPS_API_TOKEN_SYMBOL
    	Initial tracked token symbol.

    REACT_APP_MAPS_API_ROOT_ADDRESS
    	Optional default root address for focused graph mode.

    REACT_APP_MAPS_API_GRAPH_DEPTH
    	Address graph traversal depth.

    REACT_APP_MAPS_API_GRAPH_EDGE_LIMIT
    	Maximum number of edges requested for address graph loads.

    REACT_APP_MAPS_API_REQUEST_TIMEOUT_MS
    	Timeout for graph, metadata, token-list, and sync-status API requests.

    REACT_APP_MAPS_API_TX_PAGE_SIZE
    	Transaction page size for the address transaction loader.

    REACT_APP_MAPS_API_TX_MAX_PAGES
    	Hard cap on paginated transaction fetches per address.

    REACT_APP_MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS
    	Poll interval for backend sync-state refreshes.

COMMANDS
npm run start:dev
Starts the CRA development server.

    npm run build
    	Produces a production build in build/.

    npm run start:prod
    	Runs the production-start helper in scripts/startProd.js.

    npm run build:prod
    	Runs sammy.js and then builds the app.

    npm test
    	Runs the CRA test runner.

FILES
src/index.js
React entry point.

    src/App.js
    	Application shell, state container, API integration, data normalization, filtering, export logic, and modal orchestration.

    src/components/Header.js
    	Header UI for search, theme selection, sync badge, and price display.

    src/components/BubbleMap.js
    	D3 visualization engine for nodes, links, zoom, drag, hover, and fit-to-view behavior.

    src/components/StatsPanel.js
    	Token summary, legend controls, selected-node details, and holder list.

    src/data/mockData.js
    	Mock token datasets and helper functions used when live API data is unavailable.

    src/theme/holderPalettes.js
    	Color palettes and graph styling presets by theme.

    src/serviceWorker.js
    	Optional CRA service-worker registration helpers.

    src/App.test.js
    Targeted app-shell smoke test for the current React UI.

    scripts/startProd.js
    	Node-based production launcher.

    sammy.js
    	Startup banner script used by the production build flow.

FUNCTION INDEX

src/App.js
parseEnvMs(key, fallbackMs)
Reads a positive numeric environment value in milliseconds and falls back if the value is missing or invalid.

    parseEnvInt(key, fallbackValue)
    	Reads a positive integer environment value and clamps invalid input to the fallback.

    parseEnvString(key, fallbackValue)
    	Reads and trims a string environment value, removing wrapping quotes when present.

    parseRetryAfterMs(response)
    	Converts an HTTP Retry-After header into milliseconds when the backend or upstream rate-limits requests.

    fetchJsonWithTimeout(url, options, timeoutMs)
    	Performs a fetch with AbortController timeout handling and returns a normalized result object rather than throwing on ordinary HTTP failures.

    shortenAddress(address)
    	Converts a long address into a compact display form like XXXX...YYY.

    inferHolderType(label, pct)
    	Maps a percentage share into the app's holder-size buckets.

    normalizeAmount(rawAmount)
    	Safely coerces numeric amounts into non-negative numbers.

    applyCurrentSupplyToNodes(nodes, currentSupply)
    	Recomputes node percentage ownership using the latest current supply.

    buildGraphDataFromApi(graphPayload, decimals)
    	Transforms the backend graph response into frontend node and link structures, normalizes decimals, aggregates node stats, and calculates supply-based percentages.

    buildNeighborFocusedGraph(graphData, rootAddress)
    	Creates a focused graph containing only the root wallet and its immediate neighbors, with visual emphasis on the root node.

    createTokensEndpoint()
    	Builds the GET /tokens URL.

    createTokenInfoEndpoint(tokenSymbol)
    	Builds the GET /tokens/:tokenSymbol/metadata URL.

    createGraphEndpoint(tokenSymbol, rootAddress)
    	Builds either a token-wide graph endpoint or an address-focused graph endpoint.

    createTransactionsEndpoint(address, tokenSymbol, page, pageSize)
    	Builds the paginated GET /transactions URL for a wallet.

    createSyncStatusEndpoint()
    	Builds the GET /sync-status URL.

    fetchAllTransactionsForAddress(address, tokenSymbol)
    	Paginates across address transactions until the API total is satisfied or the configured page cap is reached.

    buildConnectionsGraphFromTransactions(transactions, rootAddress, fallbackGraph, currentSupply)
    	Creates a wallet-centered graph directly from transaction history, preserving known node metadata from the graph payload when available.

    parseTimestampMs(rawTimestamp)
    	Parses a timestamp into milliseconds, defaulting to now if parsing fails.

    getMockTokenData(tokenSymbol)
    	Returns a normalized mock dataset for the requested symbol.

    parseCoinGeckoQuote(payload)
    	Extracts SOUL price and 24-hour change from a CoinGecko payload.

    parseCoinMarketCapQuote(payload)
    	Extracts SOUL price and 24-hour change from a CoinMarketCap payload.

    fetchSoulQuoteFromCoinGecko()
    	Calls CoinGecko and returns a normalized quote result.

    fetchSoulQuoteFromCoinMarketCap()
    	Calls CoinMarketCap directly or through a proxy and returns a normalized quote result.

    fmtTokenAmount(n)
    	Formats token balances into compact human-readable values.

    fmtUsdAmount(n)
    	Formats USD values into compact human-readable values.

    fmtSharePct(value, currentSupply, fallbackPct)
    	Formats a wallet share percentage using supply when available.

    toDateTimeLocalValue(timestamp)
    	Converts a timestamp into the HTML datetime-local control format.

    makeExportFileName(selectedNode, ext)
    	Creates a timestamped export filename for transaction downloads.

    App()
    	The main application component. It owns global state, handles API polling, transforms graph data, coordinates selection and filtering, manages the transfers modal, and renders Header, BubbleMap, and StatsPanel.

    fetchTokenInfo()
    Loads token metadata and supply information for the active symbol.

    fetchAvailableTokens()
    Loads the tracked token list used by the sidebar token picker.

    fetchMapGraph()
    Loads the active graph, applies address-focused connection logic when needed, and falls back to mock data on transport failure.

    scheduleNextPoll(delayMs)
    Schedules the next SOUL market-price refresh with retry backoff support.

    fetchSoulPrice()
    Refreshes SOUL market pricing by trying CoinGecko first and CoinMarketCap second.

    fetchSyncStatus()
    Polls backend sync progress and updates the header block-sync pill.

    fetchSelectedNodeTransactions()
    Loads paginated transactions for the selected wallet and synthesizes graph-derived entries when the API is unavailable.

    isPotentialAddress(rawValue)
    	Checks whether a user search resembles a Phantasma wallet address.

    handleHeaderSearch(rawValue)
    	Routes the search input into either address-rooting behavior or text filtering behavior.

    handleShowNodeConnections(nodeId)
    	Switches the graph into connection mode around the specified wallet.

    handleClearConnections()
    	Resets connection mode, filters, selection, and root address.

    resetAllTransactionFilters()
    	Clears all modal-side transaction filters.

    buildExportRows()
    	Converts filtered transaction objects into exportable row objects.

    downloadBlobFile(content, mimeType, fileName)
    	Triggers a client-side file download for exported content.

    exportTransactions(format)
    	Exports filtered transactions as JSON or CSV.

    copyTextToClipboard(value)
    	Copies text using the Clipboard API with a textarea fallback.

    handleCopyAddress(address)
    	Copies a wallet address and shows temporary copied state.

    handleCopyTransactionHash(hash)
    	Copies a transaction hash and shows temporary copied state.

src/components/Header.js
Header(props)
Renders the top application bar with branding, search, sync state, theme selector, and token price display.

    handleSubmit(e)
    	Submits the search form and forwards the trimmed query to App.

    handleClear()
    	Clears the search box and resets the upstream search state.

src/components/BubbleMap.js
BubbleMap(props)
Renders the interactive D3 graph and exposes fit-to-view actions back to App.

    formatSharePct(node)
    	Formats the visible ownership percentage for a node.

    updatePanHints(nextBounds)
    	Calculates whether more graph content exists offscreen in each direction.

    schedulePanHintUpdate(nextBounds)
    	Batches pan-hint recalculation through requestAnimationFrame.

    buildGraphSignature(nextNodes, nextLinks, theme)
    	Produces a stable signature so BubbleMap can avoid expensive graph rebuilds when nothing meaningful changed.

    fitToView()
    	Computes a zoom transform that fits all visible nodes into the current viewport.

src/components/StatsPanel.js
fmt(n)
Formats numeric token values for compact sidebar display.

    StatsPanel(props)
    	Renders token metadata, connection controls, legend filters, selected-node details, token picker, and top holders.

    handleTokenPick(tokenSymbol)
    	Applies a token selection from the modal token picker.

    handleTokenMenuToggle(event)
    	Opens or closes the token picker and computes its animation offset.

src/theme/holderPalettes.js
getHolderPalette(theme)
Returns the wallet category color palette for the selected theme.

    getGraphThemeStyle(theme)
    	Returns the link, glow, opacity, and stroke settings for the selected theme.

src/data/mockData.js
buildFakeTransactionHash(source, target, index)
Generates deterministic fake transaction hashes for mock links.

    makeShortAddress(address)
    	Creates abbreviated mock address labels.

    buildVariantAddress(symbol, type, index)
    	Generates deterministic symbol-specific wallet ids for mock datasets.

    buildVariantDataset(config)
    	Produces a full mock token dataset by transforming the base SOUL-style holder graph into a token-specific variant.

src/serviceWorker.js
register(config)
Registers the service worker in production builds when enabled.

    registerValidSW(swUrl, config)
    	Installs the service worker and fires CRA update and success callbacks.

    checkValidServiceWorker(swUrl, config)
    	Verifies that the service worker script exists and reloads the page if it does not.

    unregister()
    	Removes an installed service worker.

scripts/startProd.js
run(binName, args)
Executes a local project binary from node_modules/.bin.

    runNodeScript(scriptRelativePath)
    	Executes a Node script using the active Node runtime.

sammy.js
sammy.js contains no reusable functions. It prints a startup banner used by the production flow.

UI BEHAVIOR
Themes
The app supports dark, light, ghost-blue, and kcal-red visual themes. Theme state is persisted locally.

    Search
    	Search accepts either wallet addresses or general text. Address searches re-root the graph. Text searches filter the currently loaded graph.

    Sync pill
    	The Block Sync pill shows processed block height versus current chain head plus the timestamp of the last backend sync update.

    Connection focus
    	Connection mode is wallet-centric and can be built from paginated transactions even when the address graph payload is insufficiently detailed by itself.

    Mobile behavior
    	On mobile, the layout stacks vertically, pan hints remain available, and the stats panel becomes full width below the graph.

LOCAL STORAGE KEYS
phantasma-maps:stats-panel-collapsed
Persists whether the stats panel is collapsed.

    phantasma-maps:color-theme
    	Persists the active color theme.

    phantasma-maps:selected-token-symbol
    	Persists the selected tracked token.

KNOWN LIMITATIONS
The test harness is intentionally lightweight and mocks BubbleMap plus several browser APIs, so it validates app-shell behavior rather than D3 rendering fidelity.

    SOUL price polling is the only live market feed implemented. Other tokens display market data only when mock fallback supplies it.

    Mock fallback is triggered when the graph request returns status 0, which typically indicates network or CORS failure from the browser.

DEVELOPER NOTES
When adding a new token data source, update the API so that /tokens, /tokens/:symbol/metadata, /graph/token/:symbol, and /transactions all remain shape-compatible with the current frontend assumptions.

    When changing graph payloads, preserve these fields unless the frontend is updated in lockstep:

    nodes[].address
    nodes[].label
    nodes[].balance
    edges[].fromAddress
    edges[].toAddress
    edges[].amount
    edges[].txHash
    totalSupply

    When adjusting styling, keep the mobile header rules in sync with header-meta and header-sync, since the sync pill is one of the first places to overflow on narrow viewports.

SEE ALSO
The companion backend repository PhantasmaMaps-api, which provides the graph, metadata, transactions, and sync endpoints consumed by this frontend.
