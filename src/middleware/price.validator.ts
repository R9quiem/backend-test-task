import type { RequestHandler } from "express";

function readQueryNumber(value: unknown): number | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string" || value.trim() === "") {
        return NaN;
    }

    return Number(value);
}

export const validateHistoryQuery: RequestHandler = (
    req,
    res,
    next,
) => {
    const limit = readQueryNumber(req.query.limit) ?? 20;
    const offset = readQueryNumber(req.query.offset) ?? 0;

    const hasUnknownFields = Object.keys(req.query).some(
        (key) => key !== "limit" && key !== "offset",
    );

    if (
        hasUnknownFields ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
    ) {
        res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message:
                    "Допустимы только limit от 1 до 100 и offset от 0, оба целые числа",
            },
        });
        return;
    }

    next();
};