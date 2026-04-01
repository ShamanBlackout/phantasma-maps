CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    tx_hash TEXT UNIQUE NOT NULL,
    token_symbol TEXT NOT NULL,
    block_height BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,

    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount NUMERIC,

    metadata JSONB
);
