const {
  startPriceSync,
} = require("../dist/jobs/price-sync");

const intervalMs = 1000;

let service;
let job;
let pendingResolvers;

beforeEach(() => {
  jest.useFakeTimers();

  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});

  service = {
    syncPrices: jest.fn().mockResolvedValue(0),
  };

  job = undefined;
  pendingResolvers = [];
});

afterEach(async () => {
  try {
    // Завершаем зависшие Promise даже при падении проверки.
    for (const resolve of pendingResolvers) {
      resolve(0);
    }

    await job?.stop();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  }
});

function createDeferred() {
  let resolve;

  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  pendingResolvers.push(resolve);

  return { promise, resolve };
}

describe("Фоновая синхронизация цен", () => {
  test("выполняет первый запуск сразу", () => {
    job = startPriceSync(service, intervalMs);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);
  });

  test("повторяет запуск после заданного интервала", async () => {
    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(intervalMs - 1);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);

    expect(service.syncPrices).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(intervalMs);

    expect(service.syncPrices).toHaveBeenCalledTimes(3);
  });

  test("не запускает вторую синхронизацию, пока первая не завершена", async () => {
    const deferred = createDeferred();

    service.syncPrices.mockReturnValueOnce(deferred.promise);

    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(intervalMs * 5);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);
  });

  test("рассчитывает интервал от завершения предыдущего запуска", async () => {
    const deferred = createDeferred();

    service.syncPrices.mockReturnValueOnce(deferred.promise);

    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(intervalMs * 3);

    deferred.resolve(2);

    // Завершаем первый запуск и назначаем следующий.
    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(intervalMs - 1);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);

    expect(service.syncPrices).toHaveBeenCalledTimes(2);
  });

  test("после ошибки продолжает синхронизацию", async () => {
    service.syncPrices.mockRejectedValueOnce(
      new Error("CoinMarketCap недоступен"),
    );

    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(0);

    expect(console.error).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(intervalMs);

    expect(service.syncPrices).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test("stop отменяет ожидающий таймер", async () => {
    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(0);

    expect(jest.getTimerCount()).toBe(1);

    await job.stop();

    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(intervalMs * 5);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);
  });

  test("stop ждёт выполняющуюся синхронизацию", async () => {
    const deferred = createDeferred();

    service.syncPrices.mockReturnValueOnce(deferred.promise);

    job = startPriceSync(service, intervalMs);

    let stopped = false;

    const stopping = job.stop().then(() => {
      stopped = true;
    });

    await jest.advanceTimersByTimeAsync(intervalMs * 3);

    expect(stopped).toBe(false);
    expect(service.syncPrices).toHaveBeenCalledTimes(1);

    deferred.resolve(2);

    await stopping;

    expect(stopped).toBe(true);
  });

  test("после остановки текущая синхронизация не создаёт новый таймер", async () => {
    const deferred = createDeferred();

    service.syncPrices.mockReturnValueOnce(deferred.promise);

    job = startPriceSync(service, intervalMs);

    const stopping = job.stop();

    deferred.resolve(2);
    await stopping;

    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(intervalMs * 5);

    expect(service.syncPrices).toHaveBeenCalledTimes(1);
  });

  test("повторный stop корректно обрабатывается", async () => {
    job = startPriceSync(service, intervalMs);

    await jest.advanceTimersByTimeAsync(0);

    await job.stop();
    await job.stop();

    expect(jest.getTimerCount()).toBe(0);
    expect(service.syncPrices).toHaveBeenCalledTimes(1);
  });

  test.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    2147483648,
    "1000",
  ])("отклоняет неправильный интервал: %s", (interval) => {
    expect(() => {
      startPriceSync(service, interval);
    }).toThrow("Некорректный интервал синхронизации");

    expect(service.syncPrices).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});