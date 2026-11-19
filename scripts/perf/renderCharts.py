"""Draws the performance charts (SVG, no dependencies) from the committed measurement logs.

Inputs : docs/data/ios-suite.log, docs/data/android-suite.log, docs/data/android-windowed-emulator.json
Outputs: docs/media/chart-fps-by-scenario.svg, docs/media/chart-emulator-window-effect.svg
Usage  : python3 scripts/perf/renderCharts.py   (or: yarn perfCharts)
"""
import collections
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "data"
MEDIA = ROOT / "docs" / "media"
WARMUP_WINDOWS = 12
COLORS = {"ios": "#2f6fed", "android": "#2aa876", "windowed": "#d9534f", "text": "#1f2933", "grid": "#d0d5dd"}


def read_suite(path):
    scenarios = collections.OrderedDict()
    for line in path.read_text(errors="ignore").splitlines():
        match = re.search(r"\[perf:\w+\] (\{.*\})", line)
        if not match:
            continue
        report = json.loads(match.group(1))
        label = report.get("scenario") or ""
        if not label or label == "suite-finished" or report.get("windowInScenario", 0) <= WARMUP_WINDOWS:
            continue
        scenarios.setdefault(label, []).append(report)
    result = collections.OrderedDict()
    for label, reports in scenarios.items():
        frames = sum(r["frames"] for r in reports)
        result[label] = sum(r["averageFps"] * r["frames"] for r in reports) / frames
    return result


def grouped_bars(title, subtitle, labels, series, output):
    width, height, left, top, bottom = 900, 440, 60, 80, 90
    plot_h = height - top - bottom
    group_w = (width - left - 20) / len(labels)
    bar_w = group_w / (len(series) + 1)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" font-family="Helvetica,Arial,sans-serif">',
             f'<rect width="{width}" height="{height}" fill="white"/>',
             f'<text x="{left}" y="30" font-size="20" font-weight="bold" fill="{COLORS["text"]}">{title}</text>',
             f'<text x="{left}" y="52" font-size="13" fill="#52606d">{subtitle}</text>']
    for tick in range(0, 61, 15):
        y = top + plot_h - plot_h * tick / 60
        parts.append(f'<line x1="{left}" x2="{width - 20}" y1="{y}" y2="{y}" stroke="{COLORS["grid"]}"/>')
        parts.append(f'<text x="{left - 8}" y="{y + 4}" font-size="12" text-anchor="end" fill="{COLORS["text"]}">{tick}</text>')
    y60 = top + plot_h - plot_h
    parts.append(f'<line x1="{left}" x2="{width - 20}" y1="{y60}" y2="{y60}" stroke="#111" stroke-dasharray="6 4"/>')
    parts.append(f'<text x="{width - 24}" y="{y60 - 24}" font-size="12" text-anchor="end" fill="#111">60 fps target</text>')
    for group_index, label in enumerate(labels):
        x0 = left + group_index * group_w + bar_w / 2
        for series_index, (name, color, values) in enumerate(series):
            value = values[group_index]
            bar_h = plot_h * value / 60
            x = x0 + series_index * bar_w
            y = top + plot_h - bar_h
            parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w - 4:.1f}" height="{bar_h:.1f}" fill="{color}"/>')
            parts.append(f'<text x="{x + (bar_w - 4) / 2:.1f}" y="{y - 5:.1f}" font-size="12" text-anchor="middle" fill="{COLORS["text"]}">{value:.1f}</text>')
        parts.append(f'<text x="{x0 + group_w / 2 - bar_w / 2:.1f}" y="{top + plot_h + 22}" font-size="12" text-anchor="middle" fill="{COLORS["text"]}">{label}</text>')
    for series_index, (name, color, _values) in enumerate(series):
        lx = left + series_index * 260
        parts.append(f'<rect x="{lx}" y="{height - 30}" width="14" height="14" fill="{color}"/>')
        parts.append(f'<text x="{lx + 20}" y="{height - 18}" font-size="13" fill="{COLORS["text"]}">{name}</text>')
    parts.append("</svg>")
    output.write_text("\n".join(parts))
    print("wrote", output.relative_to(ROOT))


ios = read_suite(DATA / "ios-suite.log")
android = read_suite(DATA / "android-suite.log")
windowed = json.loads((DATA / "android-windowed-emulator.json").read_text())
labels = [label.replace(" | ", "\n").split("\n")[0] + " " + label.split(" | ")[1] for label in ios]
labels = [label.replace("1 boxes", "1 box").replace("boxes ", "boxes · ") for label in labels]

grouped_bars("Average FPS per scenario", "Release builds, 30 s per scenario, one platform measured at a time",
             labels, [("iOS Simulator", COLORS["ios"], list(ios.values())), ("Android Emulator (headless)", COLORS["android"], list(android.values()))],
             MEDIA / "chart-fps-by-scenario.svg")
grouped_bars("Why Android looked slow: the emulator window", "Same app, same build — only the way the emulator is started changes",
             labels, [("Emulator with window (default)", COLORS["windowed"], windowed["averageFps"]), ("Emulator headless (-no-window)", COLORS["android"], list(android.values()))],
             MEDIA / "chart-emulator-window-effect.svg")
