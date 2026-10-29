import {DatabaseSync} from "node:sqlite";
import {resolve, dirname} from "node:path"
import {mkdirSync} from "node:fs";
import {schema} from "./schema";
import {checkCurrency} from "./price-currency";

export function openDatabase(
    databasePath: string,
    currency = "USD",
): DatabaseSync {
    if (databasePath.trim() === ""){
        throw new Error("Путь к базе данных (databasePath) не задан");
    }

    const absolutePath = resolve(databasePath);

    mkdirSync(dirname(absolutePath), {recursive: true});

    const db = new DatabaseSync(absolutePath);

    try {
        db.exec("PRAGMA foreign_keys = ON;");
        db.exec(schema);

        checkCurrency(db, currency);

        return db;
    } catch (error) {
        db.close();
        throw error;
    }
}