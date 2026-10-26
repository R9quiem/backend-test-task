import { Router } from "express";
import type {
    CryptocurrencyController,
} from "../controllers/cryptocurrency.controller";
import {validateCreate, validateId, validateUpdate} from "../middleware/cryptocurrency.validator";

export function createCryptocurrencyRouter(
    controller: CryptocurrencyController,
) {
    const router = Router();

    router.get(
        "/",
        controller.findAll
    );
    router.get(
        "/:id",
        validateId,
        controller.findById
    );
    router.post(
        "/",
        validateCreate,
        controller.create
    );
    router.patch(
        "/:id",
        validateId,
        validateUpdate,
        controller.updateName
    );
    router.delete(
        "/:id",
        validateId,
        controller.remove
    );

    return router;
}
