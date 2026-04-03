export const TOKEN_INFO = {
  name: "SOUL",
  fullName: "Phantasma Energy",
  chain: "Phantasma",
  totalSupply: 93400000,
  price: 0.423,
  priceChange24h: 3.2,
};

export const HOLDER_TYPES = {
  team: { label: "Team / Foundation", color: "#ff6b6b" },
  exchange: { label: "Exchange", color: "#ffa502" },
  contract: { label: "Smart Contract", color: "#a29bfe" },
  whale: { label: "Whale", color: "#00cec9" },
  regular: { label: "Holder", color: "#74b9ff" },
};

const BASE_TX_BY_TYPE = {
  team: 460,
  exchange: 2650,
  contract: 1820,
  whale: 980,
  regular: 170,
};

const LINK_TX_WEIGHT_BY_TYPE = {
  team: 1.35,
  exchange: 2.4,
  contract: 1.9,
  whale: 1.25,
  regular: 0.72,
};

export const holders = [
  {
    id: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
    label: "Team / Foundation",
    shortAddr: "P2K8...yEF",
    value: 12500000,
    pct: "13.39",
    type: "team",
  },
  {
    id: "P2Kd4TsHvN8wMqBbCpRsuY3K7Je5FXZ9kQ6Lmj4WXyz",
    label: "Ecosystem Fund",
    shortAddr: "P2Kd...yz",
    value: 8200000,
    pct: "8.78",
    type: "team",
  },
  {
    id: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
    label: "Staking V2",
    shortAddr: "P2KS...mj6",
    value: 9400000,
    pct: "10.06",
    type: "contract",
  },
  {
    id: "P2KLiquidityPoolV1FsuWcY9JeGKdVXnZ4kQ7Rmj6CD",
    label: "LP Pool V1",
    shortAddr: "P2KL...rCD",
    value: 3200000,
    pct: "3.43",
    type: "contract",
  },
  {
    id: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
    label: "Binance Hot",
    shortAddr: "P2KB...rEF",
    value: 6800000,
    pct: "7.28",
    type: "exchange",
  },
  {
    id: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
    label: "KuCoin",
    shortAddr: "P2KK...rGH",
    value: 4500000,
    pct: "4.82",
    type: "exchange",
  },
  {
    id: "P2KGateioExchangeWalletFsuWcY9JeGKdVXnZ4kQ7IJ",
    label: "Gate.io",
    shortAddr: "P2KG...rIJ",
    value: 2100000,
    pct: "2.25",
    type: "exchange",
  },
  {
    id: "P2KWhale001WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6KL",
    label: "Whale #1",
    shortAddr: "P2KW...KL",
    value: 3800000,
    pct: "4.07",
    type: "whale",
  },
  {
    id: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
    label: "Whale #2",
    shortAddr: "P2KW...MN",
    value: 2600000,
    pct: "2.78",
    type: "whale",
  },
  {
    id: "P2KWhale003WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6OP",
    label: "Whale #3",
    shortAddr: "P2KW...OP",
    value: 1900000,
    pct: "2.03",
    type: "whale",
  },
  {
    id: "P2KWhale004WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6QR",
    label: "Whale #4",
    shortAddr: "P2KW...QR",
    value: 1400000,
    pct: "1.50",
    type: "whale",
  },
  {
    id: "P2KWhale005WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6ST",
    label: "Whale #5",
    shortAddr: "P2KW...ST",
    value: 950000,
    pct: "1.02",
    type: "whale",
  },
  {
    id: "P2Kholder001efghijklmnopqrstuvwxyzABCDE12345",
    label: "Holder #1",
    shortAddr: "P2Kh...345",
    value: 780000,
    pct: "0.84",
    type: "regular",
  },
  {
    id: "P2Kholder002efghijklmnopqrstuvwxyzABCDE12346",
    label: "Holder #2",
    shortAddr: "P2Kh...346",
    value: 650000,
    pct: "0.70",
    type: "regular",
  },
  {
    id: "P2Kholder003efghijklmnopqrstuvwxyzABCDE12347",
    label: "Holder #3",
    shortAddr: "P2Kh...347",
    value: 580000,
    pct: "0.62",
    type: "regular",
  },
  {
    id: "P2Kholder004efghijklmnopqrstuvwxyzABCDE12348",
    label: "Holder #4",
    shortAddr: "P2Kh...348",
    value: 510000,
    pct: "0.55",
    type: "regular",
  },
  {
    id: "P2Kholder005efghijklmnopqrstuvwxyzABCDE12349",
    label: "Holder #5",
    shortAddr: "P2Kh...349",
    value: 460000,
    pct: "0.49",
    type: "regular",
  },
  {
    id: "P2Kholder006efghijklmnopqrstuvwxyzABCDE12350",
    label: "Holder #6",
    shortAddr: "P2Kh...350",
    value: 420000,
    pct: "0.45",
    type: "regular",
  },
  {
    id: "P2Kholder007efghijklmnopqrstuvwxyzABCDE12351",
    label: "Holder #7",
    shortAddr: "P2Kh...351",
    value: 380000,
    pct: "0.41",
    type: "regular",
  },
  {
    id: "P2Kholder008efghijklmnopqrstuvwxyzABCDE12352",
    label: "Holder #8",
    shortAddr: "P2Kh...352",
    value: 340000,
    pct: "0.36",
    type: "regular",
  },
  {
    id: "P2Kholder009efghijklmnopqrstuvwxyzABCDE12353",
    label: "Holder #9",
    shortAddr: "P2Kh...353",
    value: 310000,
    pct: "0.33",
    type: "regular",
  },
  {
    id: "P2Kholder010efghijklmnopqrstuvwxyzABCDE12354",
    label: "Holder #10",
    shortAddr: "P2Kh...354",
    value: 290000,
    pct: "0.31",
    type: "regular",
  },
  {
    id: "P2Kholder011efghijklmnopqrstuvwxyzABCDE12355",
    label: "Holder #11",
    shortAddr: "P2Kh...355",
    value: 265000,
    pct: "0.28",
    type: "regular",
  },
  {
    id: "P2Kholder012efghijklmnopqrstuvwxyzABCDE12356",
    label: "Holder #12",
    shortAddr: "P2Kh...356",
    value: 240000,
    pct: "0.26",
    type: "regular",
  },
  {
    id: "P2Kholder013efghijklmnopqrstuvwxyzABCDE12357",
    label: "Holder #13",
    shortAddr: "P2Kh...357",
    value: 220000,
    pct: "0.24",
    type: "regular",
  },
  {
    id: "P2Kholder014efghijklmnopqrstuvwxyzABCDE12358",
    label: "Holder #14",
    shortAddr: "P2Kh...358",
    value: 200000,
    pct: "0.21",
    type: "regular",
  },
  {
    id: "P2Kholder015efghijklmnopqrstuvwxyzABCDE12359",
    label: "Holder #15",
    shortAddr: "P2Kh...359",
    value: 185000,
    pct: "0.20",
    type: "regular",
  },
  {
    id: "P2Kholder016efghijklmnopqrstuvwxyzABCDE12360",
    label: "Holder #16",
    shortAddr: "P2Kh...360",
    value: 170000,
    pct: "0.18",
    type: "regular",
  },
  {
    id: "P2Kholder017efghijklmnopqrstuvwxyzABCDE12361",
    label: "Holder #17",
    shortAddr: "P2Kh...361",
    value: 155000,
    pct: "0.17",
    type: "regular",
  },
  {
    id: "P2Kholder018efghijklmnopqrstuvwxyzABCDE12362",
    label: "Holder #18",
    shortAddr: "P2Kh...362",
    value: 142000,
    pct: "0.15",
    type: "regular",
  },
  {
    id: "P2Kholder019efghijklmnopqrstuvwxyzABCDE12363",
    label: "Holder #19",
    shortAddr: "P2Kh...363",
    value: 130000,
    pct: "0.14",
    type: "regular",
  },
  {
    id: "P2Kholder020efghijklmnopqrstuvwxyzABCDE12364",
    label: "Holder #20",
    shortAddr: "P2Kh...364",
    value: 118000,
    pct: "0.13",
    type: "regular",
  },
  {
    id: "P2Kholder021efghijklmnopqrstuvwxyzABCDE12365",
    label: "Holder #21",
    shortAddr: "P2Kh...365",
    value: 105000,
    pct: "0.11",
    type: "regular",
  },
  {
    id: "P2Kholder022efghijklmnopqrstuvwxyzABCDE12366",
    label: "Holder #22",
    shortAddr: "P2Kh...366",
    value: 92000,
    pct: "0.10",
    type: "regular",
  },
  {
    id: "P2Kholder023efghijklmnopqrstuvwxyzABCDE12367",
    label: "Holder #23",
    shortAddr: "P2Kh...367",
    value: 80000,
    pct: "0.09",
    type: "regular",
  },
].map((holder, index) => {
  const base = BASE_TX_BY_TYPE[holder.type] || 200;
  const sentTransactions = Math.max(12, Math.round(base + index * 9));
  const receivedTransactions = Math.max(
    10,
    Math.round(base * 1.14 + index * 7),
  );

  return {
    ...holder,
    sentTransactions,
    receivedTransactions,
  };
});

const holderTypeById = new Map(
  holders.map((holder) => [holder.id, holder.type]),
);

function buildFakeTransactionHash(source, target, index) {
  const seed = `${source}>${target}:${index}`;
  const seedHex = Array.from(seed)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const body = (seedHex + "9af03bc57de18426".repeat(8)).slice(0, 64);
  return `0x${body}`;
}

export const links = [
  // Team inter-connections
  {
    source: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
    target: "P2Kd4TsHvN8wMqBbCpRsuY3K7Je5FXZ9kQ6Lmj4WXyz",
  },
  {
    source: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kd4TsHvN8wMqBbCpRsuY3K7Je5FXZ9kQ6Lmj4WXyz",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  // Contract links
  {
    source: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
    target: "P2KLiquidityPoolV1FsuWcY9JeGKdVXnZ4kQ7Rmj6CD",
  },
  {
    source: "P2KLiquidityPoolV1FsuWcY9JeGKdVXnZ4kQ7Rmj6CD",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  // Exchange inter-connections
  {
    source: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
    target: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
  },
  // Exchange <-> Whale
  {
    source: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
    target: "P2KWhale001WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6KL",
  },
  {
    source: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
    target: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
  },
  {
    source: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
    target: "P2KWhale003WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6OP",
  },
  {
    source: "P2KGateioExchangeWalletFsuWcY9JeGKdVXnZ4kQ7IJ",
    target: "P2KWhale004WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6QR",
  },
  // Staking <-> Whale
  {
    source: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
    target: "P2KWhale001WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6KL",
  },
  {
    source: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
    target: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
  },
  // Whale <-> Whale
  {
    source: "P2KWhale001WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6KL",
    target: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
  },
  {
    source: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
    target: "P2KWhale003WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6OP",
  },
  // Regular -> Exchanges / Contracts / Whales
  {
    source: "P2Kholder001efghijklmnopqrstuvwxyzABCDE12345",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  {
    source: "P2Kholder002efghijklmnopqrstuvwxyzABCDE12346",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  {
    source: "P2Kholder003efghijklmnopqrstuvwxyzABCDE12347",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  {
    source: "P2Kholder004efghijklmnopqrstuvwxyzABCDE12348",
    target: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
  },
  {
    source: "P2Kholder005efghijklmnopqrstuvwxyzABCDE12349",
    target: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
  },
  {
    source: "P2Kholder006efghijklmnopqrstuvwxyzABCDE12350",
    target: "P2KGateioExchangeWalletFsuWcY9JeGKdVXnZ4kQ7IJ",
  },
  {
    source: "P2Kholder007efghijklmnopqrstuvwxyzABCDE12351",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kholder008efghijklmnopqrstuvwxyzABCDE12352",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kholder009efghijklmnopqrstuvwxyzABCDE12353",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kholder010efghijklmnopqrstuvwxyzABCDE12354",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kholder011efghijklmnopqrstuvwxyzABCDE12355",
    target: "P2KLiquidityPoolV1FsuWcY9JeGKdVXnZ4kQ7Rmj6CD",
  },
  {
    source: "P2Kholder012efghijklmnopqrstuvwxyzABCDE12356",
    target: "P2KLiquidityPoolV1FsuWcY9JeGKdVXnZ4kQ7Rmj6CD",
  },
  {
    source: "P2Kholder013efghijklmnopqrstuvwxyzABCDE12357",
    target: "P2KWhale001WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6KL",
  },
  {
    source: "P2Kholder014efghijklmnopqrstuvwxyzABCDE12358",
    target: "P2KWhale002WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6MN",
  },
  {
    source: "P2Kholder015efghijklmnopqrstuvwxyzABCDE12359",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  {
    source: "P2Kholder016efghijklmnopqrstuvwxyzABCDE12360",
    target: "P2KKucoinExchangeWalletFsuWcY9JeGKdVXnZ4kQ7GH",
  },
  {
    source: "P2Kholder017efghijklmnopqrstuvwxyzABCDE12361",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
  {
    source: "P2Kholder018efghijklmnopqrstuvwxyzABCDE12362",
    target: "P2KBinanceHotWalletFsuWcY9JeGKdVXnZ4kQ7Rmj6EF",
  },
  {
    source: "P2Kholder019efghijklmnopqrstuvwxyzABCDE12363",
    target: "P2KGateioExchangeWalletFsuWcY9JeGKdVXnZ4kQ7IJ",
  },
  {
    source: "P2Kholder020efghijklmnopqrstuvwxyzABCDE12364",
    target: "P2KWhale003WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6OP",
  },
  {
    source: "P2Kholder021efghijklmnopqrstuvwxyzABCDE12365",
    target: "P2KWhale004WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6QR",
  },
  {
    source: "P2Kholder022efghijklmnopqrstuvwxyzABCDE12366",
    target: "P2KWhale005WalletFsuWcY9JeGKdVXnZ4kQ7Rmj6ST",
  },
  {
    source: "P2Kholder023efghijklmnopqrstuvwxyzABCDE12367",
    target: "P2KStakingV2ContractFsuWcY9JeGKdVXnZ4kQ7Rmj6",
  },
].map((link, index) => {
  const sourceType = holderTypeById.get(link.source) || "regular";
  const targetType = holderTypeById.get(link.target) || "regular";
  const sourceWeight = LINK_TX_WEIGHT_BY_TYPE[sourceType] || 1;
  const targetWeight = LINK_TX_WEIGHT_BY_TYPE[targetType] || 1;
  const sentTransactions = Math.max(
    8,
    Math.round(
      (sourceWeight * 128 + targetWeight * 52) * (1 + (index % 6) * 0.12),
    ),
  );
  const receivedTransactions = Math.max(
    6,
    Math.round(sentTransactions * (0.94 + (index % 4) * 0.01)),
  );
  const transactionVolume = sentTransactions * (18 + (index % 5) * 7);
  const transactionHash = buildFakeTransactionHash(
    link.source,
    link.target,
    index,
  );

  return {
    ...link,
    sentTransactions,
    receivedTransactions,
    transactionVolume,
    transactionHash,
  };
});

function makeShortAddress(address) {
  if (typeof address !== "string" || address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

function buildVariantAddress(symbol, type, index) {
  const typeCode = String(type || "holder")
    .slice(0, 3)
    .toUpperCase();
  const serial = String(index + 1).padStart(2, "0");
  return `P2${symbol}${typeCode}${serial}FsuWcY9JeGKdVXnZ4kQ7Rmj6${symbol}${serial}`;
}

function buildVariantDataset(config) {
  const {
    symbol,
    fullName,
    totalSupply,
    price,
    priceChange24h,
    holderMultiplier,
    txMultiplier,
    labelsByType,
  } = config;

  const addressMap = new Map();
  const typeCounters = new Map();

  const variantHolders = holders.map((holder, index) => {
    const nextTypeIndex = typeCounters.get(holder.type) || 0;
    typeCounters.set(holder.type, nextTypeIndex + 1);

    const id = buildVariantAddress(symbol, holder.type, index);
    const value = Math.max(1, Math.round(holder.value * holderMultiplier));
    const pct = ((value / totalSupply) * 100).toFixed(2);
    const label =
      labelsByType?.[holder.type]?.[nextTypeIndex] ||
      `${symbol} ${holder.label}`;

    addressMap.set(holder.id, id);

    return {
      ...holder,
      id,
      label,
      shortAddr: makeShortAddress(id),
      value,
      pct,
      sentTransactions: Math.max(
        6,
        Math.round(holder.sentTransactions * txMultiplier),
      ),
      receivedTransactions: Math.max(
        5,
        Math.round(holder.receivedTransactions * txMultiplier),
      ),
    };
  });

  const variantLinks = links.map((link, index) => {
    const source = addressMap.get(link.source);
    const target = addressMap.get(link.target);

    return {
      ...link,
      source,
      target,
      sentTransactions: Math.max(
        4,
        Math.round(link.sentTransactions * txMultiplier),
      ),
      receivedTransactions: Math.max(
        4,
        Math.round(link.receivedTransactions * txMultiplier),
      ),
      transactionVolume: Math.max(
        25,
        Math.round(link.transactionVolume * holderMultiplier * txMultiplier),
      ),
      transactionHash: buildFakeTransactionHash(
        `${symbol}:${source}`,
        `${symbol}:${target}`,
        index,
      ),
    };
  });

  return {
    tokenInfo: {
      name: symbol,
      fullName,
      chain: TOKEN_INFO.chain,
      totalSupply,
      price,
      priceChange24h,
    },
    holders: variantHolders,
    links: variantLinks,
  };
}

const AURA_DATA = buildVariantDataset({
  symbol: "AURA",
  fullName: "Aura Flux",
  totalSupply: 41200000,
  price: 1.184,
  priceChange24h: 7.8,
  holderMultiplier: 0.44,
  txMultiplier: 0.82,
  labelsByType: {
    team: ["Aura Treasury", "Flux Growth Fund"],
    contract: ["Aura Vault", "Prism Router"],
    exchange: ["Sunset Exchange", "Horizon Desk", "SignalX"],
    whale: [
      "Orbit Whale",
      "Comet Whale",
      "Beacon Whale",
      "Northwind Whale",
      "Quartz Whale",
    ],
  },
});

const NOVA_DATA = buildVariantDataset({
  symbol: "NOVA",
  fullName: "Nova Circuit",
  totalSupply: 275000000,
  price: 0.0724,
  priceChange24h: -2.3,
  holderMultiplier: 1.28,
  txMultiplier: 1.36,
  labelsByType: {
    team: ["Nova Core Treasury", "Ignition Reserve"],
    contract: ["Nova Staking Core", "Nova LP Nexus"],
    exchange: ["Cinder Market", "Atlas Exchange", "DeepSpace CEX"],
    whale: [
      "Helios Fund",
      "Apex Whale",
      "Meteor Whale",
      "Vector Whale",
      "Relay Whale",
    ],
  },
});

const GLINT_DATA = buildVariantDataset({
  symbol: "GLINT",
  fullName: "Glint Alloy",
  totalSupply: 9800000,
  price: 3.61,
  priceChange24h: 14.9,
  holderMultiplier: 0.16,
  txMultiplier: 0.58,
  labelsByType: {
    team: ["Glint Treasury", "Alloy Reserve"],
    contract: ["Glint Forge", "Alloy Pool"],
    exchange: ["Mint Harbor", "Auric Exchange", "Glassbook"],
    whale: [
      "Foundry Whale",
      "Lattice Whale",
      "Pulse Whale",
      "Mirror Whale",
      "Arc Whale",
    ],
  },
});

export const MOCK_TOKEN_DATA_BY_SYMBOL = {
  [TOKEN_INFO.name]: {
    tokenInfo: TOKEN_INFO,
    holders,
    links,
  },
  AURA: AURA_DATA,
  NOVA: NOVA_DATA,
  GLINT: GLINT_DATA,
};

export const MOCK_TOKEN_SYMBOLS = Object.keys(MOCK_TOKEN_DATA_BY_SYMBOL);
