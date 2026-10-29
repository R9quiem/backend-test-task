const axios = require("axios");

const {
  createCoinMarketCapClient,
} = require("../dist/clients/coinmarket.client");

let client;
let get;

beforeEach(() => {
  get = jest.fn();

  jest.spyOn(axios, "create").mockReturnValue({ get });

  client = createCoinMarketCapClient(
    "test-cmc-key",
    "USD",
    5000,
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeBody(quoteOverrides = {}, coinOverrides = {}) {
  return {
    status: {
      error_code: "0",
    },
    data: [
      {
        id: 1,
        symbol: "BTC",
        name: "Bitcoin",
        quote: [
          {
            symbol: "USD",
            price: 80000,
            ...quoteOverrides,
          },
        ],
        ...coinOverrides,
      },
    ],
  };
}

describe("Запрос цен CoinMarketCap", () => {
  test("передаёт ключ и таймаут в настройки axios", () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "https://pro-api.coinmarketcap.com",
      timeout: 5000,
      maxRedirects: 0,
      headers: {
        "X-CMC_PRO_API_KEY": "test-cmc-key",
        Accept: "application/json",
      },
    });
  });

  test("отправляет правильные параметры и разбирает ответ", async () => {
    get.mockResolvedValueOnce({
      data: makeBody(),
    });

    const result = await client.getLatestPrices([1]);

    expect(get).toHaveBeenCalledTimes(1);

    expect(get).toHaveBeenCalledWith(
      "/v3/cryptocurrency/quotes/latest",
      {
        params: {
          id: "1",
          convert: "USD",
        },
      },
    );

    expect(result).toEqual([
      {
        coinmarketcapId: 1,
        symbol: "BTC",
        name: "Bitcoin",
        price: 80000,
        currency: "USD",
        receivedAt: expect.any(String),
      },
    ]);

    expect(
      Number.isFinite(Date.parse(result[0].receivedAt)),
    ).toBe(true);
  });

  test("не выполняет запрос при пустом списке", async () => {
    await expect(client.getLatestPrices([])).resolves.toEqual([]);

    expect(get).not.toHaveBeenCalled();
  });
});

describe("Сетевые ошибки CoinMarketCap", () => {
  test.each([
    ["ECONNABORTED", "CMC_TIMEOUT"],
    ["ETIMEDOUT", "CMC_TIMEOUT"],
    ["ERR_NETWORK", "CMC_UNAVAILABLE"],
    ["ECONNRESET", "CMC_UNAVAILABLE"],
    ["ENOTFOUND", "CMC_UNAVAILABLE"],
  ])("преобразует %s в %s", async (axiosCode, expectedCode) => {
    get.mockRejectedValueOnce(
      new axios.AxiosError("Ошибка запроса", axiosCode),
    );

    await expect(client.getLatestPrices([1]))
      .rejects.toMatchObject({
        code: expectedCode,
      });
  });
});

describe("HTTP-ошибки CoinMarketCap", () => {
  test.each([
    [401, "CMC_ACCESS_DENIED"],
    [403, "CMC_ACCESS_DENIED"],
    [429, "CMC_RATE_LIMIT"],
    [500, "CMC_UNAVAILABLE"],
    [503, "CMC_UNAVAILABLE"],
    [400, "CMC_REQUEST_FAILED"],
  ])("преобразует HTTP %s в %s", async (status, expectedCode) => {
    const error = new axios.AxiosError(
      "Ошибка ответа",
      "ERR_BAD_RESPONSE",
    );

    error.response = {
      status,
      statusText: "Error",
      data: {},
      headers: {},
      config: {},
    };

    get.mockRejectedValueOnce(error);

    await expect(client.getLatestPrices([1]))
      .rejects.toMatchObject({
        code: expectedCode,
      });
  });
});

describe("Проверка ответа CoinMarketCap", () => {
  test.each([
    {
      label: "ответ отсутствует",
      body: undefined,
    },
    {
      label: "нет обязательных полей",
      body: {},
    },
    {
      label: "нет запрошенной монеты",
      body: {
        status: { error_code: 0 },
        data: [],
      },
    },
    {
      label: "пустое название",
      body: makeBody({}, { name: "" }),
    },
    {
      label: "пустой символ",
      body: makeBody({}, { symbol: "" }),
    },
    {
      label: "нет цены",
      body: makeBody({ price: undefined }),
    },
    {
      label: "цена - строка",
      body: makeBody({ price: "80000" }),
    },
    {
      label: "отрицательная цена",
      body: makeBody({ price: -1 }),
    },
    {
      label: "цена - NaN",
      body: makeBody({ price: NaN }),
    },
    {
      label: "цена - Infinity",
      body: makeBody({ price: Infinity }),
    },
    {
      label: "нет котировки в нужной валюте",
      body: makeBody({ symbol: "EUR" }),
    },
  ])("отклоняет ответ: $label", async ({ body }) => {
    get.mockResolvedValueOnce({ data: body });

    await expect(client.getLatestPrices([1]))
      .rejects.toMatchObject({
        code: "CMC_INVALID_RESPONSE",
      });
  });

  test("обрабатывает ошибку в теле успешного HTTP-ответа", async () => {
    const body = makeBody();
    body.status.error_code = "1001";

    get.mockResolvedValueOnce({ data: body });

    await expect(client.getLatestPrices([1]))
      .rejects.toMatchObject({
        code: "CMC_REQUEST_FAILED",
      });
  });
});