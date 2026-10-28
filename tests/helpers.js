const request = require("supertest");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createApp } = require("../dist/app");
const { openDatabase } = require("../dist/db/database");

const apiKey = "test-api-key";

const cmcCoins = [
  {
    coinmarketcapId: 1,
    symbol: "BTC",
    name: "Bitcoin",
  },
  {
    coinmarketcapId: 1027,
    symbol: "ETH",
    name: "Ethereum",
  },
  {
    coinmarketcapId: 38650,
    symbol: "BTC",
    name: "Bitcoin Inu (tokeninu.xyz)",
  },
];

function createMockCmcClient() {
  return {
    getLatestPrices: jest.fn(async (ids) => {
      return ids.map((id) => {
        const coin = cmcCoins.find(
          (item) => item.coinmarketcapId === id,
        );

        if (!coin) {
          throw Object.assign(
            new Error("Нет данных запрошенной монеты"),
            { code: "CMC_INVALID_RESPONSE" },
          );
        }

        return {
          ...coin,
          price: 100,
          currency: "USD",
          receivedAt: "2026-10-27T12:00:00.000Z",
        };
      });
    }),
  };
}


function createTestContext() {
  const directory = mkdtempSync(join(tmpdir(), "crypto-test-"));

  let db;

  try {
    db = openDatabase(join(directory, "test.sqlite"));
    const cmcClient = createMockCmcClient();
    const app = createApp(apiKey, db, cmcClient);

    return {
      app,
      db,
      cmcClient,

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