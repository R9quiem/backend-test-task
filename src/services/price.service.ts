import type {
    CryptocurrencyRepository,
} from "../repositories/cryptocurrency.repository";
import type {
    PriceRepository,
    PriceRecord,
} from "../repositories/price.repository";
import type {
    CoinMarketCapClient,
} from "../clients/coinmarket.client";
import { createError } from "../errors/create-error";

export function createPriceService(
    cryptocurrencyRepository: CryptocurrencyRepository,
    priceRepository: PriceRepository,
    cmcClient: CoinMarketCapClient,
) {
    return {
        async syncPrices(): Promise<number> {
            const cryptocurrencies = cryptocurrencyRepository.findAll();

            if (cryptocurrencies.length === 0) {
                return 0;
            }

            const cmcIds = cryptocurrencies.map(
                (coin) => coin.coinmarketcapId,
            );

            const prices = await cmcClient.getLatestPrices(cmcIds);

            const pricesByCmcId = new Map(
                prices.map((price) => [price.coinmarketcapId, price]),
            );

            const records: PriceRecord[] = [];

            for (const coin of cryptocurrencies) {
                // Проверяем запись повторно после ожидания CMC.
                const current = cryptocurrencyRepository.findById(coin.id);

                if (
                    !current ||
                    current.coinmarketcapId !== coin.coinmarketcapId
                ) {
                    continue;
                }

                const price = pricesByCmcId.get(coin.coinmarketcapId);

                if (!price) {
                    throw createError(
                        "CMC_INVALID_RESPONSE",
                        `Нет цены для монеты CoinMarketCap ${coin.coinmarketcapId}`,
                    );
                }

                records.push({
                    cryptocurrencyId: current.id,
                    price: price.price,
                    receivedAt: price.receivedAt,
                });
            }

            return priceRepository.saveMany(records);
        },
        findLatest(cryptocurrencyId: number) {
            const coin = cryptocurrencyRepository.findById(cryptocurrencyId);

            if (!coin) {
                throw createError(
                    "CRYPTOCURRENCY_NOT_FOUND",
                    "Криптовалюта не найдена",
                );
            }

            const price = priceRepository.findLatest(cryptocurrencyId);

            if (!price) {
                throw createError(
                    "PRICE_NOT_AVAILABLE",
                    "Цена криптовалюты ещё не получена",
                );
            }

            return price;
        },

        findHistory(
            cryptocurrencyId: number,
            limit: number,
            offset: number,
        ) {
            const coin = cryptocurrencyRepository.findById(cryptocurrencyId);

            if (!coin) {
                throw createError(
                    "CRYPTOCURRENCY_NOT_FOUND",
                    "Криптовалюта не найдена",
                );
            }

            return priceRepository.findHistory(
                cryptocurrencyId,
                limit,
                offset,
            );
        },
    };
}

export type PriceService =
    ReturnType<typeof createPriceService>;