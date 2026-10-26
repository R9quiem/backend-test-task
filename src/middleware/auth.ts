import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function requireApiKey(apiKey: string): RequestHandler {
    //Используем Buffer и timingSafeEqual для защиты секретов от атак по времени ответа,
    // т.к. timingSafeEqual сравнивает буферы одинаковой длины за постоянное время.
    const expectedToken = Buffer.from(apiKey);

    return (req, res, next) => {
        const authorization = req.get("Authorization");

        const parts = authorization?.split(" ");

        const isValidFormat =
            parts?.length === 2 &&
            parts[0].toLowerCase() === "bearer" &&
            parts[1] !== "";

        const receivedToken = isValidFormat
            ? Buffer.from(parts[1])
            : null;

        const isValid =
            receivedToken !== null &&
            receivedToken.length === expectedToken.length &&
            timingSafeEqual(receivedToken, expectedToken);

        if (!isValid) {
            res.setHeader("WWW-Authenticate", "Bearer");

            res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "Отсутствующий или неверный токен доступа",
                },
            });

            return;
        }

        next();
    };
}