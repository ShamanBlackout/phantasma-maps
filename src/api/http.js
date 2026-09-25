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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs({ attempt, retryAfterMs, baseDelayMs, maxDelayMs }) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return retryAfterMs;
  }

  return Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
}

export async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs = 7000,
  retryOptions = {},
) {
  const {
    maxRetries = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    retryableStatuses = [408, 425, 429, 500, 502, 503, 504],
  } = retryOptions;

  let lastResult = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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

        const shouldRetry =
          attempt < maxRetries &&
          (retryableStatuses.includes(response.status) ||
            response.status === 0);

        if (shouldRetry) {
          await sleep(
            getRetryDelayMs({
              attempt,
              retryAfterMs,
              baseDelayMs,
              maxDelayMs,
            }),
          );
          continue;
        }

        lastResult = {
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
        return lastResult;
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
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        await sleep(
          getRetryDelayMs({
            attempt,
            retryAfterMs: null,
            baseDelayMs,
            maxDelayMs,
          }),
        );
        continue;
      }

      lastResult = {
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
      return lastResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return (
    lastResult || {
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
    }
  );
}
