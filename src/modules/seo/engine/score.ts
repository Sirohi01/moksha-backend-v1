import type { SeoIssueCategory, SeoIssueSeverity } from "../../../models/seoIssue.model";
import type { DetectedIssue } from "./rules";

export type ScoreCategory = "technical" | "onPage" | "content" | "performance" | "visibility";

export const SEVERITY_PENALTY: Record<SeoIssueSeverity, number> = {
  critical: 10,
  warning: 3.5,
  notice: 0.7,
};

export const PAGE_SEVERITY_PENALTY: Record<SeoIssueSeverity, number> = {
  critical: 15,
  warning: 6,
  notice: 2,
};

export const SITE_SENSITIVITY = 4;

export const CATEGORY_OF_ISSUE: Record<SeoIssueCategory, ScoreCategory> = {
  metadata: "onPage",
  headings: "onPage",
  structured_data: "onPage",
  indexing: "technical",
  canonical: "technical",
  links: "technical",
  structure: "technical",
  security: "technical",
  content: "content",
  images: "content",
  performance: "performance",
};

export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  technical: 0.3,
  onPage: 0.25,
  content: 0.2,
  performance: 0.15,
  visibility: 0.1,
};

export interface ScoreContribution {
  ruleId: string;
  severity: SeoIssueSeverity;
  category: ScoreCategory;
  count: number;
  penalty: number;
}

export interface CategoryScore {
  category: ScoreCategory;
  score: number | null;
  rawPenalty: number;
  issueCount: number;
  available: boolean;
  contributions: ScoreContribution[];
  note?: string;
}

export interface VisibilityInput {
  available: boolean;
  indexablePages: number;
  pagesWithImpressions: number;
  pagesWithClicks: number;
}

export interface SiteScoreResult {
  overall: number | null;
  technical: number | null;
  onPage: number | null;
  content: number | null;
  performance: number | null;
  visibility: number | null;
  categories: CategoryScore[];
  formula: {
    severityPenalty: Record<SeoIssueSeverity, number>;
    sensitivity: number;
    weights: Record<ScoreCategory, number>;
    pagesConsidered: number;
    description: string;
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function aggregateContributions(issues: DetectedIssue[], penalties: Record<SeoIssueSeverity, number>): Map<ScoreCategory, ScoreContribution[]> {
  const byCategory = new Map<ScoreCategory, Map<string, ScoreContribution>>();

  for (const detected of issues) {
    const category = CATEGORY_OF_ISSUE[detected.category];
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const bucket = byCategory.get(category)!;
    const key = `${detected.ruleId}|${detected.severity}`;
    const existing = bucket.get(key);
    const penalty = penalties[detected.severity];
    if (existing) {
      existing.count += 1;
      existing.penalty += penalty;
    } else {
      bucket.set(key, {
        ruleId: detected.ruleId,
        severity: detected.severity,
        category,
        count: 1,
        penalty,
      });
    }
  }

  const result = new Map<ScoreCategory, ScoreContribution[]>();
  for (const [category, bucket] of byCategory) {
    result.set(
      category,
      [...bucket.values()].sort((a, b) => b.penalty - a.penalty),
    );
  }
  return result;
}

export function computeVisibilityScore(input: VisibilityInput): { score: number | null; note: string } {
  if (!input.available || input.indexablePages === 0) {
    return { score: null, note: "Search Console data is not connected, so visibility is not scored." };
  }
  const coverage = Math.min(1, input.pagesWithImpressions / input.indexablePages);
  const clickShare = input.pagesWithImpressions > 0 ? Math.min(1, input.pagesWithClicks / input.pagesWithImpressions) : 0;
  const score = clampScore(coverage * 60 + clickShare * 40);
  return {
    score,
    note: `${input.pagesWithImpressions}/${input.indexablePages} indexable pages earned impressions (60% of this score) and ${input.pagesWithClicks}/${input.pagesWithImpressions} of those earned clicks (40%).`,
  };
}

export function computeSiteScore(
  issues: DetectedIssue[],
  pagesConsidered: number,
  visibility: VisibilityInput,
  performanceAudited: number,
): SiteScoreResult {
  const pages = Math.max(1, pagesConsidered);
  const contributions = aggregateContributions(issues, SEVERITY_PENALTY);
  const categories: CategoryScore[] = [];

  const scoredCategories: ScoreCategory[] = ["technical", "onPage", "content", "performance"];

  for (const category of scoredCategories) {
    const items = contributions.get(category) ?? [];
    const rawPenalty = items.reduce((sum, item) => sum + item.penalty, 0);
    const issueCount = items.reduce((sum, item) => sum + item.count, 0);

    if (category === "performance" && performanceAudited === 0) {
      categories.push({
        category,
        score: null,
        rawPenalty: 0,
        issueCount: 0,
        available: false,
        contributions: [],
        note: "No PageSpeed Insights audit has run for this crawl yet.",
      });
      continue;
    }

    const divisor = category === "performance" ? Math.max(1, performanceAudited) : pages;
    const score = clampScore(100 - (rawPenalty / divisor) * SITE_SENSITIVITY);

    categories.push({
      category,
      score,
      rawPenalty: Number(rawPenalty.toFixed(2)),
      issueCount,
      available: true,
      contributions: items.slice(0, 25),
    });
  }

  const visibilityResult = computeVisibilityScore(visibility);
  categories.push({
    category: "visibility",
    score: visibilityResult.score,
    rawPenalty: 0,
    issueCount: 0,
    available: visibilityResult.score != null,
    contributions: [],
    note: visibilityResult.note,
  });

  const available = categories.filter((category) => category.score != null);
  const totalWeight = available.reduce((sum, category) => sum + CATEGORY_WEIGHTS[category.category], 0);
  const overall = totalWeight
    ? clampScore(
        available.reduce((sum, category) => sum + (category.score ?? 0) * CATEGORY_WEIGHTS[category.category], 0) / totalWeight,
      )
    : null;

  const byName = (name: ScoreCategory) => categories.find((category) => category.category === name)?.score ?? null;

  return {
    overall,
    technical: byName("technical"),
    onPage: byName("onPage"),
    content: byName("content"),
    performance: byName("performance"),
    visibility: byName("visibility"),
    categories,
    formula: {
      severityPenalty: SEVERITY_PENALTY,
      sensitivity: SITE_SENSITIVITY,
      weights: CATEGORY_WEIGHTS,
      pagesConsidered: pages,
      description:
        "Each detected issue adds a penalty by severity. Penalties are summed per category, divided by the number of pages considered, multiplied by the sensitivity factor, then subtracted from 100. The overall score is the weighted average of the categories that have data.",
    },
  };
}

export interface PageScoreResult {
  score: number;
  breakdown: Array<{ category: string; score: number; weight: number }>;
  contributions: ScoreContribution[];
}

export function computePageScore(issues: DetectedIssue[]): PageScoreResult {
  const contributions = aggregateContributions(issues, PAGE_SEVERITY_PENALTY);
  const flat: ScoreContribution[] = [];
  const breakdown: Array<{ category: string; score: number; weight: number }> = [];

  let totalPenalty = 0;
  for (const [category, items] of contributions) {
    const penalty = items.reduce((sum, item) => sum + item.penalty, 0);
    totalPenalty += penalty;
    flat.push(...items);
    breakdown.push({
      category,
      score: clampScore(100 - penalty),
      weight: CATEGORY_WEIGHTS[category],
    });
  }

  return {
    score: clampScore(100 - totalPenalty),
    breakdown,
    contributions: flat.sort((a, b) => b.penalty - a.penalty),
  };
}
