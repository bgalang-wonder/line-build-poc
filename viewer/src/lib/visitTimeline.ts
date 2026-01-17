import type { Step, StationVisit, TrackTimeline } from "@/types";

const DEFAULT_TRACK = "default";

function normalizeTrackId(step: Step): string {
  return step.trackId && step.trackId.trim().length > 0 ? step.trackId : DEFAULT_TRACK;
}

function normalizeStationId(step: Step): string {
  return step.stationId && step.stationId.trim().length > 0 ? step.stationId : "other";
}

export function groupStepsIntoVisits(steps: Step[]): TrackTimeline[] {
  const sortedSteps = [...steps].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.id.localeCompare(b.id);
  });

  const stepsByTrack = new Map<string, Step[]>();
  for (const step of sortedSteps) {
    const trackId = normalizeTrackId(step);
    if (!stepsByTrack.has(trackId)) stepsByTrack.set(trackId, []);
    stepsByTrack.get(trackId)!.push(step);
  }

  const timelines: TrackTimeline[] = [];

  for (const [trackId, trackSteps] of Array.from(stepsByTrack.entries())) {
    let currentStation = "";
    let visitIndex = -1;
    let globalIndex = 0;
    const stationVisitCounts = new Map<string, number>();
    const visits: StationVisit[] = [];

    for (const step of trackSteps) {
      const stationId = normalizeStationId(step);
      const stationChanged = stationId !== currentStation;

      if (stationChanged) {
        currentStation = stationId;
        visitIndex = visits.length;
        const nextVisitNumber = (stationVisitCounts.get(stationId) ?? 0) + 1;
        stationVisitCounts.set(stationId, nextVisitNumber);

        visits.push({
          id: `visit:${trackId}:${stationId}:${nextVisitNumber}`,
          trackId,
          stationId,
          visitNumber: nextVisitNumber,
          globalVisitIndex: globalIndex,
          steps: [],
          stepRange: [step.orderIndex, step.orderIndex],
          stepIdRange: [step.id, step.id],
          primaryActions: [],
        });

        globalIndex += 1;
      }

      const visit = visits[visitIndex];
      visit.steps.push(step);
      visit.stepRange[0] = Math.min(visit.stepRange[0], step.orderIndex);
      visit.stepRange[1] = Math.max(visit.stepRange[1], step.orderIndex);

      const actionFamily = step.action?.family;
      if (actionFamily && !visit.primaryActions.includes(actionFamily)) {
        visit.primaryActions.push(actionFamily);
      }
    }

    const firstOrderIndex = trackSteps[0]?.orderIndex ?? Number.MAX_SAFE_INTEGER;
    for (const visit of visits) {
      const firstStep = visit.steps[0];
      const lastStep = visit.steps[visit.steps.length - 1];
      if (firstStep && lastStep) {
        visit.stepIdRange = [firstStep.id, lastStep.id];
      }
    }
    timelines.push({ trackId, visits, firstOrderIndex });
  }

  timelines.sort((a, b) => a.firstOrderIndex - b.firstOrderIndex || a.trackId.localeCompare(b.trackId));
  return timelines;
}
