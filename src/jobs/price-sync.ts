import type { PriceService } from "../services/price.service";

export function startPriceSync(
    service: Pick<PriceService, "syncPrices">,
    intervalMs: number,
) {
    if (
        !Number.isSafeInteger(intervalMs) ||
        intervalMs <= 0 ||
        intervalMs > 2147483647
    ) {
        throw new Error("Некорректный интервал синхронизации");
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run(): Promise<void> {
        try {
            const savedCount = await service.syncPrices();

            const time = new Date().toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
            });

            console.log(
                `[${time} МСК] Синхронизация цен: сохранено ${savedCount} измерений`,
            );
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Неизвестная ошибка";

            console.error(`Ошибка синхронизации цен: ${message}`);
        } finally {
            if (!stopped) {
                timer = setTimeout(() => {
                    timer = undefined;
                    currentRun = run();
                }, intervalMs);
            }
        }
    }

    // Первый запуск выполняем сразу.
    let currentRun = run();

    return {
        async stop(): Promise<void> {
            stopped = true;

            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }

            await currentRun;
        },
    };
}