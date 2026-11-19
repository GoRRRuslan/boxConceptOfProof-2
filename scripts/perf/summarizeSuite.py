"""Per-scenario table from the benchmark suite's tagged FPS reports.

Input: a log with lines like  [perf:<platform>] {"frames":60,"averageFps":..,"scenario":"16 boxes | full","windowInScenario":7,...}
The first WARMUP windows of every scenario are ignored (shader compilation / model load).
Usage: summarizeSuite.py <logFile> [warmupWindows=12]
"""
import collections
import json
import re
import sys

log_path = sys.argv[1]
warmup_windows = int(sys.argv[2]) if len(sys.argv) > 2 else 12
scenarios = collections.OrderedDict()

for line in open(log_path, errors="ignore"):
    match = re.search(r"\[perf:\w+\] (\{.*\})", line)
    if not match:
        continue
    report = json.loads(match.group(1))
    label = report.get("scenario") or ""
    if not label or label == "suite-finished" or report.get("windowInScenario", 0) <= warmup_windows:
        continue
    scenarios.setdefault(label, []).append(report)

if not scenarios:
    print("no suite samples (was the app built with EXPO_PUBLIC_AUTO_BENCHMARK=suite?)")
    sys.exit(1)

print(f"{'scenario':26} {'windows':>7} {'avg fps':>8} {'min fps':>8} {'p95 ms':>7} {'worst ms':>9} {'slow':>6}")
for label, reports in scenarios.items():
    frames = sum(r["frames"] for r in reports)
    slow = sum(r["slowFrames"] for r in reports)
    average_fps = sum(r["averageFps"] * r["frames"] for r in reports) / frames
    min_fps = min(r["averageFps"] for r in reports)
    p95 = sorted(r["p95FrameMilliseconds"] for r in reports)[max(0, int(len(reports) * 0.95) - 1)]
    worst = max(r["maxFrameMilliseconds"] for r in reports)
    print(f"{label:26} {len(reports):7} {average_fps:8.1f} {min_fps:8.1f} {p95:7.1f} {worst:9.0f} {100 * slow / frames:5.1f}%")
