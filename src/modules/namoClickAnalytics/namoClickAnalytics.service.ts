import { Types } from "mongoose";
import { NamoClickAnalytics } from "../../models/namoClickAnalytics.model";

export async function create(organisationId: string, iconName: string, ipAddress: string) {
  return NamoClickAnalytics.create({ organisationId, iconName, ipAddress });
}

const ICONS = ["whatsapp", "facebook", "instagram", "twitter", "linkedin", "youtube"] as const;

export async function getStats(organisationId: string) {
  // Aggregate pipelines don't auto-cast query values the way find()/findOne() do — the
  // organisationId string must be cast to ObjectId explicitly or $match matches nothing.
  const grouped = await NamoClickAnalytics.aggregate<{ _id: string; count: number }>([
    { $match: { organisationId: new Types.ObjectId(organisationId) } },
    { $group: { _id: "$iconName", count: { $sum: 1 } } },
  ]);
  const countByIcon = new Map(grouped.map((g) => [g._id, g.count]));
  const stats: Record<string, number> = { total: 0 };
  for (const icon of ICONS) stats[icon] = countByIcon.get(icon) ?? 0;
  stats.total = grouped.reduce((sum, g) => sum + g.count, 0);

  const logs = await NamoClickAnalytics.find({ organisationId }).sort({ clickedAt: -1 }).limit(100);
  return { stats, logs };
}
