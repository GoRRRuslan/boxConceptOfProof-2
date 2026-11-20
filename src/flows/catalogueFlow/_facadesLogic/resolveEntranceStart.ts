// Sentinel: the entrance has not started (the boxes are invisible until it does).
export const ENTRANCE_NOT_STARTED = Number.MAX_SAFE_INTEGER

// The entrance starts with the first frame that has boxes to show (not when the model finishes
// loading: the first frames can take seconds, and the pop-in must not be spent on them).
export const resolveEntranceStart = (currentStart: number, nowMilliseconds: number, boxCount: number): number =>
  currentStart === ENTRANCE_NOT_STARTED && boxCount > 0 ? nowMilliseconds : currentStart
