import { describe, expect, it } from "vitest";
import { matchingNearbyReport } from "@/lib/report-workflow";

const report = { id: "report-1", waste_type: "plastic", status: "pending", upvote_count: 0, distance_m: 20 };
describe("same-area duplicate routing", () => {
  it("does not divert a different waste type into an existing report", () => {
    expect(matchingNearbyReport([report], "organic")).toBeNull();
  });
  it("matches an active same-type report for escalation or work-in-progress", () => {
    expect(matchingNearbyReport([{ ...report, status: "in_progress" }], "plastic")?.status).toBe("in_progress");
  });
  it("does not combine unrelated hazards", () => {
    expect(matchingNearbyReport([{ ...report, waste_type: "hazardous" }], "hazardous")).toBeNull();
  });
});