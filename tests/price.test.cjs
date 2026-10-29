const request = require("supertest");
const { apiKey, createTestContext } = require("./helpers");

const {
  createCryptocurrencyRepository,
} = require("../dist/repositories/cryptocurrency.repository");

const {
  createPriceRepository,
} = require("../dist/repositories/price.repository");

let context;
let cryptocurrencyRepository;
let priceRepository;
let bitcoin;
let ethereum;

beforeEach(() => {
  context = undefined;
  context = createTestContext();

  cryptocurrencyRepository = createCryptocurrencyRepository(context.db);
  priceRepository = createPriceRepository(context.db);

  // Подготовка данных без обращения к CMC.
  bitcoin = cryptocurrencyRepository.create(1, "BTC", "Bitcoin");
  ethereum = cryptocurrencyRepository.create(1027, "ETH", "Ethereum");
});

afterEach(() => {
  context?.cleanup();
});

function get(path) {
  return request(context.app)
    .get(path)
    .set("Authorization", `Bearer ${apiKey}`);
}

function makeHistory(cryptocurrencyId, count) {
  return Array.from({ length: count }, (_, index) => ({
    cryptocurrencyId,
    price: 100 + index,
    receivedAt: new Date(
      Date.UTC(2026, 9, 29, 12, index),
    ).toISOString(),
  }));
}

describe("GET /cryptocurrencies/:id/price", () => {
  test("возвращает последнее измерение только выбранной монеты", async () => {
    const records = makeHistory(bitcoin.id, 3);
    const otherRecords = makeHistory(ethereum.id, 5);

    // Последнее по времени измерение вставляем не последним.
    priceRepository.saveMany([
      records[1],
      records[2],
      records[0],
      ...otherRecords,
    ]);

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/price`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(records[2]);
  });

  test("возвращает PRICE_NOT_AVAILABLE при отсутствии измерений", async () => {
    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/price`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRICE_NOT_AVAILABLE");
  });
});

describe("GET /cryptocurrencies/:id/history", () => {
  test("возвращает только историю выбранной монеты от новых к старым", async () => {
    const records = makeHistory(bitcoin.id, 3);

    priceRepository.saveMany([
      records[1],
      records[2],
      records[0],
      ...makeHistory(ethereum.id, 5),
    ]);

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      records[2],
      records[1],
      records[0],
    ]);
  });

  test("возвращает пустой массив, если измерений нет", async () => {
    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("по умолчанию возвращает первые 20 измерений", async () => {
    const records = makeHistory(bitcoin.id, 25);
    priceRepository.saveMany(records);

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history`,
    );

    const expected = [...records].reverse().slice(0, 20);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
  });

  test("применяет limit и offset к отсортированной истории", async () => {
    const records = makeHistory(bitcoin.id, 5);
    priceRepository.saveMany(records);

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history?limit=2&offset=1`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      records[3],
      records[2],
    ]);
  });

  test.each([1, 100])(
    "принимает допустимый limit=%s и offset=0",
    async (limit) => {
      const records = makeHistory(bitcoin.id, 105);
      priceRepository.saveMany(records);

      const response = await get(
        `/cryptocurrencies/${bitcoin.id}/history?limit=${limit}&offset=0`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        [...records].reverse().slice(0, limit),
      );
    },
  );

  test("использует limit по умолчанию при передаче только offset", async () => {
    const records = makeHistory(bitcoin.id, 25);
    priceRepository.saveMany(records);

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history?offset=2`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      [...records].reverse().slice(2, 22),
    );
  });

  test("возвращает пустой массив при смещении за конец истории", async () => {
    priceRepository.saveMany(makeHistory(bitcoin.id, 3));

    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history?offset=100`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test.each([
    "limit=0",
    "limit=101",
    "limit=-1",
    "limit=1.5",
    "limit=abc",
    "limit=",
    "offset=-1",
    "offset=1.5",
    "offset=abc",
    "offset=",
    "limit=9007199254740992",
    "offset=9007199254740992",
    "limit=1&limit=2",
    "offset=0&offset=1",
    "extra=1",
  ])("отклоняет некорректные параметры: %s", async (query) => {
    const response = await get(
      `/cryptocurrencies/${bitcoin.id}/history?${query}`,
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe.each(["price", "history"])(
  "Общие ошибки GET /cryptocurrencies/:id/%s",
  (endpoint) => {
    test("возвращает 404 для отсутствующей монеты", async () => {
      const response = await get(
        `/cryptocurrencies/999/${endpoint}`,
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(
        "CRYPTOCURRENCY_NOT_FOUND",
      );
    });

    test.each([
      "abc",
      "0",
      "-1",
      "1.5",
      "9007199254740992",
    ])("отклоняет некорректный id: %s", async (id) => {
      const response = await get(
        `/cryptocurrencies/${id}/${endpoint}`,
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  },
);

describe("Чтение цен не изменяет данные", () => {
  test("оба эндпоинта не вызывают CMC и не изменяют БД", async () => {
    priceRepository.saveMany(makeHistory(bitcoin.id, 3));

    const readAllHistory = () => context.db.prepare(`
      SELECT cryptocurrency_id, price, received_at
      FROM price_history
      ORDER BY cryptocurrency_id, received_at
    `).all();

    const historyBefore = readAllHistory();
    const coinsBefore = cryptocurrencyRepository.findAll();

    await get(`/cryptocurrencies/${bitcoin.id}/price`)
      .expect(200);

    await get(`/cryptocurrencies/${bitcoin.id}/history`)
      .expect(200);

    expect(context.cmcClient.getLatestPrices)
      .not.toHaveBeenCalled();

    expect(readAllHistory()).toEqual(historyBefore);
    expect(cryptocurrencyRepository.findAll()).toEqual(coinsBefore);
  });
});