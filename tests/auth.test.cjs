const request = require("supertest");
const {
  apiKey,
  createTestContext,
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

describe("отклоняет запрос без токена", () => {
  test.each([
    ["get", "/cryptocurrencies"],
    ["get", "/cryptocurrencies/1"],
    ["post", "/cryptocurrencies"],
    ["patch", "/cryptocurrencies/1"],
    ["delete", "/cryptocurrencies/1"],
    ["get", "/cryptocurrencies/1/price"],
    ["get", "/cryptocurrencies/1/history"],
  ])("%s %s требует токен", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("отклоняет запрос c неверным токеном", () => {
  test.each([
    ["get", "/cryptocurrencies"],
    ["get", "/cryptocurrencies/1"],
    ["post", "/cryptocurrencies"],
    ["patch", "/cryptocurrencies/1"],
    ["delete", "/cryptocurrencies/1"],
    ["get", "/cryptocurrencies/1/price"],
    ["get", "/cryptocurrencies/1/history"],
  ])("%s %s требует токен", async (method, path) => {
    const response = await request(app)[method](path)
      .set("Authorization", `Bearer ${apiKey}f`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});