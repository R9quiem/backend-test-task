import { Router } from "express";
import type { PriceController } from "../controllers/price.controller";
import { validateId } from "../middleware/cryptocurrency.validator";
import { validateHistoryQuery } from "../middleware/price.validator";

export function createPriceRouter(controller: PriceController) {
    const router = Router();

    router.get(
        "/:id/price",
        validateId,
        controller.findLatest,
    );

    router.get(
        "/:id/history",
        validateId,
        validateHistoryQuery,
        controller.findHistory,
    );

    return router;
}