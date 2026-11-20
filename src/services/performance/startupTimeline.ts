// Marks the startup milestones (app start, list visible, model loaded, first frame with boxes) and
// reports the time since app start once, for the numbers in docs/PERFORMANCE.md.
export enum EStartupMark {
  AppStart = 'appStart',
  ListVisible = 'listVisible',
  ModelLoaded = 'modelLoaded',
  FirstBoxFrame = 'firstBoxFrame',
}

const PERF_SINK_URL: string | undefined = process.env.EXPO_PUBLIC_PERF_SINK_URL
const marks = new Map<EStartupMark, number>()

export const markStartup = (mark: EStartupMark): void => {
  if (marks.has(mark)) {
    return
  }

  marks.set(mark, Date.now())

  const appStart = marks.get(EStartupMark.AppStart) ?? Date.now()
  const report = { startup: mark, millisecondsSinceAppStart: Date.now() - appStart }

  console.info(`[startup] ${JSON.stringify(report)}`)

  if (PERF_SINK_URL) {
    fetch(PERF_SINK_URL, { method: 'POST', body: JSON.stringify(report) }).catch(() => undefined)
  }
}
