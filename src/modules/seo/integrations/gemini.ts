import crypto from "node:crypto";
import { env } from "../../../config/env";
import type { ISeoRecommendationItem } from "../../../models/seoRecommendation.model";

export interface GeminiOutcome<T> {
  status: "ok" | "not_configured" | "error";
  data: T | null;
  message: string | null;
  model: string;
}

const SYSTEM_RULES = [
  "You are an SEO implementation assistant for the Moksha Sewa website.",
  "You will be given FACTS that were measured by a deterministic crawler, Google Search Console, Google Analytics 4 and Lighthouse.",
  "Never invent metrics, rankings, search volumes, traffic numbers, backlinks or issues. Only reason about the facts provided.",
  "If a fact is missing, say it is not available rather than guessing a number.",
  "Do not restate an average position from Search Console as a live Google rank.",
  "Write concrete, implementable guidance for a Next.js App Router codebase.",
  "Respond with JSON only, matching the requested schema exactly.",
].join(" ");

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

export function hashInput(input: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function callGemini<T>(prompt: string, responseSchema: Record<string, unknown>): Promise<GeminiOutcome<T>> {
  const model = env.GEMINI_MODEL;
  if (!env.GEMINI_API_KEY) {
    return { status: "not_configured", data: null, message: "Set GEMINI_API_KEY to enable AI recommendations", model };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_RULES }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );

    const body = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      return {
        status: "error",
        data: null,
        message: body?.error?.message ?? `Gemini returned ${response.status}`,
        model,
      };
    }

    const text = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
    if (!text.trim()) {
      return { status: "error", data: null, message: "Gemini returned an empty response", model };
    }

    return { status: "ok", data: JSON.parse(text) as T, message: null, model };
  } catch (error) {
    return {
      status: "error",
      data: null,
      message: error instanceof Error ? error.message : "Gemini request failed",
      model,
    };
  }
}

const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ruleId: { type: "string" },
          title: { type: "string" },
          whyItMatters: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          recommendedFix: { type: "string" },
          implementation: { type: "string" },
          suggestedTitle: { type: "string" },
          suggestedDescription: { type: "string" },
          headingSuggestions: { type: "array", items: { type: "string" } },
          internalLinkSuggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fromOrTo: { type: "string" },
                anchorText: { type: "string" },
                reason: { type: "string" },
              },
              required: ["fromOrTo", "anchorText", "reason"],
            },
          },
          contentSuggestions: { type: "array", items: { type: "string" } },
          schemaSuggestion: { type: "string" },
        },
        required: ["title", "whyItMatters", "priority", "recommendedFix", "implementation"],
      },
    },
  },
  required: ["summary", "items"],
};

interface RawRecommendationResponse {
  summary?: string;
  items?: Array<Partial<ISeoRecommendationItem> & { priority?: string }>;
}

function normalizeItems(raw: RawRecommendationResponse): ISeoRecommendationItem[] {
  return (raw.items ?? []).slice(0, 25).map((item) => ({
    ruleId: item.ruleId ?? null,
    title: String(item.title ?? "Recommendation").slice(0, 300),
    whyItMatters: String(item.whyItMatters ?? "").slice(0, 2000),
    priority: item.priority === "high" || item.priority === "low" ? item.priority : "medium",
    recommendedFix: String(item.recommendedFix ?? "").slice(0, 3000),
    implementation: String(item.implementation ?? "").slice(0, 4000),
    suggestedTitle: item.suggestedTitle ? String(item.suggestedTitle).slice(0, 300) : null,
    suggestedDescription: item.suggestedDescription ? String(item.suggestedDescription).slice(0, 500) : null,
    headingSuggestions: (item.headingSuggestions ?? []).slice(0, 15).map((value) => String(value).slice(0, 300)),
    internalLinkSuggestions: (item.internalLinkSuggestions ?? []).slice(0, 15).map((link) => ({
      fromOrTo: String(link.fromOrTo ?? "").slice(0, 500),
      anchorText: String(link.anchorText ?? "").slice(0, 200),
      reason: String(link.reason ?? "").slice(0, 500),
    })),
    contentSuggestions: (item.contentSuggestions ?? []).slice(0, 15).map((value) => String(value).slice(0, 1000)),
    schemaSuggestion: item.schemaSuggestion ? String(item.schemaSuggestion).slice(0, 4000) : null,
  }));
}

export interface PageRecommendationInput {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  wordCount: number;
  canonical: string | null;
  indexable: boolean;
  schemaTypes: string[];
  internalLinksIn: number;
  internalLinksOut: number;
  crawlDepth: number | null;
  score: number | null;
  issues: Array<{ ruleId: string; severity: string; title: string; detail: string }>;
  search: { clicks: number; impressions: number; ctr: number; position: number; available: boolean } | null;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  performance: {
    performanceScore: number | null;
    labLcpMs: number | null;
    labCls: number | null;
    fieldLcpMs: number | null;
    fieldCls: number | null;
    fieldInpMs: number | null;
  } | null;
  candidateInternalLinkTargets: Array<{ url: string; title: string | null }>;
}

export async function generatePageRecommendations(
  input: PageRecommendationInput,
): Promise<GeminiOutcome<{ summary: string; items: ISeoRecommendationItem[] }>> {
  const prompt = [
    "Explain and fix the SEO problems that were MEASURED on this page.",
    "Only address the issues in the `issues` array. Do not invent additional problems.",
    "If you suggest a title or meta description, respect the length limits (title 30-60 characters, description 70-160 characters) and keep the organisation's tone: a humanitarian end-of-life support NGO in India.",
    "For internal link suggestions, only use URLs from `candidateInternalLinkTargets`.",
    "Set `ruleId` on each item to the matching ruleId from the issues array when the item addresses one.",
    "",
    "MEASURED FACTS (JSON):",
    JSON.stringify(input),
  ].join("\n");

  const outcome = await callGemini<RawRecommendationResponse>(prompt, RECOMMENDATION_SCHEMA);
  if (outcome.status !== "ok" || !outcome.data) {
    return { status: outcome.status, data: null, message: outcome.message, model: outcome.model };
  }

  return {
    status: "ok",
    data: { summary: String(outcome.data.summary ?? "").slice(0, 4000), items: normalizeItems(outcome.data) },
    message: null,
    model: outcome.model,
  };
}

export interface SiteRecommendationInput {
  siteUrl: string;
  scores: Record<string, number | null>;
  pagesCrawled: number;
  topIssues: Array<{ ruleId: string; severity: string; title: string; affectedPages: number }>;
  brokenLinks: number;
  redirectIssues: number;
  orphanPages: number;
  search: {
    available: boolean;
    windowDays: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
    clicksChangePercent: number | null;
  } | null;
  analytics: {
    available: boolean;
    sessions: number | null;
    organicSessions: number | null;
    engagementRate: number | null;
  } | null;
  scoreHistory: Array<{ capturedAt: string; overall: number | null }>;
}

export async function generateSiteRecommendations(
  input: SiteRecommendationInput,
): Promise<GeminiOutcome<{ summary: string; items: ISeoRecommendationItem[] }>> {
  const prompt = [
    "Explain why the deterministic SEO score has its measured value, then produce a prioritised remediation plan based only on the facts below.",
    "The numeric score is final and rule-based: do not recalculate it or promise an exact score increase.",
    "In the summary identify the biggest measured score losses, performance and search-visibility context, and the top three actions in priority order.",
    "Rank actions by expected area of improvement against effort and reference the exact ruleIds provided.",
    "Do not invent traffic, ranking or competitor data.",
    "",
    "MEASURED FACTS (JSON):",
    JSON.stringify(input),
  ].join("\n");

  const outcome = await callGemini<RawRecommendationResponse>(prompt, RECOMMENDATION_SCHEMA);
  if (outcome.status !== "ok" || !outcome.data) {
    return { status: outcome.status, data: null, message: outcome.message, model: outcome.model };
  }

  return {
    status: "ok",
    data: { summary: String(outcome.data.summary ?? "").slice(0, 4000), items: normalizeItems(outcome.data) },
    message: null,
    model: outcome.model,
  };
}

export interface CannibalizationInput {
  query: string;
  totals: { clicks: number; impressions: number };
  pages: Array<{
    url: string;
    title: string | null;
    clicks: number;
    impressions: number;
    position: number;
    wordCount: number | null;
  }>;
}

export async function interpretCannibalization(
  input: CannibalizationInput[],
): Promise<GeminiOutcome<{ summary: string; items: ISeoRecommendationItem[] }>> {
  const prompt = [
    "Several pages compete for the same Search Console queries. For each query group, recommend exactly one action: merge, differentiate, redirect, adjust internal linking, or change content targeting.",
    "Base the recommendation only on the clicks, impressions and average positions provided.",
    "Average position is a Search Console average, not a live rank — do not describe it as a current rank.",
    "Use the query text as the item title.",
    "",
    "MEASURED FACTS (JSON):",
    JSON.stringify(input),
  ].join("\n");

  const outcome = await callGemini<RawRecommendationResponse>(prompt, RECOMMENDATION_SCHEMA);
  if (outcome.status !== "ok" || !outcome.data) {
    return { status: outcome.status, data: null, message: outcome.message, model: outcome.model };
  }

  return {
    status: "ok",
    data: { summary: String(outcome.data.summary ?? "").slice(0, 4000), items: normalizeItems(outcome.data) },
    message: null,
    model: outcome.model,
  };
}

export interface ContentGapInput {
  underservedQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
    bestPage: string | null;
    bestPageTitle: string | null;
    bestPageWordCount: number | null;
  }>;
  existingPages: Array<{ url: string; title: string | null; h1: string[]; wordCount: number }>;
}

export async function analyzeContentGap(
  input: ContentGapInput,
): Promise<GeminiOutcome<{ summary: string; items: ISeoRecommendationItem[] }>> {
  const prompt = [
    "These Search Console queries already earn impressions but convert poorly into clicks, or have no well-matched page.",
    "For each, decide whether to expand an existing page or create a new one, and outline the sections to write.",
    "Impressions and clicks are real Search Console measurements. There is NO search-volume data available — never state or estimate search volume.",
    "Only reference pages listed in `existingPages`.",
    "",
    "MEASURED FACTS (JSON):",
    JSON.stringify(input),
  ].join("\n");

  const outcome = await callGemini<RawRecommendationResponse>(prompt, RECOMMENDATION_SCHEMA);
  if (outcome.status !== "ok" || !outcome.data) {
    return { status: outcome.status, data: null, message: outcome.message, model: outcome.model };
  }

  return {
    status: "ok",
    data: { summary: String(outcome.data.summary ?? "").slice(0, 4000), items: normalizeItems(outcome.data) },
    message: null,
    model: outcome.model,
  };
}
