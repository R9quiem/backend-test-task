export const schema = `
    CREATE TABLE IF NOT EXISTS cryptocurrencies (
        id INTEGER PRIMARY KEY,
        coinmarketcap_id INTEGER NOT NULL UNIQUE CHECK (coinmarketcap_id > 0),
        symbol TEXT NOT NULL CHECK (length(trim(symbol))>0),
        name TEXT NOT NULL CHECK (length(trim(name))>0),
        last_updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS price_history (
        cryptocurrency_id INTEGER NOT NULL,
        price REAL NOT NULL CHECK (price >=0),
        received_at TEXT NOT NULL,

        PRIMARY KEY (cryptocurrency_id, received_at),

        FOREIGN KEY (cryptocurrency_id)
            REFERENCES cryptocurrencies(id)
            ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`;