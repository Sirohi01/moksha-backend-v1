import { assertSafeUrl } from "./url.util";
import { CRAWLER_USER_AGENT } from "./fetcher";
import { logger } from "../../../config/logger";
import type { Browser, BrowserContext, Page } from "playwright";

type PlaywrightModule = typeof import("playwright");

export interface BrowserProblem {
  url: string;
  message: string;
  type: "console_error" | "console_warning" | "js_exception" | "failed_request";
  resourceUrl: string | null;
  resourceType: string | null;
  statusCode: number | null;
  timestamp: Date;
}

export interface RenderResult {
  html: string;
  problems: BrowserProblem[];
  transferredBytes: number | null;
  resourceCount: number;
}

let cachedModule: PlaywrightModule | null = null;
let moduleChecked = false;
let browser: Browser | null = null;

function loadPlaywright(): PlaywrightModule | null {
  if (moduleChecked) return cachedModule;
  moduleChecked = true;
  try {
    // Optional peer: JS rendering is only used when the operator installs Playwright.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("playwright") as PlaywrightModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export async function isJsRenderingAvailable(): Promise<boolean> {
  return loadPlaywright() !== null;
}

async function getBrowser(): Promise<Browser | null> {
  const playwright = loadPlaywright();
  if (!playwright) return null;
  if (browser) return browser;
  try {
    browser = await playwright.chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    return browser;
  } catch (error) {
    logger.warn("seoCrawler: Playwright browser launch failed", { err: error });
    cachedModule = null;
    return null;
  }
}

export async function renderPage(url: string, timeoutMs = 20000): Promise<RenderResult | null> {
  const safety = await assertSafeUrl(url);
  if (!safety.safe) return null;

  const instance = await getBrowser();
  if (!instance) return null;

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    context = await instance.newContext({ userAgent: CRAWLER_USER_AGENT });
    page = await context.newPage();
    const problems = new Map<string, BrowserProblem>();
    let transferredBytes = 0;
    let hasTransferSizes = false;
    let resourceCount = 0;
    const record = (problem: BrowserProblem) => {
      const key = `${problem.type}|${problem.message}|${problem.resourceUrl ?? ""}|${problem.statusCode ?? ""}`;
      if (!problems.has(key) && problems.size < 60) problems.set(key, problem);
    };
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      record({
        url,
        message: message.text().slice(0, 1000),
        type: message.type() === "error" ? "console_error" : "console_warning",
        resourceUrl: null,
        resourceType: null,
        statusCode: null,
        timestamp: new Date(),
      });
    });
    page.on("pageerror", (error) => record({
      url,
      message: error.message.slice(0, 1000),
      type: "js_exception",
      resourceUrl: null,
      resourceType: "document",
      statusCode: null,
      timestamp: new Date(),
    }));
    page.on("requestfailed", (request) => {
      if (["media", "font"].includes(request.resourceType())) return;
      record({
        url,
        message: (request.failure()?.errorText ?? "Network request failed").slice(0, 1000),
        type: "failed_request",
        resourceUrl: request.url().slice(0, 2000),
        resourceType: request.resourceType(),
        statusCode: null,
        timestamp: new Date(),
      });
    });
    page.on("response", async (response) => {
      resourceCount += 1;
      const length = Number(response.headers()["content-length"]);
      if (Number.isFinite(length) && length >= 0) {
        transferredBytes += length;
        hasTransferSizes = true;
      }
      if (response.status() < 400) return;
      const request = response.request();
      record({
        url,
        message: `HTTP ${response.status()} ${response.statusText()}`.slice(0, 1000),
        type: "failed_request",
        resourceUrl: response.url().slice(0, 2000),
        resourceType: request.resourceType(),
        statusCode: response.status(),
        timestamp: new Date(),
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (["media", "font"].includes(request.resourceType())) {
        await route.abort();
        return;
      }
      const requestUrl = request.url();
      if (/^https?:/i.test(requestUrl)) {
        const requestSafety = await assertSafeUrl(requestUrl);
        if (!requestSafety.safe) {
          await route.abort("blockedbyclient");
          return;
        }
      } else if (!/^(data|blob):/i.test(requestUrl)) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (response) {
      const finalSafety = await assertSafeUrl(response.url());
      if (!finalSafety.safe) throw new Error(finalSafety.reason ?? "Unsafe redirect destination");
    }
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 5000) }).catch(() => undefined);
    const html = await page.content();
    return {
      html,
      problems: [...problems.values()],
      transferredBytes: hasTransferSizes ? transferredBytes : null,
      resourceCount,
    };
  } catch (error) {
    logger.warn("seoCrawler: JS rendering failed", { url, err: error });
    return null;
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
  }
}

export async function closeRenderer(): Promise<void> {
  if (!browser) return;
  await browser.close().catch(() => undefined);
  browser = null;
}
