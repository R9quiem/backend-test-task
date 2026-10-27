const request = require("supertest");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createApp } = require("../dist/app");
const { openDatabase } = require("../dist/db/database");

const apiKey = "test-api-key";

function createTestContext() {
  const directory = mkdtempSync(join(tmpdir(), "crypto-test-"));

  let db;

  try {
    db = openDatabase(join(directory, "test.sqlite"));
    const app = createApp(apiKey, db);

    return {
      app,
      db,

      cleanup() {
        try {
          if (db.isOpen) {
            db.close();
          }
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    try {
      if (db?.isOpen) {
        db.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }

    throw error;
  }
}

async function createCoin(app, data = {}) {
  const response = await request(app)
    .post("/cryptocurrencies")
    .set("Authorization", `Bearer ${apiKey}`)
    .send({
      coinmarketcapId: 1,
      symbol: "BTC",
      name: "Bitcoin",
      ...data,
    })
    .expect(201);

  return response.body;
}

module.exports = {
  apiKey,
  createTestContext,
  createCoin,
};