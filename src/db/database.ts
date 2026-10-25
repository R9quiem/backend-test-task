import {DatabaseSync} from "node:sqlite";
import {resolve, dirname} from "node:path"
import {mkdirSync} from "node:fs";
import {schema} from "./schema";

export function openDatabase(databasePath: string): DatabaseSync {
    if (databasePath.trim() === ""){
        throw new Error("Путь к базе данных (databasePath) не может быть пустым");
    }

    const absolutePath = resolve(databasePath);

    mkdirSync(dirname(absolutePath), {recursive: true});

    const db = new DatabaseSync(absolutePath);

    try {
        db.exec("PRAGMA foreign_keys = ON;");
        db.exec(schema);

        return db;
    } catch (error) {
        db.close();
        throw error;
    }
}