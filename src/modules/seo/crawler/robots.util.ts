import { fetchUrl, CRAWLER_USER_AGENT } from "./fetcher";

interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
  length: number;
}

export interface RobotsTxt {
  found: boolean;
  fetchError: string | null;
  rules: RobotsRule[];
  sitemaps: string[];
  crawlDelayMs: number | null;
  raw: string | null;
}

export const EMPTY_ROBOTS: RobotsTxt = {
  found: false,
  fetchError: null,
  rules: [],
  sitemaps: [],
  crawlDelayMs: null,
  raw: null,
};

function agentMatches(agentLine: string, ourAgent: string): "exact" | "wildcard" | null {
  const value = agentLine.trim().toLowerCase();
  if (value === "*") return "wildcard";
  const token = ourAgent.toLowerCase();
  if (token.includes(value) && value.length > 2) return "exact";
  return null;
}

export function parseRobotsTxt(text: string, userAgent = CRAWLER_USER_AGENT): RobotsTxt {
  const lines = text.split(/\r?\n/);
  const sitemaps: string[] = [];

  const groups: Array<{ agents: string[]; rules: RobotsRule[]; crawlDelay: number | null }> = [];
  let current: { agents: string[]; rules: RobotsRule[]; crawlDelay: number | null } | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value);
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;
    if (!current) continue;

    if (field === "disallow" || field === "allow") {
      current.rules.push({
        type: field === "allow" ? "allow" : "disallow",
        pattern: value,
        length: value.length,
      });
    } else if (field === "crawl-delay") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) current.crawlDelay = parsed;
    }
  }

  const exactGroups = groups.filter((group) =>
    group.agents.some((agent) => agentMatches(agent, userAgent) === "exact"),
  );
  const wildcardGroups = groups.filter((group) =>
    group.agents.some((agent) => agentMatches(agent, userAgent) === "wildcard"),
  );
  const applicable = exactGroups.length ? exactGroups : wildcardGroups;

  const rules = applicable.flatMap((group) => group.rules);
  const crawlDelay = applicable.find((group) => group.crawlDelay != null)?.crawlDelay ?? null;

  return {
    found: true,
    fetchError: null,
    rules,
    sitemaps,
    crawlDelayMs: crawlDelay != null ? Math.round(crawlDelay * 1000) : null,
    raw: text.slice(0, 20000),
  };
}

function patternToRegExp(pattern: string): RegExp {
  let source = "";
  for (const char of pattern) {
    if (char === "*") source += ".*";
    else if (char === "$") source += "$";
    else source += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}`);
}

/** Google's precedence: the most specific (longest) matching rule wins; Allow beats Disallow on ties. */
export function isAllowedByRobots(robots: RobotsTxt, url: string): boolean {
  if (!robots.found || !robots.rules.length) return true;
  let target: string;
  try {
    const parsed = new URL(url);
    target = `${parsed.pathname}${parsed.search}`;
  } catch {
    return true;
  }

  let best: RobotsRule | null = null;
  for (const rule of robots.rules) {
    if (rule.pattern === "") {
      if (rule.type === "disallow") continue;
    }
    let matches = false;
    try {
      matches = patternToRegExp(rule.pattern).test(target);
    } catch {
      matches = target.startsWith(rule.pattern);
    }
    if (!matches) continue;
    if (!best || rule.length > best.length || (rule.length === best.length && rule.type === "allow")) {
      best = rule;
    }
  }

  if (!best) return true;
  return best.type === "allow";
}

export async function fetchRobotsTxt(origin: string, timeoutMs = 15000): Promise<RobotsTxt> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const outcome = await fetchUrl(robotsUrl, { timeoutMs, retries: 0, acceptHeader: "text/plain,*/*" });

  if (!outcome.ok || !outcome.body) {
    return {
      ...EMPTY_ROBOTS,
      fetchError: outcome.error ?? (outcome.status ? `robots.txt returned ${outcome.status}` : "robots.txt unavailable"),
    };
  }
  return parseRobotsTxt(outcome.body);
}

function xmlValues(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) =>
    match[1]
      .trim()
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'"),
  );
}

export interface SitemapResult {
  found: boolean;
  urls: string[];
  sitemapsFetched: string[];
  errors: string[];
}

export async function fetchSitemapUrls(
  origin: string,
  extraSitemaps: string[] = [],
  limit = 2000,
  timeoutMs = 20000,
): Promise<SitemapResult> {
  const queue = [...new Set([new URL("/sitemap.xml", origin).toString(), ...extraSitemaps])];
  const seenSitemaps = new Set<string>();
  const urls = new Set<string>();
  const errors: string[] = [];
  const fetched: string[] = [];
  let found = false;

  while (queue.length && urls.size < limit && seenSitemaps.size < 50) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const outcome = await fetchUrl(sitemapUrl, { timeoutMs, retries: 0, acceptHeader: "application/xml,text/xml,*/*" });
    if (!outcome.ok || !outcome.body) {
      errors.push(`${sitemapUrl}: ${outcome.error ?? `returned ${outcome.status}`}`);
      continue;
    }

    found = true;
    fetched.push(sitemapUrl);
    const body = outcome.body;

    if (/<sitemapindex[\s>]/i.test(body)) {
      for (const child of xmlValues(body, "loc")) queue.push(child);
      continue;
    }

    for (const loc of xmlValues(body, "loc")) {
      if (/\.xml(\?|$)/i.test(loc)) queue.push(loc);
      else if (urls.size < limit) urls.add(loc);
    }
  }

  return { found, urls: [...urls], sitemapsFetched: fetched, errors };
}
