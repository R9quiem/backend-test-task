const request = require("supertest");
const {
  apiKey,
  createTestContext,
  createCoin,
} = require("./helpers");

let context;
let app;

beforeEach(() => {
  context = undefined;
  context = createTestContext();

  app = context.app;
});

afterEach(() => {
  context?.cleanup();
});

describe("POST /cryptocurrencies", () => {

  const validBody = {
    coinmarketcapId: 1,
    symbol: "BTC",
    name: "Bitcoin",
  };

  test("создаёт монету и нормализует данные", async () => {
    const coin = await createCoin(app, {
      symbol: " btc ",
      name: " Bitcoin ",
    });

    expect(coin).toEqual({
      id: expect.any(Number),
      coinmarketcapId: 1,
      symbol: "BTC",
      name: "Bitcoin",
      lastUpdatedAt: null,
    });

    const saved = await request(app)
      .get(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(coin);
  });

  test.each([
    {
      label: "нет coinmarketcapId",
      body: { symbol: "BTC", name: "Bitcoin" },
    },
    {
      label: "coinmarketcapId - строка",
      body: { ...validBody, coinmarketcapId: "1" },
    },
    {
      label: "coinmarketcapId - null",
      body: { ...validBody, coinmarketcapId: null },
    },
    {
      label: "coinmarketcapId - ноль",
      body: { ...validBody, coinmarketcapId: 0 },
    },
    {
      label: "coinmarketcapId - отрицательный",
      body: { ...validBody, coinmarketcapId: -1 },
    },
    {
      label: "coinmarketcapId - дробный",
      body: { ...validBody, coinmarketcapId: 1.5 },
    },
    {
      label: "coinmarketcapId вне безопасного диапазона",
      body: {
        ...validBody,
        coinmarketcapId: Number.MAX_SAFE_INTEGER + 1,
      },
    },
    {
      label: "пустой символ",
      body: { ...validBody, symbol: " " },
    },
    {
      label: "нет символа",
      body: { coinmarketcapId: 1, name: "Bitcoin" },
    },
    {
      label: "нет названия",
      body: { coinmarketcapId: 1, symbol: "BTC" },
    },
    {
      label: "пустое название",
      body: { ...validBody, name: " " },
    },
    {
      label: "символ - число",
      body: { ...validBody, symbol: 123 },
    },
    {
      label: "название - null",
      body: { ...validBody, name: null },
    },
    {
      label: "лишнее поле",
      body: { ...validBody, extra: true },
    },
    {
      label: "массив вместо объекта",
      body: [],
    },
  ])("отклоняет запрос: $label", async ({ body }) => {
    const response = await request(app)
      .post("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const list = await request(app)
      .get("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  test("не допускает повторный coinmarketcapId", async () => {
    await createCoin(app);

    const response = await request(app)
      .post("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        coinmarketcapId: 1,
        symbol: "btc",
        name: "Bitcoin",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(
      "CRYPTOCURRENCY_ALREADY_EXISTS",
    );

    const list = await request(app)
      .get("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(list.body).toHaveLength(1);
  });

  test("отклоняет сломанный JSON", async () => {
    const response = await request(app)
      .post("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Content-Type", "application/json")
      .send('{"symbol":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  test("допускает одинаковый символ при разных ID CoinMarketCap", async () => {
    const bitcoin = await createCoin(app);

    const other = await createCoin(app, {
      coinmarketcapId: 38650,
      symbol: "BTC",
      name: "Bitcoin Inu (tokeninu.xyz)",
    });

    expect(other.id).not.toBe(bitcoin.id);
    expect(other.symbol).toBe(bitcoin.symbol);
    expect(other.coinmarketcapId).not.toBe(bitcoin.coinmarketcapId);

    const list = await request(app)
      .get("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(list.status).toBe(200);
    expect(list.body).toEqual([bitcoin, other]);
  });
});

describe("GET /cryptocurrencies", () => {
  test("возвращает пустой список если бд пустая", async () => {
    const response = await request(app)
      .get("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("возвращает список успешно добавленных отслеживаемых криптовалют", async () => {
    const bitcoin = await createCoin(app);
    const ethereum = await createCoin(app, {
      coinmarketcapId: 1027,
      symbol: "ETH",
      name: "Ethereum",
    });

    const response = await request(app)
      .get("/cryptocurrencies")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([bitcoin, ethereum]);
  });
});

describe("GET /cryptocurrencies/:id", () => {
  test("возвращает существующую монету", async () => {
    const coin = await createCoin(app);

    const response = await request(app)
      .get(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(coin);
  });

  test("возвращает 404 для отсутствующей монеты", async () => {
    const response = await request(app)
      .get("/cryptocurrencies/999")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(404);
  });

  test.each(["abc", "0", "-1", "1.5"])(
    "отклоняет некорректный id: %s",
    async (id) => {
      const response = await request(app)
        .get(`/cryptocurrencies/${id}`)
        .set("Authorization", `Bearer ${apiKey}`);

      expect(response.status).toBe(400);
    },
  );
});

describe("PATCH /cryptocurrencies/:id", () => {
  test("изменяет название и сохраняет остальные поля", async () => {
    const coin = await createCoin(app);

    const response = await request(app)
      .patch(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: " Bitcoin updated " });

    const expected = { ...coin, name: "Bitcoin updated" };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);

    const saved = await request(app)
      .get(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(expected);
  });

  test.each([
    { label: "пустое название", body: { name: " " } },
    { label: "число вместо строки", body: { name: 123 } },
    { label: "нет названия", body: {} },
    {
      label: "изменение символа",
      body: { name: "Ethereum", symbol: "ETH" },
    },
    {
      label: "лишнее поле",
      body: { name: "Bitcoin", extra: true },
    },
    {
      label: "изменение coinmarketcapId",
      body: { name: "Bitcoin", coinmarketcapId: 1027 },
    },
  ])("отклоняет запрос: $label без изменения записи", async ({ body }) => {
    const coin = await createCoin(app);

    const response = await request(app)
      .patch(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send(body);

    expect(response.status).toBe(400);

    const saved = await request(app)
      .get(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(coin);
  });

  test("возвращает 404 для отсутствующей монеты", async () => {
    const response = await request(app)
      .patch("/cryptocurrencies/999")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Bitcoin" });

    expect(response.status).toBe(404);
  });

  test("отклоняет некорректный id", async () => {
    const response = await request(app)
      .patch("/cryptocurrencies/abc")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Bitcoin" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /cryptocurrencies/:id", () => {
  test("удаляет монету и возвращает пустой ответ", async () => {
    const coin = await createCoin(app);

    const response = await request(app)
      .delete(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    const saved = await request(app)
      .get(`/cryptocurrencies/${coin.id}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(saved.status).toBe(404);
  });

  test("возвращает 404 для отсутствующей монеты", async () => {
    const response = await request(app)
      .delete("/cryptocurrencies/999")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(404);
  });

  test("отклоняет некорректный id", async () => {
    const response = await request(app)
      .delete("/cryptocurrencies/abc")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(response.status).toBe(400);
  });
});
