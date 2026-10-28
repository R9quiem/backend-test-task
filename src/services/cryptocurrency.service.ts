import type {
    CryptocurrencyRepository,
} from "../repositories/cryptocurrency.repository";
import {createError} from "../errors/create-error";
import {CoinMarketCapClient} from "../clients/coinmarket.client";

export function createCryptocurrencyService(
    repository: CryptocurrencyRepository,
    cmcClient: CoinMarketCapClient,
) {
    function checkNotTracked(coinmarketcapId: number): void {
        if (repository.findByCoinmarketcapId(coinmarketcapId)) {
            throw createError(
                "CRYPTOCURRENCY_ALREADY_EXISTS",
                "Криптовалюта уже отслеживается",
            );
        }
    }
    return {
        findAll() {
            return repository.findAll();
        },

        findById(id: number) {
            return repository.findById(id);
        },

        async create(coinmarketcapId: number) {
            checkNotTracked(coinmarketcapId);

            const prices = await cmcClient.getLatestPrices([coinmarketcapId]);

            const coin = prices.find(
                (price) => price.coinmarketcapId === coinmarketcapId,
            );

            if (!coin) {
                throw createError(
                    "CMC_INVALID_RESPONSE",
                    "CoinMarketCap не вернул данные запрошенной монеты",
                );
            }

            // Пока ожидали ответ от cmc, другой запрос мог создать эту монету.
            checkNotTracked(coinmarketcapId);

            return repository.create(
                coinmarketcapId,
                coin.symbol,
                coin.name,
            );
        },

        updateName(id: number, name: string) {
            return repository.updateName(id, name.trim());
        },

        remove(id: number) {
            return repository.remove(id);
        },
    };
}

export type CryptocurrencyService =
    ReturnType<typeof createCryptocurrencyService>;
