export function isLikelyWalletAddress(rawAddress) {
  const address = String(rawAddress || "").trim();
  return /^[PS][a-zA-Z0-9]{20,}$/.test(address);
}

export function normalizePositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallbackValue;
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers, ...rows]
    .map((line) => line.map((value) => escapeCsvCell(value)).join(","))
    .join("\n");
  return `\uFEFF${lines}`;
}

export function parseTimestampMs(rawTimestamp) {
  const ms = new Date(rawTimestamp).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

export function fmtTokenAmount(n) {
  if (!Number.isFinite(n)) return "0";
  if (n !== 0 && Math.abs(n) < 0.01) return n.toExponential(2);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

export function fmtUsdAmount(n) {
  if (!Number.isFinite(n)) return "$0.00";
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toExponential(2)}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtSharePct(value, currentSupply, fallbackPct = 0) {
  if (Number.isFinite(currentSupply) && currentSupply > 0) {
    return `${(((Number(value) || 0) / currentSupply) * 100).toFixed(2)}%`;
  }

  const parsedFallback = Number(fallbackPct);
  return `${(Number.isFinite(parsedFallback) ? parsedFallback : 0).toFixed(2)}%`;
}

export function formatUtcDateTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Invalid date";

  return `${date.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  })} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

export function parseUtcDateTimeInput(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return null;

  const normalizedWithSeconds =
    normalizedValue.length === 16 ? `${normalizedValue}:00` : normalizedValue;
  const timestamp = new Date(`${normalizedWithSeconds}Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function toUtcDateTimeInputValue(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function makeExportFileName(selectedNode, ext) {
  const addr = selectedNode?.shortAddr?.replace(/[^a-zA-Z0-9]/g, "") || "node";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `transactions-${addr}-${stamp}.${ext}`;
}
