import type { CrawlEdge, CrawledPage } from "../crawler/crawler";

export interface GraphLinkRef {
  url: string;
  anchorText: string;
  isNofollow: boolean;
}

export interface GraphNode {
  normalized: string;
  depth: number | null;
  inLinks: number;
  outLinks: number;
  uniqueInLinks: number;
  uniqueOutLinks: number;
  isOrphan: boolean;
  isDeadEnd: boolean;
  incoming: GraphLinkRef[];
  outgoing: GraphLinkRef[];
}

export interface SiteGraph {
  nodes: Map<string, GraphNode>;
  genericAnchorUsage: Map<string, string[]>;
}

const GENERIC_ANCHORS = new Set([
  "click here",
  "read more",
  "learn more",
  "more",
  "here",
  "link",
  "this page",
  "continue",
  "view",
  "see more",
  "details",
]);

export function buildSiteGraph(pages: CrawledPage[], edges: CrawlEdge[], rootNormalized: string): SiteGraph {
  const known = new Set(pages.map((page) => page.normalizedUrl));
  const nodes = new Map<string, GraphNode>();

  for (const url of known) {
    nodes.set(url, {
      normalized: url,
      depth: null,
      inLinks: 0,
      outLinks: 0,
      uniqueInLinks: 0,
      uniqueOutLinks: 0,
      isOrphan: false,
      isDeadEnd: false,
      incoming: [],
      outgoing: [],
    });
  }

  const adjacency = new Map<string, Set<string>>();
  const uniqueIn = new Map<string, Set<string>>();
  const uniqueOut = new Map<string, Set<string>>();
  const genericAnchorUsage = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.isInternal) continue;
    if (edge.source === edge.target) continue;

    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);

    if (sourceNode) {
      sourceNode.outLinks += 1;
      if (sourceNode.outgoing.length < 300) {
        sourceNode.outgoing.push({ url: edge.target, anchorText: edge.anchorText, isNofollow: edge.isNofollow });
      }
      if (!uniqueOut.has(edge.source)) uniqueOut.set(edge.source, new Set());
      uniqueOut.get(edge.source)!.add(edge.target);
    }

    if (targetNode) {
      targetNode.inLinks += 1;
      if (targetNode.incoming.length < 300) {
        targetNode.incoming.push({ url: edge.source, anchorText: edge.anchorText, isNofollow: edge.isNofollow });
      }
      if (!uniqueIn.has(edge.target)) uniqueIn.set(edge.target, new Set());
      uniqueIn.get(edge.target)!.add(edge.source);
    }

    if (!edge.isNofollow && known.has(edge.target)) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      adjacency.get(edge.source)!.add(edge.target);
    }

    const anchor = edge.anchorText.trim().toLowerCase();
    if (anchor && GENERIC_ANCHORS.has(anchor)) {
      if (!genericAnchorUsage.has(anchor)) genericAnchorUsage.set(anchor, []);
      const list = genericAnchorUsage.get(anchor)!;
      if (list.length < 50) list.push(edge.source);
    }
  }

  const queue: string[] = [];
  if (nodes.has(rootNormalized)) {
    nodes.get(rootNormalized)!.depth = 0;
    queue.push(rootNormalized);
  }

  while (queue.length) {
    const current = queue.shift()!;
    const currentDepth = nodes.get(current)?.depth ?? 0;
    for (const neighbour of adjacency.get(current) ?? []) {
      const node = nodes.get(neighbour);
      if (!node || node.depth !== null) continue;
      node.depth = currentDepth + 1;
      queue.push(neighbour);
    }
  }

  for (const node of nodes.values()) {
    node.uniqueInLinks = uniqueIn.get(node.normalized)?.size ?? 0;
    node.uniqueOutLinks = uniqueOut.get(node.normalized)?.size ?? 0;
    node.isOrphan = node.normalized !== rootNormalized && node.uniqueInLinks === 0;
    node.isDeadEnd = node.uniqueOutLinks === 0;
  }

  return { nodes, genericAnchorUsage };
}
