import type {
    CryptocurrencyRepository,
} from "../repositories/cryptocurrency.repository";
import {createError} from "../errors/create-error";

export function createCryptocurrencyService(
    repository: CryptocurrencyRepository,
) {
    return {
        findAll() {
            return repository.findAll();
        },

        findById(id: number) {
            return repository.findById(id);
        },

        create(
            coinmarketcapId: number,
            symbol: string,
            name: string,
        ) {
            const normalizedSymbol = symbol.trim().toUpperCase();
            const normalizedName = name.trim();

            if (repository.findByCoinmarketcapId(coinmarketcapId)) {
                throw createError(
                    "CRYPTOCURRENCY_ALREADY_EXISTS",
                    "Криптовалюта уже отслеживается",
                );
            }

            return repository.create(
                coinmarketcapId,
                normalizedSymbol,
                normalizedName,
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
