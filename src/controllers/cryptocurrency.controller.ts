import type { Request, Response } from "express";
import type {
    CryptocurrencyService,
} from "../services/cryptocurrency.service";

export function createCryptocurrencyController(
    service: CryptocurrencyService,
) {
    return {
        findAll(_req: Request, res: Response): void {
            res.status(200).json(service.findAll());
        },

        findById(req: Request, res: Response): void {
            const id = Number(req.params.id);
            const cryptocurrency = service.findById(id);

            if (!cryptocurrency) {
                res.status(404).json({
                    message: "Криптовалюта не найдена",
                });
                return;
            }

            res.status(200).json(cryptocurrency);
        },

        create(req: Request, res: Response): void {
            const { symbol, name } = req.body;
            const cryptocurrency = service.create(symbol, name);

            res.status(201).json(cryptocurrency);
        },

        updateName(req: Request, res: Response): void {
            const id = Number(req.params.id);
            const { name } = req.body;

            const cryptocurrency = service.updateName(id, name);

            if (!cryptocurrency) {
                res.status(404).json({
                    message: "Криптовалюта не найдена",
                });
                return;
            }

            res.status(200).json(cryptocurrency);
        },

        remove(req: Request, res: Response): void {
            const id = Number(req.params.id);
            const removed = service.remove(id);

            if (!removed) {
                res.status(404).json({
                    message: "Криптовалюта не найдена",
                });
                return;
            }

            res.status(204).end();
        },
    };
}

export type CryptocurrencyController =
    ReturnType<typeof createCryptocurrencyController>;