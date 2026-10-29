const { createTestContext } = require("./helpers");

const {
  createCryptocurrencyRepository,
} = require("../dist/repositories/cryptocurrency.repository");

const {
  createPriceRepository,
} = require("../dist/repositories/price.repository");

const {
  createPriceService,
} = require("../dist/services/price.service");

let context;
let cryptocurrencyRepository;
let priceRepository;
let service;

beforeEach(() => {
  context = undefined;
  context = createTestContext();

  cryptocurrencyRepository = createCryptocurrencyRepository(context.db);
  priceRepository = createPriceRepository(context.db);

  service = createPriceService(
    cryptocurrencyRepository,
    priceRepository,
    context.cmcClient,
  );
});

afterEach(() => {
  context?.cleanup();
});

function readHistory() {
  return context.db.prepare(`
    SELECT
      cryptocurrency_id AS cryptocurrencyId,
      price,
      received_at AS receivedAt
    FROM price_history
    ORDER BY cryptocurrency_id, received_at
  `).all();
}

describe("Синхронизация цен", () => {
  test("сопоставляет CMC ID с внутренними ID и сохраняет цены", async () => {
    const ethereum = cryptocurrencyRepository.create(
      1027,
      "ETH",
      "Ethereum",
    );

    const bitcoin = cryptocurrencyRepository.create(
      1,
      "BTC",
      "Bitcoin",
    );

    const receivedAt = "2026-10-28T12:00:00.000Z";

    // Порядок ответа отличается от порядка записей в БД.
    context.cmcClient.getLatestPrices.mockResolvedValueOnce([
      {
        coinmarketcapId: 1,
        symbol: "BTC",
        name: "Bitcoin",
        price: 80000,
        currency: "USD",
        receivedAt,
      },
      {
        coinmarketcapId: 1027,
        symbol: "ETH",
        name: "Ethereum",
        price: 2300,
        currency: "USD",
        receivedAt,
      },
    ]);

    const savedCount = await service.syncPrices();

    expect(savedCount).toBe(2);

    expect(context.cmcClient.getLatestPrices)
      .toHaveBeenCalledTimes(1);

    expect(context.cmcClient.getLatestPrices)
      .toHaveBeenCalledWith([1027, 1]);

    expect(readHistory()).toEqual([
      {
        cryptocurrencyId: ethereum.id,
        price: 2300,
        receivedAt,
      },
      {
        cryptocurrencyId: bitcoin.id,
        price: 80000,
        receivedAt,
      },
    ]);

    expect(
      cryptocurrencyRepository.findById(ethereum.id).lastUpdatedAt,
    ).toBe(receivedAt);

    expect(
      cryptocurrencyRepository.findById(bitcoin.id).lastUpdatedAt,
    ).toBe(receivedAt);
  });

  test("не обращается к CMC при пустом списке монет", async () => {
    const savedCount = await service.syncPrices();

    expect(savedCount).toBe(0);
    expect(context.cmcClient.getLatestPrices).not.toHaveBeenCalled();
    expect(readHistory()).toEqual([]);
  });

  test("не меняет БД при ошибке CMC", async () => {
    const coin = cryptocurrencyRepository.create(
      1,
      "BTC",
      "Bitcoin",
    );

    const previousTime = "2026-10-28T11:00:00.000Z";

    priceRepository.saveMany([
      {
        cryptocurrencyId: coin.id,
        price: 79000,
        receivedAt: previousTime,
      },
    ]);

    const previousHistory = readHistory();

    const error = Object.assign(
      new Error("CoinMarketCap не ответил вовремя"),
      { code: "CMC_TIMEOUT" },
    );

    context.cmcClient.getLatestPrices.mockRejectedValueOnce(error);

    await expect(service.syncPrices()).rejects.toMatchObject({
      code: "CMC_TIMEOUT",
    });

    expect(readHistory()).toEqual(previousHistory);

    expect(
      cryptocurrencyRepository.findById(coin.id).lastUpdatedAt,
    ).toBe(previousTime);
  });
});

describe("Транзакция сохранения цен", () => {
  test("откатывает весь пакет и время обновления при ошибке", () => {
    const bitcoin = cryptocurrencyRepository.create(
      1,
      "BTC",
      "Bitcoin",
    );

    const ethereum = cryptocurrencyRepository.create(
      1027,
      "ETH",
      "Ethereum",
    );

    const receivedAt = "2026-10-28T12:00:00.000Z";

    expect(() => {
      priceRepository.saveMany([
        {
          cryptocurrencyId: bitcoin.id,
          price: 80000,
          receivedAt,
        },
        {
          cryptocurrencyId: ethereum.id,
          price: -1,
          receivedAt,
        },
      ]);
    }).toThrow();

    expect(readHistory()).toEqual([]);

    expect(
      cryptocurrencyRepository.findById(bitcoin.id).lastUpdatedAt,
    ).toBeNull();

    expect(
      cryptocurrencyRepository.findById(ethereum.id).lastUpdatedAt,
    ).toBeNull();
  });
});