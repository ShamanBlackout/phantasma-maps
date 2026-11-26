export function formatApiErrorMeta(errorLike) {
  if (!errorLike || typeof errorLike !== "object") return "";

  const parts = [];
  const code = String(errorLike.errorCode || errorLike.code || "").trim();
  const requestId = String(errorLike.requestId || "").trim();
  const status = Number(errorLike.status);

  if (code) {
    parts.push(`code ${code}`);
  }

  if (Number.isFinite(status) && status > 0 && status !== 404) {
    parts.push(`status ${status}`);
  }

  if (requestId) {
    parts.push(`request ${requestId}`);
  }

  return parts.length ? ` [${parts.join(", ")}]` : "";
}

export function buildApiErrorRecord(errorLike, source, fallbackMessage) {
  const safeError = errorLike && typeof errorLike === "object" ? errorLike : {};
  const status = Number(safeError.status);
  const code = String(safeError.errorCode || safeError.code || "").trim();
  const requestId = String(safeError.requestId || "").trim();
  const message = String(
    safeError.errorMessage ||
      safeError.message ||
      fallbackMessage ||
      "API request failed",
  ).trim();

  return {
    source: String(source || "unknown"),
    status: Number.isFinite(status) ? status : null,
    code: code || null,
    requestId: requestId || null,
    message,
    recordedAt: Date.now(),
  };
}

export function isTokenNotFoundError(errorLike) {
  if (!errorLike || typeof errorLike !== "object") return false;

  const status = Number(errorLike.status);
  const code = String(errorLike.errorCode || errorLike.code || "")
    .trim()
    .toUpperCase();

  const tokenValidationCodes = new Set([
    "TOKEN_SYMBOL_INVALID",
    "TOKEN_INVALID",
  ]);

  return (
    status === 404 ||
    code === "TOKEN_NOT_FOUND" ||
    (status === 400 && tokenValidationCodes.has(code))
  );
}

function buildTokenNotFoundMessage(tokenSymbol) {
  const normalizedSymbol = String(tokenSymbol || "")
    .trim()
    .toUpperCase();
  return normalizedSymbol
    ? `${normalizedSymbol} data is not available yet. Try another token or check back after sync.`
    : "Requested token data is not available yet. Try another token or check back after sync.";
}

export function buildTokenNotFoundStatus(tokenSymbol, errorLike) {
  return `${buildTokenNotFoundMessage(tokenSymbol)}${formatApiErrorMeta(errorLike)}`;
}
