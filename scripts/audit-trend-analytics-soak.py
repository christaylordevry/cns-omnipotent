#!/usr/bin/env python3
"""Audit trend analytics cron soak from JSONL pass log (Story 45-7)."""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Hourly cron (60m): freshness = period + 15m slack; gap = period + one missed pass (30m).
SCORE_FRESHNESS_MAX_MINUTES = 75
COMPUTED_AT_GAP_MAX_MINUTES = 90


@dataclass(frozen=True)
class SoakReport:
    topics_tracked: int
    topics_scored: int
    max_gap_minutes: float
    stale_topics: tuple[str, ...]
    fresh_at_check: bool


def _default_log_path() -> Path:
    import os

    override = os.environ.get("TREND_ANALYTICS_LOG", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "logs" / "trend-analytics.log"


def _parse_ts(value: str) -> datetime | None:
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _load_json_lines(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not path.is_file():
        return records
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line.startswith("{"):
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            records.append(payload)
    return records


def _records_in_window(
    records: list[dict[str, Any]],
    *,
    since: datetime,
    until: datetime,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for record in records:
        ts_raw = record.get("ts")
        if not isinstance(ts_raw, str):
            continue
        ts = _parse_ts(ts_raw)
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if since <= ts <= until:
            out.append(record)
    return out


def _finite_epoch_ms(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return int(value)
    return None


def _pass_timestamps_by_topic(records: list[dict[str, Any]]) -> dict[str, list[int]]:
    by_topic: dict[str, list[int]] = {}
    for record in records:
        if record.get("outcome") != "ok":
            continue
        topics = record.get("topics")
        if not isinstance(topics, list):
            continue
        pass_ms = 0
        ts_raw = record.get("ts")
        if isinstance(ts_raw, str):
            ts = _parse_ts(ts_raw)
            if ts is not None:
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                pass_ms = int(ts.timestamp() * 1000)
        for entry in topics:
            if not isinstance(entry, dict):
                continue
            slug = entry.get("topicSlug")
            if not isinstance(slug, str):
                continue
            if not entry.get("scored"):
                continue
            computed_ms = _finite_epoch_ms(entry.get("computedAt"))
            ts_ms = computed_ms if computed_ms is not None else pass_ms
            by_topic.setdefault(slug, []).append(ts_ms)
    return by_topic


def _latest_computed_at_by_topic(records: list[dict[str, Any]]) -> dict[str, int]:
    latest: dict[str, int] = {}
    for slug, timestamps in _pass_timestamps_by_topic(records).items():
        if timestamps:
            latest[slug] = max(timestamps)
    return latest


def max_computed_at_gap_minutes(timestamps_ms: list[int]) -> float:
    sorted_ts = sorted(
        int(t) for t in timestamps_ms if isinstance(t, (int, float)) and math.isfinite(t)
    )
    if len(sorted_ts) < 2:
        return 0.0
    max_gap = 0.0
    for i in range(1, len(sorted_ts)):
        gap = (sorted_ts[i] - sorted_ts[i - 1]) / 60_000
        if gap > max_gap:
            max_gap = gap
    return max_gap


def build_soak_report(
    records: list[dict[str, Any]],
    *,
    check_time: datetime,
    freshness_minutes: int = SCORE_FRESHNESS_MAX_MINUTES,
) -> SoakReport:
    by_topic = _pass_timestamps_by_topic(records)
    latest = _latest_computed_at_by_topic(records)
    check_ms = int(check_time.timestamp() * 1000)
    max_age_ms = freshness_minutes * 60_000

    max_gap = 0.0
    for timestamps in by_topic.values():
        gap = max_computed_at_gap_minutes(timestamps)
        if gap > max_gap:
            max_gap = gap

    stale: list[str] = []
    for slug, computed_at in latest.items():
        if check_ms - computed_at > max_age_ms:
            stale.append(slug)
    stale.sort()

    fresh = len(latest) > 0 and len(stale) == 0
    scored_count = sum(
        1
        for record in records
        if record.get("outcome") == "ok"
        for entry in (record.get("topics") or [])
        if isinstance(entry, dict) and entry.get("scored")
    )

    return SoakReport(
        topics_tracked=len(latest),
        topics_scored=scored_count,
        max_gap_minutes=max_gap,
        stale_topics=tuple(stale),
        fresh_at_check=fresh,
    )


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit trend analytics soak log (computedAt gaps and score freshness)."
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=None,
        help="Analytics pass JSONL log (default: TREND_ANALYTICS_LOG or ~/.hermes/logs/trend-analytics.log)",
    )
    parser.add_argument("--days", type=float, default=7.0, help="Rolling window in days")
    parser.add_argument(
        "--max-gap-minutes",
        type=float,
        default=COMPUTED_AT_GAP_MAX_MINUTES,
        help="Fail if any topic exceeds this max computedAt gap",
    )
    parser.add_argument(
        "--freshness-minutes",
        type=int,
        default=SCORE_FRESHNESS_MAX_MINUTES,
        help="Fail if latest score older than this at check time",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON summary")
    args = parser.parse_args(argv)

    if args.days <= 0:
        print("FATAL: --days must be positive", file=sys.stderr)
        return 2

    log_path = args.log if args.log is not None else _default_log_path()
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=args.days)
    windowed = _records_in_window(_load_json_lines(log_path), since=since, until=until)
    report = build_soak_report(
        windowed,
        check_time=until,
        freshness_minutes=args.freshness_minutes,
    )

    if args.json:
        print(
            json.dumps(
                {
                    "logPath": str(log_path),
                    "windowDays": args.days,
                    "topicsTracked": report.topics_tracked,
                    "topicsScored": report.topics_scored,
                    "maxGapMinutes": round(report.max_gap_minutes, 2),
                    "staleTopics": list(report.stale_topics),
                    "freshAtCheck": report.fresh_at_check,
                    "freshnessLimitMinutes": args.freshness_minutes,
                    "gapLimitMinutes": args.max_gap_minutes,
                },
                indent=2,
            )
        )
    else:
        print(f"log: {log_path}")
        print(f"window: {since.isoformat()} .. {until.isoformat()} ({args.days:g} days)")
        if not log_path.is_file():
            print("warning: log file missing — deploy cron and wait for passes", file=sys.stderr)
        print(f"topics_tracked={report.topics_tracked} scored_pass_entries={report.topics_scored}")
        print(f"max_computedAt_gap_minutes={report.max_gap_minutes:.1f} (limit {args.max_gap_minutes})")
        print(f"fresh_at_check={report.fresh_at_check} (limit {args.freshness_minutes} min)")
        if report.stale_topics:
            print(f"stale_topics: {', '.join(report.stale_topics)}")

    if report.max_gap_minutes > args.max_gap_minutes:
        print(
            f"FAIL: max gap {report.max_gap_minutes:.1f}m exceeds {args.max_gap_minutes}m",
            file=sys.stderr,
        )
        return 1
    if not report.fresh_at_check and report.topics_tracked > 0:
        print("FAIL: one or more topics have stale scores at check time", file=sys.stderr)
        return 1
    if report.topics_tracked == 0 and log_path.is_file():
        print("FAIL: no scored topics in window", file=sys.stderr)
        return 1
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
