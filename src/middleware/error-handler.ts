import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    next,
) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    if (error instanceof Error) {
        if (
            "code" in error &&
            error.code === "CRYPTOCURRENCY_ALREADY_EXISTS"
        ) {
            res.status(409).json({
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
            return;
        }

        if ("code" in error && typeof error.code === "string") {
            const statuses = new Map([
                ["CMC_TIMEOUT", 504],
                ["CMC_UNAVAILABLE", 503],
                ["CMC_RATE_LIMIT", 503],
                ["CMC_ACCESS_DENIED", 502],
                ["CMC_REQUEST_FAILED", 502],
                ["CMC_INVALID_RESPONSE", 502],
            ]);

            const status = statuses.get(error.code);

            if (status !== undefined) {
                res.status(status).json({
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
                return;
            }
        }

        if ("type" in error) {
            switch (error.type) {
                case "entity.parse.failed":
                    res.status(400).json({
                        error: {
                            code: "INVALID_JSON",
                            message: "Некорректный JSON в теле запроса",
                        },
                    });
                    return;

                case "charset.unsupported":
                case "encoding.unsupported":
                    res.status(415).json({
                        error: {
                            code: "UNSUPPORTED_ENCODING",
                            message: "Кодировка тела запроса не поддерживается",
                        },
                    });
                    return;
            }
        }

    }

    console.error(error);

    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "Внутренняя ошибка сервера",
        },
    });
};