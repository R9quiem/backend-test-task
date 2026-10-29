import type { DatabaseSync } from "node:sqlite";

export interface PriceRecord {
    cryptocurrencyId: number;
    price: number;
    receivedAt: string;
}

export function createPriceRepository(db: DatabaseSync) {
    const insertStatement = db.prepare(`
        INSERT INTO price_history (
          cryptocurrency_id,
          price,
          received_at
        )
        VALUES (?, ?, ?)
      `);

    const updateStatement = db.prepare(`
        UPDATE cryptocurrencies
        SET last_updated_at = ?
        WHERE id = ?
      `);

    const findLatestPriceStatement = db.prepare(`
      SELECT
        cryptocurrency_id AS cryptocurrencyId,
        price,
        received_at AS receivedAt
      FROM price_history
      WHERE cryptocurrency_id = ?
      ORDER BY received_at DESC
      LIMIT 1
    `);

    const findPriceHistoryStatement = db.prepare(`
      SELECT
        cryptocurrency_id AS cryptocurrencyId,
        price,
        received_at AS receivedAt
      FROM price_history
      WHERE cryptocurrency_id = ?
      ORDER BY received_at DESC
      LIMIT ? OFFSET ?
    `);

    return {
        saveMany(records: PriceRecord[]): number {
            if (records.length === 0) {
                return 0;
            }

            db.exec("BEGIN IMMEDIATE");

            try {
                let savedCount = 0;

                for (const record of records) {
                    const result = updateStatement.run(
                        record.receivedAt,
                        record.cryptocurrencyId,
                    );

                    // монета могла быть удалена во время запроса к  cmc.
                    if (result.changes === 0) {
                        continue;
                    }

                    insertStatement.run(
                        record.cryptocurrencyId,
                        record.price,
                        record.receivedAt,
                    );

                    savedCount++;
                }

                db.exec("COMMIT");

                return savedCount;
            } catch (error) {
                db.exec("ROLLBACK");
                throw error;
            }
        },
        findLatest(cryptocurrencyId: number): PriceRecord | undefined {
            return findLatestPriceStatement.get(cryptocurrencyId) as
                | PriceRecord
                | undefined;
        },

        findHistory(
            cryptocurrencyId: number,
            limit: number,
            offset: number,
        ): PriceRecord[] {
            return findPriceHistoryStatement.all(
                cryptocurrencyId,
                limit,
                offset,
            ) as unknown as PriceRecord[];
        },

    };
}

export type PriceRepository =
    ReturnType<typeof createPriceRepository>;