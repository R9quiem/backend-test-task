import express from "express";
import { requireApiKey } from "./middleware/auth";
import {DatabaseSync} from "node:sqlite";
import {createCryptocurrencyRepository} from "./repositories/cryptocurrency.repository";
import {createCryptocurrencyService} from "./services/cryptocurrency.service";
import {createCryptocurrencyController} from "./controllers/cryptocurrency.controller";
import {createCryptocurrencyRouter} from "./routes/cryptocurrency.routes";
import {errorHandler} from "./middleware/error-handler";
import {CoinMarketCapClient} from "./clients/coinmarket.client";
import {createPriceRepository} from "./repositories/price.repository";
import {createPriceService} from "./services/price.service";
import {createPriceController} from "./controllers/price.controller";
import {createPriceRouter} from "./routes/price.routes";

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

    const priceRepository = createPriceRepository(db);

    const priceService = createPriceService(
        repository,
        priceRepository,
        cmcClient,
    );

    const priceController = createPriceController(priceService);
    const priceRouter = createPriceRouter(priceController);

    app.use("/cryptocurrencies", router);
    app.use("/cryptocurrencies", priceRouter);

    app.use(errorHandler);

    return app;
}