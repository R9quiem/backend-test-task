import axios from "axios";
import { createError } from "../errors/create-error";

export interface PriceQuote {
    coinmarketcapId: number;
    symbol: string;
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
            if (
                ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
            ) {
                throw new Error(
                    "Идентификаторы CoinMarketCap должны быть положительными целыми числами",
                );
            }

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
                if (!axios.isAxiosError(error)) {
                    throw error;
                }

                if (
                    error.code === "ECONNABORTED" ||
                    error.code === "ETIMEDOUT"
                ) {
                    throw createError(
                        "CMC_TIMEOUT",
                        "CoinMarketCap не ответил вовремя",
                    );
                }

                const status = error.response?.status;

                if (status === 401 || status === 403) {
                    throw createError(
                        "CMC_ACCESS_DENIED",
                        "Нет доступа к CoinMarketCap, либо неправильный ключ, либо тариф",
                    );
                }

                if (status === 429) {
                    throw createError(
                        "CMC_RATE_LIMIT",
                        "Превышен лимит запросов CoinMarketCap",
                    );
                }

                if (!error.response || (status !== undefined && status >= 500)) {
                    throw createError(
                        "CMC_UNAVAILABLE",
                        "CoinMarketCap временно недоступен",
                    );
                }

                throw createError(
                    "CMC_REQUEST_FAILED",
                    "CoinMarketCap отклонил запрос",
                );
            }

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

            return uniqueIds.map((id) => {
                const matches = records.filter(
                    (record) => isObject(record) && record.id === id,
                );

                const record = matches[0];

                if (
                    matches.length !== 1 ||
                    !isObject(record) ||
                    typeof record.symbol !== "string" ||
                    record.symbol.trim() === "" ||
                    !Array.isArray(record.quote)
                ) {
                    throw createError(
                        "CMC_INVALID_RESPONSE",
                        `Нету данных для монеты CoinMarketCap ${id}`,
                    );
                }

                const quotes: unknown[] = record.quote;

                const matchingQuotes = quotes.filter(
                    (quote) =>
                        isObject(quote) && quote.symbol === quoteCurrency,
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
                    symbol: record.symbol,
                    price: quote.price,
                    currency: quoteCurrency,
                    receivedAt,
                };
            });
        },
    };
}

export type CoinMarketCapClient =
    ReturnType<typeof createCoinMarketCapClient>;