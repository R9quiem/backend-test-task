import type { Request, Response } from "express";
import type { PriceService } from "../services/price.service";

export function createPriceController(service: PriceService) {
    return {
        findLatest(req: Request, res: Response): void {
            const id = Number(req.params.id);
            const price = service.findLatest(id);

            res.status(200).json(price);
        },

        findHistory(req: Request, res: Response): void {
            const id = Number(req.params.id);
            const limit = Number(req.query.limit ?? 20);
            const offset = Number(req.query.offset ?? 0);

            const history = service.findHistory(id, limit, offset);

            res.status(200).json(history);
        },
    };
}

export type PriceController =
    ReturnType<typeof createPriceController>;