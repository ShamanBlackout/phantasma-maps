# Backend API Migration Checklist

This checklist rolls out hardening without breaking the current frontend.

## Phase 1: Contract Foundation

- Add requestId to every response body.
- Add requestId response header.
- Wrap all success responses in envelope: data, meta, requestId.
- Wrap all errors in envelope: error.code, error.message, details, retryAfterMs, requestId.
- Keep existing fields inside data unchanged.

## Phase 2: Validation and Limits

- Centralize validation for token, address, depth, edgeLimit, pageSize.
- Enforce range clamps and return explicit error.code on violations.
- Add meta.appliedLimits and meta.isPartial for graph and transactions endpoints.
- Return truncationReason when data is partial.

## Phase 3: Rate Limiting and Retry

- Standardize 429 behavior with error.code = RATE_LIMITED.
- Emit Retry-After and rate-limit headers:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset
- Ensure retryAfterMs is included in error envelope when known.

## Phase 4: Caching and Performance

- Add ETag support on GET /tokens and GET /tokens/:tokenSymbol/metadata.
- Respect If-None-Match with 304 responses.
- Add short TTL caching for read-heavy graph queries where safe.
- Track cache hit ratio per route.

## Phase 5: Pagination Upgrade

- Keep page/pageSize support for compatibility.
- Add optional cursor mode to GET /transactions.
- Return meta.pagination.nextCursor and hasMore in cursor mode.

## Phase 6: Observability

- Add structured logs with:
  - requestId
  - route
  - status
  - latencyMs
  - token and address context
  - cacheHit
- Track p50 and p95 latency by route.
- Track error rate by error.code.

## Frontend Compatibility Gates

- Existing frontend calls continue to work with legacy query params.
- Existing frontend can still parse current data fields unchanged.
- New envelope fields are additive and do not remove old data fields.
- For the graph endpoint, support withTopHolders query boolean.

## Release Plan

- Release A: Add requestId and error.code only.
- Release B: Add success envelope and meta fields.
- Release C: Add rate-limit headers and retryAfterMs.
- Release D: Add ETag and cursor pagination.
- Release E: Deprecate legacy behaviors after frontend confirms adoption.

## Definition of Done

- OpenAPI document published and versioned.
- Error catalog implemented in API middleware.
- Contract tests for tokens, metadata, graph, transactions, sync-status, connections.
- Dashboard alerts configured for 5xx spikes and latency regressions.
