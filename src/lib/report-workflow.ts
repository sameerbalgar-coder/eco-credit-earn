export interface NearbyReport {
  id: string;
  waste_type: string;
  status: string;
  upvote_count: number;
  distance_m: number;
}

export function matchingNearbyReport(reports: NearbyReport[], category: string | null) {
  // Generic hazards can be different incidents at the same spot.
  if (!category || category === "hazardous") return null;
  return reports.find((report) => report.waste_type === category &&
    ["pending", "assigned", "in_progress"].includes(report.status)) ?? null;
}