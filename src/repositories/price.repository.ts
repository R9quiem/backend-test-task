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
    };
}

export type PriceRepository =
    ReturnType<typeof createPriceRepository>;