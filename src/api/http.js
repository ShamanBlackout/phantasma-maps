export function parseRetryAfterMs(response) {
  const rawValue = response.headers.get("retry-after");
  if (!rawValue) return null;
  const asSeconds = Number(rawValue);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return asSeconds * 1000;
  }
  return null;
}

function parseEnvelopePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      requestId: null,
      meta: null,
      data: payload,
    };
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : null;
  const meta =
    payload.meta && typeof payload.meta === "object" ? payload.meta : null;
  const data = Object.prototype.hasOwnProperty.call(payload, "data")
    ? payload.data
    : payload;

  return {
    requestId,
    meta,
    data,
  };
}

export async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs = 7000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      signal: controller.signal,
    });

    const retryAfterFromHeader = parseRetryAfterMs(response);

    let rawPayload = null;
    try {
      rawPayload = await response.json();
    } catch {
      rawPayload = null;
    }

    const normalized = parseEnvelopePayload(rawPayload);

    if (!response.ok) {
      const envelopeRetryAfter = Number(rawPayload?.retryAfterMs);
      const retryAfterMs =
        Number.isFinite(envelopeRetryAfter) && envelopeRetryAfter > 0
          ? envelopeRetryAfter
          : retryAfterFromHeader;
      return {
        ok: false,
        status: response.status,
        isNetworkError: false,
        retryAfterMs,
        errorCode:
          typeof rawPayload?.error?.code === "string"
            ? rawPayload.error.code
            : null,
        errorMessage:
          typeof rawPayload?.error?.message === "string"
            ? rawPayload.error.message
            : `Request failed with status ${response.status}`,
        errorDetails:
          rawPayload?.error?.details &&
          typeof rawPayload.error.details === "object"
            ? rawPayload.error.details
            : null,
        requestId: normalized.requestId,
        meta: normalized.meta,
        payload: normalized.data,
        rawPayload,
      };
    }

    return {
      ok: true,
      status: response.status,
      isNetworkError: false,
      payload: normalized.data,
      rawPayload,
      requestId: normalized.requestId,
      meta: normalized.meta,
      retryAfterMs: retryAfterFromHeader,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      isNetworkError: true,
      retryAfterMs: null,
      errorCode: "NETWORK_ERROR",
      errorMessage: "Network request failed",
      errorDetails: null,
      requestId: null,
      meta: null,
      payload: null,
      rawPayload: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
