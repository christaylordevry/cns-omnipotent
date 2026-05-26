#!/usr/bin/env python3
"""Audit trend ingest cron reliability from structured JSON log lines (Epic 44 / NFR-R1)."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SOURCE_SCHEDULE_MINUTES: dict[str, int] = {
    "news": 15,
    "reddit": 15,
    "google_trends": 60,
}

FRESHNESS_LIMIT_MINUTES: dict[str, int] = {
    "news": 30,
    "reddit": 30,
    "google_trends": 120,
}

DEFAULT_SOURCES = tuple(SOURCE_SCHEDULE_MINUTES.keys())


@dataclass(frozen=True)
class SourceReport:
    source: str
    expected_runs: int
    actual_runs: int
    success_runs: int
    error_runs: int
    success_rate: float
    missed_slots: int

    @property
    def meets_threshold(self) -> bool:
        if self.expected_runs <= 0:
            return True
        return self.success_rate >= 0.95


def _default_log_path() -> Path:
    import os

    override = os.environ.get("TREND_INGEST_LOG", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "logs" / "trend-ingest.log"


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


def _active_source_key(record: dict[str, Any]) -> str | None:
    sources = record.get("activeSources")
    if not isinstance(sources, list) or len(sources) != 1:
        return None
    name = sources[0]
    return name if isinstance(name, str) else None


def _coerce_http_status(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def is_successful_run(record: dict[str, Any]) -> bool:
    outcome = record.get("outcome")
    if outcome == "watchlist_only":
        return True
    if outcome != "ok":
        return False
    if "httpStatus" not in record:
        return True
    raw_http = record.get("httpStatus")
    if raw_http is None:
        return True
    http_status = _coerce_http_status(raw_http)
    if http_status is None:
        return False
    return http_status == 200


def expected_runs_for_window(days: float, interval_minutes: int) -> int:
    if days <= 0 or interval_minutes <= 0:
        return 0
    return int((days * 24 * 60) / interval_minutes)


def audit_source(
    records: list[dict[str, Any]],
    source: str,
    *,
    days: float,
) -> SourceReport:
    interval = SOURCE_SCHEDULE_MINUTES[source]
    expected = expected_runs_for_window(days, interval)
    source_records = [r for r in records if _active_source_key(r) == source]
    actual = len(source_records)
    success = sum(1 for r in source_records if is_successful_run(r))
    errors = sum(
        1
        for r in source_records
        if r.get("outcome") == "error"
    )
    rate = min((success / expected) if expected > 0 else 1.0, 1.0)
    missed = max(0, expected - actual)
    return SourceReport(
        source=source,
        expected_runs=expected,
        actual_runs=actual,
        success_runs=success,
        error_runs=errors,
        success_rate=rate,
        missed_slots=missed,
    )


def build_reports(
    records: list[dict[str, Any]],
    *,
    days: float,
    sources: tuple[str, ...] = DEFAULT_SOURCES,
) -> list[SourceReport]:
    return [audit_source(records, name, days=days) for name in sources]


def format_report(report: SourceReport, *, days: float) -> str:
    pct = report.success_rate * 100.0
    fresh = FRESHNESS_LIMIT_MINUTES[report.source]
    return (
        f"{report.source}: success_rate={pct:.1f}% "
        f"({report.success_runs}/{report.expected_runs} expected over {days:g}d) "
        f"actual_runs={report.actual_runs} errors={report.error_runs} "
        f"missed_slots={report.missed_slots} "
        f"nfr_r5_freshness_limit={fresh}min"
    )


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit trend ingest cron reliability from structured JSON log lines."
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=None,
        help="Ingest log path (default: TREND_INGEST_LOG or ~/.hermes/logs/trend-ingest.log)",
    )
    parser.add_argument(
        "--days",
        type=float,
        default=7.0,
        help="Rolling window in days (default: 7)",
    )
    parser.add_argument(
        "--fail-under",
        type=float,
        default=0.95,
        help="Exit 1 if any source success_rate is below this threshold (default: 0.95)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON summary on stdout",
    )
    args = parser.parse_args(argv)

    if args.days <= 0:
        print("FATAL: --days must be positive", file=sys.stderr)
        return 2

    log_path = args.log if args.log is not None else _default_log_path()
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=args.days)

    records = _load_json_lines(log_path)
    windowed = _records_in_window(records, since=since, until=until)
    reports = build_reports(windowed, days=args.days)

    if args.json:
        payload = {
            "logPath": str(log_path),
            "windowDays": args.days,
            "since": since.isoformat(),
            "until": until.isoformat(),
            "sources": [
                {
                    "source": r.source,
                    "expectedRuns": r.expected_runs,
                    "actualRuns": r.actual_runs,
                    "successRuns": r.success_runs,
                    "errorRuns": r.error_runs,
                    "successRate": round(r.success_rate, 4),
                    "missedSlots": r.missed_slots,
                    "freshnessLimitMinutes": FRESHNESS_LIMIT_MINUTES[r.source],
                }
                for r in reports
            ],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(f"log: {log_path}")
        print(f"window: {since.isoformat()} .. {until.isoformat()} ({args.days:g} days)")
        if not log_path.is_file():
            print("warning: log file missing — run cron or smoke ingest first", file=sys.stderr)
        for report in reports:
            print(format_report(report, days=args.days))
        print(
            "nfr_r5: verify trendTopics.lastUpdated on dashboard/Convex "
            "within freshness limits when source is healthy"
        )

    threshold = args.fail_under
    failed = [r for r in reports if r.success_rate < threshold]
    if failed:
        names = ", ".join(r.source for r in failed)
        print(
            f"FAIL: below {threshold * 100:.0f}% threshold: {names}",
            file=sys.stderr,
        )
        return 1
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
