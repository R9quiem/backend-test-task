import { Router } from "express";
import type {
    CryptocurrencyController,
} from "../controllers/cryptocurrency.controller";

export function createCryptocurrencyRouter(
    controller: CryptocurrencyController,
) {
    const router = Router();

    router.get("/", controller.findAll);
    router.get("/:id", controller.findById);
    router.post("/", controller.create);
    router.patch("/:id", controller.updateName);
    router.delete("/:id", controller.remove);

    return router;
}
