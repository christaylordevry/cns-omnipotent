"""Tests for trend ingest reliability audit (Story 44-4-2)."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_SPEC = importlib.util.spec_from_file_location(
    "audit_trend_ingest_reliability",
    REPO_ROOT / "scripts" / "audit-trend-ingest-reliability.py",
)
assert _SPEC and _SPEC.loader
audit_mod = importlib.util.module_from_spec(_SPEC)
sys.modules["audit_trend_ingest_reliability"] = audit_mod
_SPEC.loader.exec_module(audit_mod)

audit_source = audit_mod.audit_source
build_reports = audit_mod.build_reports
expected_runs_for_window = audit_mod.expected_runs_for_window
is_successful_run = audit_mod.is_successful_run
run = audit_mod.run
_load_json_lines = audit_mod._load_json_lines
_records_in_window = audit_mod._records_in_window


class ReliabilityAuditTests(unittest.TestCase):
    def test_expected_runs_seven_days(self) -> None:
        self.assertEqual(expected_runs_for_window(7, 15), 672)
        self.assertEqual(expected_runs_for_window(7, 60), 168)

    def test_is_successful_run(self) -> None:
        self.assertTrue(is_successful_run({"outcome": "ok", "httpStatus": 200}))
        self.assertTrue(is_successful_run({"outcome": "ok", "httpStatus": "200"}))
        self.assertTrue(is_successful_run({"outcome": "ok"}))
        self.assertTrue(is_successful_run({"outcome": "watchlist_only"}))
        self.assertFalse(is_successful_run({"outcome": "error", "httpStatus": 503}))
        self.assertFalse(is_successful_run({"outcome": "ok", "httpStatus": 500}))
        self.assertFalse(is_successful_run({"outcome": "ok", "httpStatus": "n/a"}))

    def test_audit_source_counts_success_against_expected(self) -> None:
        now = datetime.now(timezone.utc)
        records = [
            {
                "ts": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "activeSources": ["news"],
                "outcome": "ok",
                "httpStatus": 200,
            },
            {
                "ts": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "activeSources": ["news"],
                "outcome": "error",
                "httpStatus": 503,
            },
        ]
        report = audit_source(records, "news", days=7)
        self.assertEqual(report.success_runs, 1)
        self.assertEqual(report.actual_runs, 2)
        self.assertEqual(report.expected_runs, 672)
        self.assertAlmostEqual(report.success_rate, 1 / 672)

    def test_build_reports_all_sources(self) -> None:
        now = datetime.now(timezone.utc)
        ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        records = [
            {"ts": ts, "activeSources": ["news"], "outcome": "ok", "httpStatus": 200},
            {"ts": ts, "activeSources": ["reddit"], "outcome": "ok"},
            {
                "ts": ts,
                "activeSources": ["google_trends"],
                "outcome": "watchlist_only",
            },
        ]
        reports = build_reports(records, days=7)
        self.assertEqual(len(reports), 3)
        self.assertEqual(reports[0].success_runs, 1)

    def test_load_json_lines_skips_non_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ingest.log"
            path.write_text(
                "cron stderr noise\n"
                '{"ts":"2026-05-26T12:00:00Z","activeSources":["news"],"outcome":"ok"}\n',
                encoding="utf-8",
            )
            lines = _load_json_lines(path)
        self.assertEqual(len(lines), 1)

    def test_records_in_window(self) -> None:
        now = datetime.now(timezone.utc)
        old = (now - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        recent = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        records = [
            {"ts": old, "activeSources": ["news"], "outcome": "ok"},
            {"ts": recent, "activeSources": ["news"], "outcome": "ok"},
        ]
        since = now - timedelta(days=7)
        windowed = _records_in_window(records, since=since, until=now)
        self.assertEqual(len(windowed), 1)

    def test_cli_json_exit_zero_on_high_rate_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "ingest.log"
            now = datetime.now(timezone.utc)
            ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
            lines: list[str] = []
            for source in ("news", "reddit", "google_trends"):
                for _ in range(100):
                    lines.append(
                        json.dumps(
                            {
                                "ts": ts,
                                "activeSources": [source],
                                "outcome": "ok",
                                "httpStatus": 200,
                            },
                            separators=(",", ":"),
                        )
                    )
            log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            code = run(
                [
                    "--log",
                    str(log_path),
                    "--days",
                    "1",
                    "--fail-under",
                    "0.95",
                    "--json",
                ]
            )
        self.assertEqual(code, 0)

    def test_cli_rejects_non_positive_days(self) -> None:
        self.assertEqual(run(["--days", "0"]), 2)
        self.assertEqual(run(["--days", "-1"]), 2)

    def test_cli_fails_below_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "ingest.log"
            now = datetime.now(timezone.utc)
            log_path.write_text(
                json.dumps(
                    {
                        "ts": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "activeSources": ["news"],
                        "outcome": "error",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            code = run(["--log", str(log_path), "--days", "7"])
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
