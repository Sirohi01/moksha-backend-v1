import { assertSafeUrl } from "./url.util";
import { CRAWLER_USER_AGENT } from "./fetcher";
import { logger } from "../../../config/logger";
import type { Browser, BrowserContext, Page } from "playwright";

type PlaywrightModule = typeof import("playwright");

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

export async function renderPage(url: string, timeoutMs = 20000): Promise<string | null> {
  const safety = await assertSafeUrl(url);
  if (!safety.safe) return null;

  const instance = await getBrowser();
  if (!instance) return null;

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    context = await instance.newContext({ userAgent: CRAWLER_USER_AGENT });
    page = await context.newPage();
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (["image", "media", "font"].includes(request.resourceType())) {
        await route.abort();
        return;
      }
      if (request.isNavigationRequest()) {
        const navigationSafety = await assertSafeUrl(request.url());
        if (!navigationSafety.safe) {
          await route.abort();
          return;
        }
      }
      await route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 5000) }).catch(() => undefined);
    const html = await page.content();
    return html;
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
