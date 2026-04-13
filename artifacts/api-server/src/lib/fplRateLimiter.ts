const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface QueueItem {
  path: string;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  retries: number;
}

const queue: QueueItem[] = [];
let processing = false;
const MIN_INTERVAL = 2000;
let lastRequestTime = 0;

const MAX_RETRIES = 4;
const BACKOFF_BASE = 1000;
const BACKOFF_MAX = 60000;

const outageLog: Array<{
  timestamp: number;
  endpoint: string;
  errorCode: number | string;
  duration?: number;
}> = [];

export function getOutageLog() {
  return outageLog.slice(-50);
}

function getBackoffDelay(retryCount: number): number {
  const delay = BACKOFF_BASE * Math.pow(2, retryCount);
  return Math.min(delay, BACKOFF_MAX);
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;

    const timeSinceLast = Date.now() - lastRequestTime;
    if (timeSinceLast < MIN_INTERVAL) {
      await wait(MIN_INTERVAL - timeSinceLast);
    }

    try {
      lastRequestTime = Date.now();
      const response = await fetch(`${FPL_BASE_URL}${item.path}`, {
        headers: { "User-Agent": "SuperScout/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        if (item.retries < MAX_RETRIES) {
          const backoff = getBackoffDelay(item.retries);
          console.warn(
            `[fplRateLimiter] 429 on ${item.path}, retry ${item.retries + 1} after ${backoff}ms`,
          );
          outageLog.push({ timestamp: Date.now(), endpoint: item.path, errorCode: 429 });
          await wait(backoff);
          queue.unshift({ ...item, retries: item.retries + 1 });
          continue;
        }
        outageLog.push({ timestamp: Date.now(), endpoint: item.path, errorCode: 429 });
        item.reject(new Error(`FPL API rate limited after ${MAX_RETRIES} retries: ${item.path}`));
        continue;
      }

      if (response.status >= 500) {
        if (item.retries < MAX_RETRIES) {
          const backoff = getBackoffDelay(item.retries);
          console.warn(
            `[fplRateLimiter] ${response.status} on ${item.path}, retry ${item.retries + 1} after ${backoff}ms`,
          );
          outageLog.push({
            timestamp: Date.now(),
            endpoint: item.path,
            errorCode: response.status,
          });
          await wait(backoff);
          queue.unshift({ ...item, retries: item.retries + 1 });
          continue;
        }
        outageLog.push({ timestamp: Date.now(), endpoint: item.path, errorCode: response.status });
        item.reject(new Error(`FPL API server error ${response.status}: ${item.path}`));
        continue;
      }

      if (!response.ok) {
        item.reject(new Error(`FPL API error ${response.status}: ${item.path}`));
        continue;
      }

      const data = await response.json();
      item.resolve(data);
    } catch (error) {
      if (
        item.retries < MAX_RETRIES &&
        error instanceof Error &&
        (error.name === "TimeoutError" || error.message.includes("fetch"))
      ) {
        const backoff = getBackoffDelay(item.retries);
        console.warn(
          `[fplRateLimiter] Network error on ${item.path}, retry ${item.retries + 1} after ${backoff}ms`,
        );
        outageLog.push({ timestamp: Date.now(), endpoint: item.path, errorCode: "network" });
        await wait(backoff);
        queue.unshift({ ...item, retries: item.retries + 1 });
        continue;
      }
      outageLog.push({ timestamp: Date.now(), endpoint: item.path, errorCode: "network" });
      item.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  processing = false;
}

export function fetchFromFpl<T>(path: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ path, resolve: resolve as (data: unknown) => void, reject, retries: 0 });
    processQueue().catch(console.error);
  });
}
