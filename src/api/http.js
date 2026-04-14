export function parseRetryAfterMs(response) {
  const rawValue = response.headers.get("retry-after");
  if (!rawValue) return null;
  const asSeconds = Number(rawValue);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return asSeconds * 1000;
  }
  return null;
}

export async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs = 7000,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response),
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      status: response.status,
      payload,
      retryAfterMs: parseRetryAfterMs(response),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      retryAfterMs: null,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
