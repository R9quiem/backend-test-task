import express from "express";
import { requireApiKey } from "./auth";

export function createApp(apiKey: string | undefined) {
    if (!apiKey || apiKey.trim() === "") {

        throw new Error("apiKey не задан");
    }

    const app = express();

    app.use(requireApiKey(apiKey));
    app.use(express.json());

    return app;
}