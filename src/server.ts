import {createApp} from "./app";
import { openDatabase } from "./db/database";

const apiKey = process.env.API_KEY;

const db = openDatabase(
    process.env.DATABASE_PATH ?? "./data/app.sqlite"
);

const app = createApp(apiKey);

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

let shuttingDown = false;

function shutdown(): void {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    server.close(() => {
        db.close();
        console.log("Server stopped, database closed");
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);