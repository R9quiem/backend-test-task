import type {
    CryptocurrencyRepository,
} from "../repositories/cryptocurrency.repository";

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

        create(symbol: string, name: string) {
            return repository.create(
                symbol.trim().toUpperCase(),
                name.trim(),
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
