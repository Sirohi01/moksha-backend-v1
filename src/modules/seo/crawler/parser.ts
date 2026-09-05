import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { normalizeUrl, isSameSite } from "./url.util";

export interface ParsedLink {
  href: string;
  normalized: string;
  anchorText: string;
  rel: string | null;
  isNofollow: boolean;
  isInternal: boolean;
  isMixedContent: boolean;
}

export interface ParsedImage {
  src: string;
  alt: string | null;
  hasAlt: boolean;
  isDecorative: boolean;
  loading: string | null;
  width: number | null;
  height: number | null;
}

export interface HeadingAnalysis {
  h1: string[];
  h2: string[];
  h3: string[];
  counts: Record<string, number>;
  sequence: Array<{ level: number; text: string }>;
  status: "ok" | "warning" | "error";
  issues: string[];
  emptyCount: number;
  duplicates: string[];
  skippedLevels: Array<{ from: number; to: number }>;
  longHeadings: string[];
}

export interface ParsedPage {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaRobots: string | null;
  metaKeywords: string | null;
  metaKeywordCount: number;
  canonicals: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  ogUrl: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  lang: string | null;
  viewport: string | null;
  hreflang: Array<{ hreflang: string; href: string }>;
  headings: HeadingAnalysis;
  wordCount: number;
  textHash: string;
  simhash: string;
  titleHash: string | null;
  descriptionHash: string | null;
  links: ParsedLink[];
  images: ParsedImage[];
  jsonLdBlocks: string[];
  hasAmpLink: boolean;
  bodyTextSample: string;
  openingTextSample: string;
}

const LONG_HEADING_CHARS = 110;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** 64-bit simhash over word shingles — lets the rules engine flag near-duplicate pages
 *  by Hamming distance without storing page bodies. */
function simhash(text: string): string {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (words.length < 4) return "0".repeat(16);

  const shingles = new Map<string, number>();
  for (let index = 0; index < words.length - 2; index += 1) {
    const shingle = `${words[index]} ${words[index + 1]} ${words[index + 2]}`;
    shingles.set(shingle, (shingles.get(shingle) ?? 0) + 1);
  }

  const vector = new Array<number>(64).fill(0);
  for (const [shingle, weight] of shingles) {
    const digest = crypto.createHash("md5").update(shingle).digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = digest[Math.floor(bit / 8)];
      const isSet = (byte >> (bit % 8)) & 1;
      vector[bit] += isSet ? weight : -weight;
    }
  }

  let hex = "";
  for (let group = 0; group < 16; group += 1) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      if (vector[group * 4 + bit] > 0) nibble |= 1 << bit;
    }
    hex += nibble.toString(16);
  }
  return hex;
}

export function hammingDistanceHex(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    const diff = parseInt(a[index], 16) ^ parseInt(b[index], 16);
    distance += ((diff >> 0) & 1) + ((diff >> 1) & 1) + ((diff >> 2) & 1) + ((diff >> 3) & 1);
  }
  return distance;
}

function analyzeHeadings($: cheerio.CheerioAPI, wordCount: number): HeadingAnalysis {
  const sequence: Array<{ level: number; text: string }> = [];
  const counts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  let emptyCount = 0;

  $("h1, h2, h3, h4, h5, h6").each((_index, element) => {
    const tag = (element as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const level = Number(tag.replace("h", ""));
    if (!level) return;
    const text = normalizeText($(element).text());
    counts[tag] = (counts[tag] ?? 0) + 1;
    if (!text) emptyCount += 1;
    sequence.push({ level, text });
  });

  const byLevel = (level: number) =>
    sequence.filter((item) => item.level === level).map((item) => item.text).filter(Boolean);

  const h1 = byLevel(1);
  const h2 = byLevel(2);
  const h3 = byLevel(3);

  const issues: string[] = [];
  const skippedLevels: Array<{ from: number; to: number }> = [];
  const longHeadings: string[] = [];

  const seen = new Map<string, number>();
  for (const item of sequence) {
    if (!item.text) continue;
    const key = item.text.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (item.text.length > LONG_HEADING_CHARS) longHeadings.push(item.text);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([text]) => text);

  let previousLevel: number | null = null;
  for (const item of sequence) {
    if (previousLevel !== null && item.level > previousLevel + 1) {
      skippedLevels.push({ from: previousLevel, to: item.level });
    }
    previousLevel = item.level;
  }

  if (counts.h1 === 0) issues.push("No H1 found on the page");
  if (counts.h1 > 1) issues.push(`${counts.h1} H1 elements found`);
  if (emptyCount > 0) issues.push(`${emptyCount} empty heading element(s)`);
  for (const skip of skippedLevels) issues.push(`Heading level jumps from H${skip.from} to H${skip.to}`);
  if (duplicates.length) issues.push(`${duplicates.length} heading text(s) repeated on the page`);
  if (longHeadings.length) issues.push(`${longHeadings.length} heading(s) longer than ${LONG_HEADING_CHARS} characters`);
  if (wordCount >= 300 && sequence.length < 2) {
    issues.push("Long-form content with fewer than two headings — no usable content structure");
  }

  let status: HeadingAnalysis["status"] = "ok";
  if (counts.h1 === 0 || counts.h1 > 1 || skippedLevels.length > 0) status = "error";
  else if (issues.length > 0) status = "warning";

  return {
    h1: h1.slice(0, 10),
    h2: h2.slice(0, 60),
    h3: h3.slice(0, 80),
    counts,
    sequence: sequence.slice(0, 200),
    status,
    issues,
    emptyCount,
    duplicates: duplicates.slice(0, 20),
    skippedLevels,
    longHeadings: longHeadings.slice(0, 10),
  };
}

function metaContent($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr("content");
  return value != null ? normalizeText(value) || null : null;
}

export function parseHtml(html: string, pageUrl: string, siteHostname: string, includeSubdomains = false): ParsedPage {
  const $ = cheerio.load(html);
  const pageIsHttps = pageUrl.startsWith("https:");

  const title = normalizeText($("head title").first().text() || $("title").first().text()) || null;
  const metaDescription = metaContent($, 'meta[name="description" i]');
  const metaRobots = metaContent($, 'meta[name="robots" i]');
  const metaKeywords = metaContent($, 'meta[name="keywords" i]');

  const canonicals = $('link[rel="canonical" i]')
    .map((_index, element) => $(element).attr("href") ?? "")
    .get()
    .map((value) => value.trim())
    .filter(Boolean);

  const hreflang = $('link[rel="alternate" i][hreflang]')
    .map((_index, element) => ({
      hreflang: $(element).attr("hreflang") ?? "",
      href: $(element).attr("href") ?? "",
    }))
    .get()
    .filter((item) => item.hreflang && item.href)
    .slice(0, 50);

  const $text = cheerio.load(html);
  $text("script, style, noscript, svg, template, iframe").remove();
  const visibleText = normalizeText($text("body").length ? $text("body").text() : $text.root().text());
  const words = visibleText ? visibleText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const headings = analyzeHeadings($, wordCount);

  const links: ParsedLink[] = [];
  const seenLinks = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const parsed = normalizeUrl(href, pageUrl);
    if (!parsed) return;
    const rel = $(element).attr("rel") ?? null;
    const isInternal = isSameSite(parsed.hostname, siteHostname, includeSubdomains);
    const anchorText = normalizeText($(element).text()) || normalizeText($(element).find("img").attr("alt") ?? "");
    const key = `${parsed.normalized}|${anchorText}`;
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    links.push({
      href: parsed.href,
      normalized: parsed.normalized,
      anchorText: anchorText.slice(0, 300),
      rel,
      isNofollow: Boolean(rel && /\bnofollow\b/i.test(rel)),
      isInternal,
      isMixedContent: pageIsHttps && parsed.href.startsWith("http:"),
    });
  });

  const images: ParsedImage[] = [];
  $("img").each((_index, element) => {
    const node = $(element);
    const src = node.attr("src") ?? node.attr("data-src") ?? node.attr("srcset")?.split(",")[0]?.trim().split(" ")[0] ?? "";
    if (!src) return;
    const altAttribute = node.attr("alt");
    const hasAltAttribute = altAttribute != null;
    const alt = hasAltAttribute ? altAttribute.trim() : null;
    const widthRaw = Number(node.attr("width"));
    const heightRaw = Number(node.attr("height"));
    images.push({
      src: (normalizeUrl(src, pageUrl)?.href ?? src).slice(0, 1000),
      alt,
      hasAlt: hasAltAttribute && Boolean(alt),
      isDecorative: hasAltAttribute && alt === "",
      loading: node.attr("loading") ?? null,
      width: Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : null,
      height: Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : null,
    });
  });

  const jsonLdBlocks = $('script[type="application/ld+json" i]')
    .map((_index, element) => $(element).contents().text())
    .get()
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 30);

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    metaRobots,
    metaKeywords,
    metaKeywordCount: metaKeywords ? metaKeywords.split(",").map((value) => value.trim()).filter(Boolean).length : 0,
    canonicals,
    ogTitle: metaContent($, 'meta[property="og:title" i]'),
    ogDescription: metaContent($, 'meta[property="og:description" i]'),
    ogImage: metaContent($, 'meta[property="og:image" i]'),
    ogType: metaContent($, 'meta[property="og:type" i]'),
    ogUrl: metaContent($, 'meta[property="og:url" i]'),
    twitterCard: metaContent($, 'meta[name="twitter:card" i]'),
    twitterTitle: metaContent($, 'meta[name="twitter:title" i]'),
    twitterDescription: metaContent($, 'meta[name="twitter:description" i]'),
    twitterImage: metaContent($, 'meta[name="twitter:image" i]'),
    lang: $("html").attr("lang")?.trim() || null,
    viewport: metaContent($, 'meta[name="viewport" i]'),
    hreflang,
    headings,
    wordCount,
    textHash: sha256(visibleText.toLowerCase()),
    simhash: simhash(visibleText),
    titleHash: title ? sha256(title.toLowerCase()) : null,
    descriptionHash: metaDescription ? sha256(metaDescription.toLowerCase()) : null,
    links: links.slice(0, 1500),
    images: images.slice(0, 300),
    jsonLdBlocks,
    hasAmpLink: $('link[rel="amphtml" i]').length > 0,
    bodyTextSample: visibleText.slice(0, 4000),
    openingTextSample: visibleText.slice(0, 800),
  };
}
