"""Tests for trend analytics soak audit (Story 45-7)."""

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
    "audit_trend_analytics_soak",
    REPO_ROOT / "scripts" / "audit-trend-analytics-soak.py",
)
assert _SPEC and _SPEC.loader
soak_mod = importlib.util.module_from_spec(_SPEC)
sys.modules["audit_trend_analytics_soak"] = soak_mod
_SPEC.loader.exec_module(soak_mod)

build_soak_report = soak_mod.build_soak_report
max_computed_at_gap_minutes = soak_mod.max_computed_at_gap_minutes
run = soak_mod.run


class AnalyticsSoakAuditTests(unittest.TestCase):
    def test_max_gap_minutes(self) -> None:
        base = 1_700_000_000_000
        gap = max_computed_at_gap_minutes([base, base + 120 * 60_000])
        self.assertAlmostEqual(gap, 120.0)

    def test_pass_timestamps_ignores_non_finite_computed_at(self) -> None:
        pass_ms = 1_700_000_000_000
        ts = datetime.fromtimestamp(pass_ms / 1000, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )
        records = [
            {
                "ts": ts,
                "outcome": "ok",
                "topics": [
                    {"topicSlug": "a", "computedAt": float("nan"), "scored": True},
                    {"topicSlug": "a", "computedAt": pass_ms, "scored": True},
                ],
            }
        ]
        by_topic = soak_mod._pass_timestamps_by_topic(records)
        self.assertEqual(by_topic["a"], [pass_ms, pass_ms])

    def test_build_soak_report_fresh_scores(self) -> None:
        now = datetime.now(timezone.utc)
        ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        computed = int(now.timestamp() * 1000) - 30 * 60_000
        records = [
            {
                "ts": ts,
                "outcome": "ok",
                "topics": [
                    {"topicSlug": "alpha", "computedAt": computed, "scored": True},
                    {"topicSlug": "beta", "computedAt": computed, "scored": True},
                ],
            }
        ]
        report = build_soak_report(records, check_time=now)
        self.assertTrue(report.fresh_at_check)
        self.assertEqual(report.topics_tracked, 2)
        self.assertLessEqual(report.max_gap_minutes, 90)

    def test_build_soak_report_detects_stale(self) -> None:
        now = datetime.now(timezone.utc)
        ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        stale_computed = int((now - timedelta(hours=2)).timestamp() * 1000)
        records = [
            {
                "ts": ts,
                "outcome": "ok",
                "topics": [{"topicSlug": "alpha", "computedAt": stale_computed, "scored": True}],
            }
        ]
        report = build_soak_report(records, check_time=now)
        self.assertFalse(report.fresh_at_check)
        self.assertIn("alpha", report.stale_topics)

    def test_run_fails_on_large_gap(self) -> None:
        now = datetime.now(timezone.utc)
        old = now - timedelta(hours=3)
        records = [
            {
                "ts": old.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "outcome": "ok",
                "topics": [{"topicSlug": "a", "computedAt": int(old.timestamp() * 1000), "scored": True}],
            },
            {
                "ts": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "outcome": "ok",
                "topics": [{"topicSlug": "a", "computedAt": int(now.timestamp() * 1000), "scored": True}],
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as fh:
            for record in records:
                fh.write(json.dumps(record) + "\n")
            path = Path(fh.name)
        try:
            code = run(["--log", str(path), "--days", "1", "--max-gap-minutes", "90"])
            self.assertEqual(code, 1)
        finally:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
