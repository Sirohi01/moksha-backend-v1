import { assertSafeUrl } from "./url.util";

export const CRAWLER_USER_AGENT = "MokshaSewaSeoBot/1.0 (+https://mokshasewa.org; SEO audit)";

const MAX_REDIRECT_HOPS = 10;
const MAX_BODY_BYTES = 3 * 1024 * 1024;

export interface FetchHop {
  url: string;
  status: number | null;
  location: string | null;
}

export interface FetchOutcome {
  ok: boolean;
  requestedUrl: string;
  finalUrl: string;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  contentType: string | null;
  contentLength: number | null;
  body: string | null;
  bodyTruncated: boolean;
  hops: FetchHop[];
  redirected: boolean;
  isLoop: boolean;
  responseTimeMs: number;
  timedOut: boolean;
  blocked: boolean;
  error: string | null;
}

export interface FetchOptions {
  timeoutMs?: number;
  method?: "GET" | "HEAD";
  readBody?: boolean;
  retries?: number;
  acceptHeader?: string;
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

async function readLimitedText(response: Response): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: await response.text(), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (received - MAX_BODY_BYTES))));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { text: merged.toString("utf8"), truncated };
}

function emptyOutcome(requestedUrl: string, error: string, extras: Partial<FetchOutcome> = {}): FetchOutcome {
  return {
    ok: false,
    requestedUrl,
    finalUrl: requestedUrl,
    status: null,
    statusText: "",
    headers: {},
    contentType: null,
    contentLength: null,
    body: null,
    bodyTruncated: false,
    hops: [],
    redirected: false,
    isLoop: false,
    responseTimeMs: 0,
    timedOut: false,
    blocked: false,
    error,
    ...extras,
  };
}

/** Follows redirects manually so the full chain is observable, re-running the SSRF guard on
 *  every hop (a safe origin can still redirect into the private network). */
export async function fetchUrl(url: string, options: FetchOptions = {}): Promise<FetchOutcome> {
  const {
    timeoutMs = 20000,
    method = "GET",
    readBody = true,
    retries = 1,
    acceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  } = options;

  const startedAt = Date.now();
  const hops: FetchHop[] = [];
  const visited = new Set<string>([url]);
  let currentUrl = url;
  let attemptsLeft = retries;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const safety = await assertSafeUrl(currentUrl);
    if (!safety.safe) {
      return emptyOutcome(url, safety.reason ?? "Blocked URL", {
        blocked: true,
        hops,
        finalUrl: currentUrl,
        responseTimeMs: Date.now() - startedAt,
      });
    }

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": CRAWLER_USER_AGENT,
          accept: acceptHeader,
          "accept-language": "en-IN,en;q=0.9",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(message));
      if (attemptsLeft > 0 && !timedOut) {
        attemptsLeft -= 1;
        await new Promise((resolve) => setTimeout(resolve, 500));
        hop -= 1;
        continue;
      }
      return emptyOutcome(url, timedOut ? "Request timed out" : message, {
        hops,
        timedOut,
        finalUrl: currentUrl,
        responseTimeMs: Date.now() - startedAt,
      });
    }

    const headers = headersToObject(response.headers);
    const location = headers.location ?? null;
    hops.push({ url: currentUrl, status: response.status, location });

    const isRedirect = response.status >= 300 && response.status < 400 && location;
    if (isRedirect) {
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        return emptyOutcome(url, `Malformed redirect target: ${location}`, {
          hops,
          redirected: true,
          finalUrl: currentUrl,
          responseTimeMs: Date.now() - startedAt,
        });
      }
      await response.body?.cancel().catch(() => undefined);
      if (visited.has(nextUrl)) {
        return emptyOutcome(url, "Redirect loop detected", {
          hops,
          isLoop: true,
          redirected: true,
          finalUrl: nextUrl,
          responseTimeMs: Date.now() - startedAt,
        });
      }
      visited.add(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    let body: string | null = null;
    let truncated = false;
    const contentType = headers["content-type"] ?? null;
    const isTextual = !contentType || /text\/|application\/(xhtml|xml|json|ld\+json)/i.test(contentType);

    if (readBody && method === "GET" && isTextual) {
      try {
        const result = await readLimitedText(response);
        body = result.text;
        truncated = result.truncated;
      } catch (error) {
        body = null;
        truncated = false;
        void error;
      }
    } else {
      await response.body?.cancel().catch(() => undefined);
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      requestedUrl: url,
      finalUrl: currentUrl,
      status: response.status,
      statusText: response.statusText,
      headers,
      contentType,
      contentLength: headers["content-length"] ? Number(headers["content-length"]) : body ? Buffer.byteLength(body) : null,
      body,
      bodyTruncated: truncated,
      hops,
      redirected: hops.length > 1,
      isLoop: false,
      responseTimeMs: Date.now() - startedAt,
      timedOut: false,
      blocked: false,
      error: null,
    };
  }

  return emptyOutcome(url, `Exceeded ${MAX_REDIRECT_HOPS} redirects`, {
    hops,
    redirected: true,
    finalUrl: currentUrl,
    responseTimeMs: Date.now() - startedAt,
  });
}

export async function checkUrlStatus(url: string, timeoutMs = 15000): Promise<FetchOutcome> {
  const head = await fetchUrl(url, { method: "HEAD", readBody: false, timeoutMs, retries: 0 });
  const headUnsupported =
    head.status === 405 || head.status === 501 || head.status === 403 || head.status === null;
  if (!headUnsupported) return head;
  return fetchUrl(url, { method: "GET", readBody: false, timeoutMs, retries: 0 });
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  delayMs = 0,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length || 1));

  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  });

  await Promise.all(runners);
  return results;
}
