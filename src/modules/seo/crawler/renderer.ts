import { assertSafeUrl } from "./url.util";
import { CRAWLER_USER_AGENT } from "./fetcher";
import { logger } from "../../../config/logger";

type PlaywrightModule = {
  chromium: {
    launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser>;
  };
};

interface PlaywrightBrowser {
  newContext(options?: Record<string, unknown>): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
  close(): Promise<void>;
}

let cachedModule: PlaywrightModule | null = null;
let moduleChecked = false;
let browser: PlaywrightBrowser | null = null;

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

async function getBrowser(): Promise<PlaywrightBrowser | null> {
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

  let context: PlaywrightContext | null = null;
  try {
    context = await instance.newContext({ userAgent: CRAWLER_USER_AGENT });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    const html = await page.content();
    await page.close();
    return html;
  } catch (error) {
    logger.warn("seoCrawler: JS rendering failed", { url, err: error });
    return null;
  } finally {
    await context?.close().catch(() => undefined);
  }
}

export async function closeRenderer(): Promise<void> {
  if (!browser) return;
  await browser.close().catch(() => undefined);
  browser = null;
}
