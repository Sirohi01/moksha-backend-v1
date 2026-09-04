export interface SchemaBlockResult {
  types: string[];
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SchemaValidationResult {
  blocks: SchemaBlockResult[];
  types: string[];
  duplicateTypes: string[];
  invalidJsonCount: number;
  hasBreadcrumb: boolean;
  breadcrumbValid: boolean | null;
  breadcrumbIssues: string[];
  allValid: boolean | null;
}

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Organization: ["name", "url"],
  NGO: ["name", "url"],
  WebSite: ["name", "url"],
  BreadcrumbList: ["itemListElement"],
  FAQPage: ["mainEntity"],
  Article: ["headline"],
  BlogPosting: ["headline"],
  NewsArticle: ["headline"],
  Product: ["name"],
  Event: ["name", "startDate"],
  LocalBusiness: ["name", "address"],
};

const SUPPORTED_TYPES = new Set(Object.keys(REQUIRED_PROPERTIES));

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typeNames(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return [];
}

function isAbsoluteUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateBreadcrumb(node: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const items = asArray(node.itemListElement as unknown);
  if (!items.length) {
    issues.push("BreadcrumbList has no itemListElement entries");
    return issues;
  }

  const positions: number[] = [];
  items.forEach((rawItem, index) => {
    if (typeof rawItem !== "object" || rawItem === null) {
      issues.push(`itemListElement[${index}] is not an object`);
      return;
    }
    const item = rawItem as Record<string, unknown>;
    const itemTypes = typeNames(item);
    if (itemTypes.length && !itemTypes.includes("ListItem")) {
      issues.push(`itemListElement[${index}] should be a ListItem`);
    }

    const position = item.position;
    if (typeof position !== "number") {
      issues.push(`itemListElement[${index}] is missing a numeric position`);
    } else {
      positions.push(position);
    }

    const target = item.item;
    const hasName = typeof item.name === "string" && item.name.trim().length > 0;
    const nestedName =
      typeof target === "object" && target !== null
        ? typeof (target as Record<string, unknown>).name === "string"
        : false;
    if (!hasName && !nestedName) {
      issues.push(`itemListElement[${index}] is missing a name`);
    }

    const isLast = index === items.length - 1;
    if (target == null) {
      if (!isLast) issues.push(`itemListElement[${index}] is missing an item URL`);
    } else if (typeof target === "string") {
      if (!isAbsoluteUrl(target)) issues.push(`itemListElement[${index}] item URL is not absolute`);
    } else if (typeof target === "object") {
      const id = (target as Record<string, unknown>)["@id"];
      if (!isAbsoluteUrl(id)) issues.push(`itemListElement[${index}] item @id is not an absolute URL`);
    }
  });

  const sorted = [...positions].sort((a, b) => a - b);
  const expected = positions.length > 0 && sorted.every((value, index) => value === index + 1);
  if (positions.length && !expected) {
    issues.push(`Breadcrumb positions are not sequential starting at 1 (got ${sorted.join(", ")})`);
  }

  return issues;
}

function validateNode(node: Record<string, unknown>, hasContext: boolean): SchemaBlockResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const types = typeNames(node);

  if (!hasContext) errors.push("Missing @context");
  if (!types.length) errors.push("Missing @type");

  for (const type of types) {
    const required = REQUIRED_PROPERTIES[type];
    if (!required) {
      if (!SUPPORTED_TYPES.has(type)) warnings.push(`Type "${type}" is not validated by this engine`);
      continue;
    }
    for (const property of required) {
      const value = node[property];
      const isEmpty =
        value == null ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) errors.push(`${type} is missing required property "${property}"`);
    }
    if (type === "BreadcrumbList") errors.push(...validateBreadcrumb(node));
  }

  return { types, valid: errors.length === 0, errors, warnings };
}

function collectNodes(parsed: unknown, hasContext: boolean): Array<{ node: Record<string, unknown>; hasContext: boolean }> {
  const nodes: Array<{ node: Record<string, unknown>; hasContext: boolean }> = [];

  const visit = (value: unknown, inheritedContext: boolean) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, inheritedContext);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const node = value as Record<string, unknown>;
    const ownContext = inheritedContext || node["@context"] != null;
    const graph = node["@graph"];
    if (graph != null) {
      visit(graph, ownContext);
      if (typeNames(node).length === 0) return;
    }
    nodes.push({ node, hasContext: ownContext });
  };

  visit(parsed, hasContext);
  return nodes;
}

export function validateJsonLdBlocks(blocks: string[]): SchemaValidationResult {
  const results: SchemaBlockResult[] = [];
  let invalidJsonCount = 0;

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch (error) {
      invalidJsonCount += 1;
      results.push({
        types: [],
        valid: false,
        errors: [`Invalid JSON-LD: ${error instanceof Error ? error.message : "parse error"}`],
        warnings: [],
      });
      continue;
    }

    const nodes = collectNodes(parsed, false);
    if (!nodes.length) {
      results.push({ types: [], valid: false, errors: ["JSON-LD block contains no schema objects"], warnings: [] });
      continue;
    }
    for (const { node, hasContext } of nodes) {
      results.push(validateNode(node, hasContext));
    }
  }

  const types = results.flatMap((result) => result.types);
  const typeCounts = new Map<string, number>();
  for (const type of types) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  const duplicateTypes = [...typeCounts.entries()]
    .filter(([type, count]) => count > 1 && type !== "ListItem" && type !== "Question" && type !== "Answer")
    .map(([type]) => type);

  const breadcrumbBlocks = results.filter((result) => result.types.includes("BreadcrumbList"));
  const breadcrumbIssues = breadcrumbBlocks.flatMap((result) => result.errors);

  return {
    blocks: results,
    types: [...new Set(types)],
    duplicateTypes,
    invalidJsonCount,
    hasBreadcrumb: breadcrumbBlocks.length > 0,
    breadcrumbValid: breadcrumbBlocks.length ? breadcrumbBlocks.every((result) => result.valid) : null,
    breadcrumbIssues,
    allValid: results.length ? results.every((result) => result.valid) : null,
  };
}
