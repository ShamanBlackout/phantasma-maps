# Backend Error Code Catalog

Use these codes in error.code for all non-2xx API responses.

## Validation and Input

- INVALID_REQUEST: Generic malformed request payload or query string.
- TOKEN_SYMBOL_INVALID: Token symbol format is invalid.
- TOKEN_NOT_FOUND: Requested token does not exist.
- ADDRESS_INVALID: Address format is invalid.
- PAGINATION_INVALID: Page, pageSize, or cursor is invalid.
- FILTER_RANGE_INVALID: min > max or invalid filter range.
- GRAPH_DEPTH_LIMIT_EXCEEDED: depth is outside allowed bounds.
- GRAPH_EDGE_LIMIT_EXCEEDED: edgeLimit is outside allowed bounds.

## Data and Availability

- METADATA_UNAVAILABLE: Token metadata source currently unavailable.
- GRAPH_UNAVAILABLE: Graph data source unavailable.
- TRANSACTIONS_UNAVAILABLE: Transactions source unavailable.
- CONNECTIONS_UNAVAILABLE: Address connections unavailable.
- SYNC_STATUS_UNAVAILABLE: Sync status unavailable.

## Upstream and Rate Limiting

- UPSTREAM_TIMEOUT: Dependency timed out.
- UPSTREAM_RATE_LIMITED: Dependency rate-limited backend.
- RATE_LIMITED: API rate-limited this client.

## Internal

- INTERNAL_ERROR: Unexpected server-side failure.
- DATABASE_ERROR: Database query or connection failure.
- SERIALIZATION_ERROR: Response serialization failure.

## Recommended HTTP Mapping

- 400: INVALID_REQUEST, TOKEN_SYMBOL_INVALID, ADDRESS_INVALID, PAGINATION_INVALID, FILTER_RANGE_INVALID, GRAPH_DEPTH_LIMIT_EXCEEDED, GRAPH_EDGE_LIMIT_EXCEEDED
- 404: TOKEN_NOT_FOUND
- 429: RATE_LIMITED, UPSTREAM_RATE_LIMITED
- 503: METADATA_UNAVAILABLE, GRAPH_UNAVAILABLE, TRANSACTIONS_UNAVAILABLE, CONNECTIONS_UNAVAILABLE, SYNC_STATUS_UNAVAILABLE
- 504: UPSTREAM_TIMEOUT
- 500: INTERNAL_ERROR, DATABASE_ERROR, SERIALIZATION_ERROR

## Error Response Shape

{
"requestId": "uuid",
"retryAfterMs": null,
"error": {
"code": "RATE_LIMITED",
"message": "Too many requests",
"details": {
"limit": 100,
"windowSeconds": 60
}
}
}
