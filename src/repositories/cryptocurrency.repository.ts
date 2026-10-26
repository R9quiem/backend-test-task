import type { DatabaseSync } from "node:sqlite";
import type { Cryptocurrency } from "../types/cryptocurrency";

export function createCryptocurrencyRepository(db: DatabaseSync) {
    const columns = `
    id,
    symbol,
    name,
    last_updated_at AS lastUpdatedAt
  `;

    const findAllStatement = db.prepare(`
    SELECT ${columns}
    FROM cryptocurrencies
    ORDER BY id
  `);

    const findByIdStatement = db.prepare(`
    SELECT ${columns}
    FROM cryptocurrencies
    WHERE id = ?
  `);

    const findBySymbolStatement = db.prepare(`
    SELECT ${columns}
    FROM cryptocurrencies
    WHERE symbol = ?
  `);

    const createStatement = db.prepare(`
    INSERT INTO cryptocurrencies (symbol, name)
    VALUES (?, ?)
    RETURNING ${columns}
  `);

    const updateStatement = db.prepare(`
    UPDATE cryptocurrencies
    SET name = ?
    WHERE id = ?
    RETURNING ${columns}
  `);

    const deleteStatement = db.prepare(`
    DELETE FROM cryptocurrencies
    WHERE id = ?
  `);

    return {
        findAll(): Cryptocurrency[] {
            return findAllStatement.all() as unknown as Cryptocurrency[];
        },

        findById(id: number): Cryptocurrency | undefined {
            return findByIdStatement.get(id) as
                | Cryptocurrency
                | undefined;
        },

        findBySymbol(symbol: string): Cryptocurrency | undefined {
            return findBySymbolStatement.get(symbol) as
                | Cryptocurrency
                | undefined;
        },

        create(symbol: string, name: string): Cryptocurrency {
            return createStatement.get(symbol, name) as
                unknown as Cryptocurrency;
        },

        updateName(
            id: number,
            name: string,
        ): Cryptocurrency | undefined {
            return updateStatement.get(name, id) as
                | Cryptocurrency
                | undefined;
        },

        remove(id: number): boolean {
            const result = deleteStatement.run(id);

            return result.changes > 0;
        },
    };
}

export type CryptocurrencyRepository =
    ReturnType<typeof createCryptocurrencyRepository>;
