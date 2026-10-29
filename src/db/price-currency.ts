import type { DatabaseSync } from "node:sqlite";

export function checkCurrency(
    db: DatabaseSync,
    currency: string,
): void {
    const normalizedCurrency = currency.trim().toUpperCase();

    if (normalizedCurrency === "") {
        throw new Error("QUOTE_CURRENCY не должна быть пустой");
    }

    db.exec("BEGIN IMMEDIATE");

    try {
        const setting = db.prepare(`
      SELECT value
      FROM app_settings
      WHERE key = ?
    `).get("quote_currency") as { value: string } | undefined;

        if (setting) {
            if (setting.value !== normalizedCurrency) {
                throw new Error(
                    `База данных использует ${setting.value}, ` +
                    `а QUOTE_CURRENCY задана как ${normalizedCurrency}. ` +
                    "Для другой валюты используйте отдельную БД.",
                );
            }
        } else {
            const existingHistory = db.prepare(`
        SELECT 1
        FROM price_history
        LIMIT 1
      `).get();

            if (existingHistory) {
                throw new Error(
                    "В БД уже есть история без указания валюты. " +
                    "Перед запуском явно задайте валюту существующих данных " +
                    "в app_settings.",
                );
            }

            db.prepare(`
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
      `).run("quote_currency", normalizedCurrency);
        }

        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}