import axios from "axios";
import { createError } from "../errors/create-error";

export interface PriceQuote {
    coinmarketcapId: number;
    symbol: string;
    name: string;
    price: number;
    currency: string;
    receivedAt: string;
}

function isObject(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function validateIds(ids: number[]): void {
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error(
            "Идентификаторы CoinMarketCap должны быть положительными целыми числами",
        );
    }
}

export function mapCoinMarketCapError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error
            ? error
            : new Error("Неизвестная ошибка клиента CoinMarketCap");
    }

    if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
    ) {
        return createError(
            "CMC_TIMEOUT",
            "CoinMarketCap не ответил вовремя",
        );
    }

    if (!error.response) {
        return createError(
            "CMC_UNAVAILABLE",
            "Не удалось подключиться к CoinMarketCap",
        );
    }

    const status = error.response.status;

    if (status === 401 || status === 403) {
        return createError(
            "CMC_ACCESS_DENIED",
            "Нет доступа к CoinMarketCap: проверьте ключ и тариф",
        );
    }

    if (status === 429) {
        return createError(
            "CMC_RATE_LIMIT",
            "Превышен лимит запросов CoinMarketCap",
        );
    }

    if (status >= 500) {
        return createError(
            "CMC_UNAVAILABLE",
            "CoinMarketCap временно недоступен",
        );
    }

    return createError(
        "CMC_REQUEST_FAILED",
        "CoinMarketCap отклонил запрос",
    );
}

function parseLatestPrices(
    body: unknown,
    ids: number[],
    currency: string,
): PriceQuote[] {
    if (
        !isObject(body) ||
        !isObject(body.status) ||
        !Array.isArray(body.data)
    ) {
        throw createError(
            "CMC_INVALID_RESPONSE",
            "CoinMarketCap вернул некорректный ответ",
        );
    }

    if (
        body.status.error_code !== 0 &&
        body.status.error_code !== "0"
    ) {
        throw createError(
            "CMC_REQUEST_FAILED",
            "CoinMarketCap сообщил об ошибке",
        );
    }

    const records: unknown[] = body.data;
    const receivedAt = new Date().toISOString();

    return ids.map((id) => {
        const matches = records.filter(
            (record) => isObject(record) && record.id === id,
        );

        const record = matches[0];

        if (
            matches.length !== 1 ||
            !isObject(record) ||
            typeof record.symbol !== "string" ||
            record.symbol.trim() === "" ||
            typeof record.name !== "string" ||
            record.name.trim() === "" ||
            !Array.isArray(record.quote)
        ) {
            throw createError(
                "CMC_INVALID_RESPONSE",
                `Нет однозначных данных для монеты CoinMarketCap ${id}`,
            );
        }

        const quotes: unknown[] = record.quote;

        const matchingQuotes = quotes.filter(
            (quote) => isObject(quote) && quote.symbol === currency,
        );

        const quote = matchingQuotes[0];

        if (
            matchingQuotes.length !== 1 ||
            !isObject(quote) ||
            typeof quote.price !== "number" ||
            !Number.isFinite(quote.price) ||
            quote.price < 0
        ) {
            throw createError(
                "CMC_INVALID_RESPONSE",
                `Некорректная цена для монеты CoinMarketCap ${id}`,
            );
        }

        return {
            coinmarketcapId: id,
            name: record.name,
            symbol: record.symbol,
            price: quote.price,
            currency,
            receivedAt,
        };
    });
}

export function createCoinMarketCapClient(
    apiKey: string,
    currency = "USD",
    timeoutMs = 5000,
) {
    if (apiKey.trim() === "") {
        throw new Error("Ключ CoinMarketCap не задан");
    }

    const quoteCurrency = currency.trim().toUpperCase();

    if (quoteCurrency === "") {
        throw new Error("Валюта котировок не задана");
    }

    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error("Таймаут должен быть положительным целым числом");
    }

    const http = axios.create({
        baseURL: "https://pro-api.coinmarketcap.com",
        timeout: timeoutMs,
        maxRedirects: 0,
        headers: {
            "X-CMC_PRO_API_KEY": apiKey,
            Accept: "application/json",
        },
    });

    return {
        async getLatestPrices(ids: number[]): Promise<PriceQuote[]> {

            validateIds(ids);

            const uniqueIds = [...new Set(ids)];

            if (uniqueIds.length === 0) {
                return [];
            }

            let body: unknown;

            try {
                const response = await http.get<unknown>(
                    "/v3/cryptocurrency/quotes/latest",
                    {
                        params: {
                            id: uniqueIds.join(","),
                            convert: quoteCurrency,
                        },
                    },
                );

                body = response.data;
            } catch (error) {
                throw mapCoinMarketCapError(error);
            }

            return parseLatestPrices(body, uniqueIds, quoteCurrency);
        },
    };
}

export type CoinMarketCapClient =
    ReturnType<typeof createCoinMarketCapClient>;