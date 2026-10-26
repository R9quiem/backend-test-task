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