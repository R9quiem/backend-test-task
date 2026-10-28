import type { RequestHandler } from "express";

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
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

function hasOnlyFields(
    body: Record<string, unknown>,
    allowedFields: string[],
): boolean {
    return Object.keys(body).every((key) =>
        allowedFields.includes(key),
    );
}

export const validateId: RequestHandler = (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Некорректный id",
            },
        });
        return;
    }

    next();
};

export const validateCreate: RequestHandler = (req, res, next) => {
    const body: unknown = req.body;

    if (
        !isObject(body) ||
        typeof body.coinmarketcapId !== "number" ||
        !Number.isSafeInteger(body.coinmarketcapId) ||
        body.coinmarketcapId <= 0 ||
        !hasOnlyFields(body, ["coinmarketcapId"])
    ) {
        res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message:
                    "Нужно передать только положительный целочисленный coinmarketcapId",
            },
        });
        return;
    }

    next();
};

export const validateUpdate: RequestHandler = (req, res, next) => {
    const body: unknown = req.body;

    if (
        !isObject(body) ||
        !isNonEmptyString(body.name) ||
        !hasOnlyFields(body, ["name"])
    ) {
        res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Нужно передать только непустую строку name",
            },
        });
        return;
    }

    next();
};