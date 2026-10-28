import express from "express";
import { requireApiKey } from "./middleware/auth";
import {DatabaseSync} from "node:sqlite";
import {createCryptocurrencyRepository} from "./repositories/cryptocurrency.repository";
import {createCryptocurrencyService} from "./services/cryptocurrency.service";
import {createCryptocurrencyController} from "./controllers/cryptocurrency.controller";
import {createCryptocurrencyRouter} from "./routes/cryptocurrency.routes";
import {errorHandler} from "./middleware/error-handler";
import {CoinMarketCapClient} from "./clients/coinmarket.client";

export function createApp(
    apiKey: string | undefined,
    db: DatabaseSync,
    cmcClient: CoinMarketCapClient,
) {
    if (!apiKey || apiKey.trim() === "") {
        throw new Error("apiKey не задан");
    }

    const app = express();

    app.use(requireApiKey(apiKey));
    app.use(express.json());

    const repository = createCryptocurrencyRepository(db);
    const service = createCryptocurrencyService(
        repository,
        cmcClient,
    );
    const controller = createCryptocurrencyController(service);
    const router = createCryptocurrencyRouter(controller);

    app.use("/cryptocurrencies", router);
    app.use(errorHandler);

    return app;
}