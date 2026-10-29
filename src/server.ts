import {createApp} from "./app";
import { openDatabase } from "./db/database";
import {createCoinMarketCapClient} from "./clients/coinmarket.client";
import {createCryptocurrencyRepository} from "./repositories/cryptocurrency.repository";
import {createPriceRepository} from "./repositories/price.repository";
import {createPriceService} from "./services/price.service";
import {startPriceSync} from "./jobs/price-sync";

const apiKey = process.env.API_KEY;
const cmcApiKey = process.env.COINMARKETCAP_API_KEY;

if (!cmcApiKey || cmcApiKey.trim() === "") {
    throw new Error("COINMARKETCAP_API_KEY не задан");
}

const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 300000);

if (
    !Number.isSafeInteger(intervalMs) ||
    intervalMs <= 0 ||
    intervalMs > 2147483647
) {
    throw new Error("Некорректный SYNC_INTERVAL_MS");
}

const cmcClient = createCoinMarketCapClient(
    cmcApiKey,
    process.env.QUOTE_CURRENCY ?? "USD",
);

const db = openDatabase(
    process.env.DATABASE_PATH ?? "./data/app.sqlite"
);

const cryptocurrencyRepository = createCryptocurrencyRepository(db);
const priceRepository = createPriceRepository(db);

const priceService = createPriceService(
    cryptocurrencyRepository,
    priceRepository,
    cmcClient,
);

const app = createApp(apiKey, db, cmcClient);
const port = Number(process.env.PORT ?? 3000);

let shuttingDown = false;
let priceSync: ReturnType<typeof startPriceSync> | undefined;

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);

    if (!shuttingDown) {
        priceSync = startPriceSync(priceService, intervalMs);
    }
});

async function shutdown(): Promise<void> {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    const httpStopped = new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

    // Одновременно останавливаем фоновую задачу.
    await Promise.all([
        httpStopped,
        priceSync?.stop(),
    ]);

    db.close();

    console.log("Сервер остановлен, синхронизация завершена, соединение с бд закрыто");
}

function handleShutdown(): void {
    void shutdown().catch((error: unknown) => {
        console.error(
            "Ошибка остановки:",
            error instanceof Error ? error.message : "Неизвестная ошибка",
        );

        process.exitCode = 1;
    });
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);