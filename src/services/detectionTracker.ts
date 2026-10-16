/** Center-based box in the upright camera frame's pixel space. */
export type CloverDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type DetectionTrackerConfig = {
  requiredStreak: number;
  /** Smoothed confidence a track needs before it counts as found (candidates show below it). */
  minLockConfidence: number;
  maxMissedFrames: number;
  iouThreshold: number;
  smoothingFactor: number;
  maxTracks: number;
};

export type DetectionTrack = CloverDetectionBox & {
  id: string;
  streak: number;
  missedFrames: number;
  isStable: boolean;
};

export type DetectionTrackerState = {
  nextTrackId: number;
  tracks: DetectionTrack[];
};

export type DetectionTrackerSnapshot = {
  state: DetectionTrackerState;
  tracks: DetectionTrack[];
  stableTracks: DetectionTrack[];
  candidateTracks: DetectionTrack[];
};

type PairCandidate = {
  trackIndex: number;
  detectionIndex: number;
  score: number;
};

const TRACK_POOL_FACTOR = 2;

export function createDetectionTrackerState(): DetectionTrackerState {
  return {
    nextTrackId: 1,
    tracks: [],
  };
}

export function createEmptyDetectionTrackerSnapshot(): DetectionTrackerSnapshot {
  const state = createDetectionTrackerState();

  return {
    state,
    tracks: [],
    stableTracks: [],
    candidateTracks: [],
  };
}

function toBounds(box: CloverDetectionBox) {
  return {
    left: box.x - box.width / 2,
    top: box.y - box.height / 2,
    right: box.x + box.width / 2,
    bottom: box.y + box.height / 2,
  };
}

function computeIou(left: CloverDetectionBox, right: CloverDetectionBox) {
  const leftBounds = toBounds(left);
  const rightBounds = toBounds(right);
  const intersectionLeft = Math.max(leftBounds.left, rightBounds.left);
  const intersectionTop = Math.max(leftBounds.top, rightBounds.top);
  const intersectionRight = Math.min(leftBounds.right, rightBounds.right);
  const intersectionBottom = Math.min(leftBounds.bottom, rightBounds.bottom);
  const intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
  const intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea <= 0) {
    return 0;
  }

  const leftArea = left.width * left.height;
  const rightArea = right.width * right.height;
  const unionArea = leftArea + rightArea - intersectionArea;

  if (unionArea <= 0) {
    return 0;
  }

  return intersectionArea / unionArea;
}

function blend(previous: number, next: number, factor: number) {
  return previous + (next - previous) * factor;
}


function sortActiveTracks(left: DetectionTrack, right: DetectionTrack) {
  if (left.isStable !== right.isStable) {
    return Number(right.isStable) - Number(left.isStable);
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence;
  }

  return right.streak - left.streak;
}

function sortStateTracks(left: DetectionTrack, right: DetectionTrack) {
  if (left.missedFrames !== right.missedFrames) {
    return left.missedFrames - right.missedFrames;
  }

  return sortActiveTracks(left, right);
}

export function advanceDetectionTracker(
  state: DetectionTrackerState,
  detections: CloverDetectionBox[],
  config: DetectionTrackerConfig,
): DetectionTrackerSnapshot {
  const pairCandidates: PairCandidate[] = [];

  state.tracks.forEach((track, trackIndex) => {
    detections.forEach((detection, detectionIndex) => {
      const score = computeIou(track, detection);

      if (score >= config.iouThreshold) {
        pairCandidates.push({ trackIndex, detectionIndex, score });
      }
    });
  });

  pairCandidates.sort((left, right) => right.score - left.score);

  const usedTrackIndexes = new Set<number>();
  const usedDetectionIndexes = new Set<number>();
  const matches = new Map<number, CloverDetectionBox>();

  pairCandidates.forEach(({ trackIndex, detectionIndex }) => {
    if (
      usedTrackIndexes.has(trackIndex) ||
      usedDetectionIndexes.has(detectionIndex)
    ) {
      return;
    }

    usedTrackIndexes.add(trackIndex);
    usedDetectionIndexes.add(detectionIndex);
    matches.set(trackIndex, detections[detectionIndex]);
  });

  const nextTracks: DetectionTrack[] = [];

  state.tracks.forEach((track, trackIndex) => {
    const match = matches.get(trackIndex);

    if (match) {
      const streak = track.missedFrames === 0 ? track.streak + 1 : 1;
      const confidence = blend(track.confidence, match.confidence, config.smoothingFactor);

      nextTracks.push({
        id: track.id,
        x: blend(track.x, match.x, config.smoothingFactor),
        y: blend(track.y, match.y, config.smoothingFactor),
        width: blend(track.width, match.width, config.smoothingFactor),
        height: blend(track.height, match.height, config.smoothingFactor),
        confidence,
        streak,
        missedFrames: 0,
        isStable: streak >= config.requiredStreak && confidence >= config.minLockConfidence,
      });

      return;
    }

    const missedFrames = track.missedFrames + 1;

    if (missedFrames <= config.maxMissedFrames) {
      nextTracks.push({
        ...track,
        streak: 0,
        missedFrames,
        isStable: false,
      });
    }
  });

  let nextTrackId = state.nextTrackId;

  detections.forEach((detection, detectionIndex) => {
    if (usedDetectionIndexes.has(detectionIndex)) {
      return;
    }

    nextTracks.push({
      ...detection,
      id: `track-${nextTrackId}`,
      streak: 1,
      missedFrames: 0,
      isStable: config.requiredStreak <= 1 && detection.confidence >= config.minLockConfidence,
    });

    nextTrackId += 1;
  });

  const trackPoolLimit = Math.max(
    config.maxTracks,
    config.maxTracks * TRACK_POOL_FACTOR,
  );
  const prunedTracks = [...nextTracks]
    .sort(sortStateTracks)
    .slice(0, trackPoolLimit);
  const activeTracks = prunedTracks
    .filter((track) => track.missedFrames === 0)
    .sort(sortActiveTracks)
    .slice(0, config.maxTracks);
  const stableTracks = activeTracks.filter((track) => track.isStable);
  const candidateTracks = activeTracks.filter((track) => !track.isStable);
  const nextState: DetectionTrackerState = {
    nextTrackId,
    tracks: prunedTracks,
  };

  return {
    state: nextState,
    tracks: activeTracks,
    stableTracks,
    candidateTracks,
  };
}
