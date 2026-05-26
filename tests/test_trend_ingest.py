#!/usr/bin/env python3
"""Unit tests for scripts/trend-ingest.py (Stories 44-2-1, 44-2-2, 44-3-1, 44-3-2)."""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import importlib.util

REPO_ROOT = Path(__file__).resolve().parents[1]

try:
    import yaml as _yaml
except ImportError:
    _yaml = None

_SPEC = importlib.util.spec_from_file_location(
    "trend_ingest",
    REPO_ROOT / "scripts" / "trend-ingest.py",
)
assert _SPEC and _SPEC.loader
trend_ingest = importlib.util.module_from_spec(_SPEC)
sys.modules["trend_ingest"] = trend_ingest
_SPEC.loader.exec_module(trend_ingest)

build_batch = trend_ingest.build_batch
load_watchlist_snapshot = trend_ingest.load_watchlist_snapshot
parse_sources_arg = trend_ingest.parse_sources_arg
run = trend_ingest.run
topic_slug = trend_ingest.topic_slug

pytest_yaml = _yaml is not None


@unittest.skipUnless(_yaml is not None, "PyYAML required")
class TopicSlugTests(unittest.TestCase):
    def test_c9_normalisation(self) -> None:
        self.assertEqual(topic_slug("  AI Agents!!  "), "ai-agents")
        self.assertEqual(topic_slug("Obsidian   AI plugins"), "obsidian-ai-plugins")

    def test_collapses_hyphens_and_caps_length(self) -> None:
        long_kw = "x" * 100
        slug = topic_slug(long_kw)
        self.assertLessEqual(len(slug), 80)

    def test_empty_keyword_raises(self) -> None:
        with self.assertRaises(ValueError):
            topic_slug("   ")


@unittest.skipUnless(_yaml is not None, "PyYAML required")
class WatchlistLoadTests(unittest.TestCase):
    def test_valid_yaml_object_and_string_entries(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write(
                "version: 1\nkeywords:\n"
                "  - keyword: AI agents\n    region: global\n"
                "  - Obsidian plugins\n"
            )
            path = Path(f.name)
        try:
            entries = load_watchlist_snapshot(path, 1_746_000_000_000)
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0].topic_slug, "ai-agents")
            self.assertEqual(entries[1].region, "global")
        finally:
            path.unlink()

    def test_rejects_duplicate_slugs(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("version: 1\nkeywords:\n  - AI Agents\n  - ai agents\n")
            path = Path(f.name)
        try:
            with self.assertRaises(ValueError) as ctx:
                load_watchlist_snapshot(path, 0)
            self.assertIn("duplicate topicSlug", str(ctx.exception))
        finally:
            path.unlink()

    def test_rejects_control_chars(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write('version: 1\nkeywords:\n  - "bad\x01word"\n')
            path = Path(f.name)
        try:
            with self.assertRaises((ValueError, _yaml.YAMLError)):
                load_watchlist_snapshot(path, 0)
        finally:
            path.unlink()

    def test_missing_file_returns_empty(self) -> None:
        entries = load_watchlist_snapshot(Path("/nonexistent/watchlist.yaml"), 0)
        self.assertEqual(entries, [])

    def test_rejects_unsupported_version(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("version: 2\nkeywords:\n  - kw\n")
            path = Path(f.name)
        try:
            with self.assertRaises(ValueError) as ctx:
                load_watchlist_snapshot(path, 0)
            self.assertIn("unsupported watchlist version", str(ctx.exception))
        finally:
            path.unlink()

    def test_rejects_missing_keywords_key(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("version: 1\n")
            path = Path(f.name)
        try:
            with self.assertRaises(ValueError) as ctx:
                load_watchlist_snapshot(path, 0)
            self.assertIn("missing 'keywords'", str(ctx.exception))
        finally:
            path.unlink()

    def test_rejects_keyword_over_max_length(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write(f"version: 1\nkeywords:\n  - {'x' * 201}\n")
            path = Path(f.name)
        try:
            with self.assertRaises(ValueError) as ctx:
                load_watchlist_snapshot(path, 0)
            self.assertIn("exceeds 200", str(ctx.exception))
        finally:
            path.unlink()

    def test_rejects_invalid_region(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("version: 1\nkeywords:\n  - keyword: kw\n    region: US East\n")
            path = Path(f.name)
        try:
            with self.assertRaises(ValueError) as ctx:
                load_watchlist_snapshot(path, 0)
            self.assertIn("invalid region", str(ctx.exception))
        finally:
            path.unlink()

    def test_empty_keywords_list_returns_empty(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("version: 1\nkeywords: []\n")
            path = Path(f.name)
        try:
            entries = load_watchlist_snapshot(path, 0)
            self.assertEqual(entries, [])
        finally:
            path.unlink()


@unittest.skipUnless(_yaml is not None, "PyYAML required")
class CliTests(unittest.TestCase):
    def _run_dry_run_patched(
        self,
        watchlist_path: Path,
        env_dir: Path,
        extra_argv: list[str] | None = None,
    ) -> tuple[int, str]:
        from io import StringIO

        argv = ["--dry-run", *(extra_argv or [])]
        buf = StringIO()
        with patch.object(trend_ingest, "_default_watchlist_path", return_value=watchlist_path):
            with patch.object(
                trend_ingest,
                "_default_ingest_env_path",
                return_value=env_dir / "missing.env",
            ):
                with patch("sys.stdout", buf):
                    code = run(argv)
        return code, buf.getvalue()

    def test_empty_watchlist_exits_zero_no_stdout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "empty.yaml"
            wl.write_text("", encoding="utf-8")
            code, out = self._run_dry_run_patched(wl, Path(tmp))
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_empty_keywords_list_exits_zero_no_stdout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords: []\n", encoding="utf-8")
            code, out = self._run_dry_run_patched(wl, Path(tmp))
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_dry_run_json_shape(self) -> None:
        reddit_patch = trend_ingest.build_signal_source_patch(
            "reddit",
            status="ok",
            last_run_ms=1,
            error_count=0,
            last_error=None,
        )
        news_patch = trend_ingest.build_signal_source_patch(
            "news",
            status="ok",
            last_run_ms=1,
            error_count=0,
            last_error=None,
        )
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - test topic\n", encoding="utf-8")
            cache_path = Path(tmp) / "cache.json"
            with patch.object(trend_ingest, "_default_norm_cache_path", return_value=cache_path):
                with patch.object(trend_ingest, "_praw", object()):
                    with patch.object(
                        trend_ingest,
                        "collect_reddit",
                        return_value=([], reddit_patch),
                    ):
                        with patch.object(
                            trend_ingest,
                            "collect_news",
                            return_value=([], news_patch),
                        ):
                            code, out = self._run_dry_run_patched(
                                wl,
                                Path(tmp),
                                extra_argv=["--sources", "news,reddit"],
                            )
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertIn("ingestRunId", payload)
        self.assertEqual(payload["activeSources"], ["news", "reddit"])
        self.assertEqual(payload["events"], [])
        self.assertEqual(len(payload["signalSources"]), 2)
        self.assertEqual(len(payload["watchlist"]), 1)
        self.assertEqual(payload["watchlist"][0]["topicSlug"], "test-topic")

    def test_dry_run_includes_google_trends_events_when_sourced(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        fake_event = trend_ingest.build_google_trends_event(
            WatchlistEntry("test-topic", "test topic", "global", 1),
            interest=55,
            ingest_run_id="run-1",
            collected_at_ms=1_746_000_000_000,
        )
        fake_patch = trend_ingest.build_google_trends_source_patch(
            status="ok",
            last_run_ms=1_746_000_000_000,
            error_count=0,
            last_error=None,
        )
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - test topic\n", encoding="utf-8")
            with patch.object(trend_ingest, "_TrendReq", object()):
                with patch.object(
                    trend_ingest,
                    "collect_google_trends",
                    return_value=([fake_event], fake_patch),
                ):
                    code, out = self._run_dry_run_patched(
                        wl,
                        Path(tmp),
                        extra_argv=["--sources", "google_trends"],
                    )
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(payload["activeSources"], ["google_trends"])
        self.assertEqual(len(payload["events"]), 1)
        self.assertEqual(payload["signalSources"][0]["name"], "google_trends")

    def test_invalid_sources_fatal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - kw\n", encoding="utf-8")
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(
                    trend_ingest,
                    "_default_ingest_env_path",
                    return_value=Path(tmp) / "missing.env",
                ):
                    code = run(["--dry-run", "--sources", "bogus"])
        self.assertEqual(code, 1)

    def test_google_trends_without_pytrends_fatal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - test topic\n", encoding="utf-8")
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(
                    trend_ingest,
                    "_default_ingest_env_path",
                    return_value=Path(tmp) / "missing.env",
                ):
                    with patch.object(trend_ingest, "_TrendReq", None):
                        code = run(["--dry-run", "--sources", "google_trends"])
        self.assertEqual(code, 1)


class ParseSourcesTests(unittest.TestCase):
    def test_empty_sources(self) -> None:
        self.assertEqual(parse_sources_arg(None), [])
        self.assertEqual(parse_sources_arg(""), [])


class BatchWireTests(unittest.TestCase):
    def test_camel_case_keys(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry

        batch = build_batch(
            watchlist=[
                WatchlistEntry("slug-a", "Keyword", "global", 100),
            ],
            active_sources=[],
            ingest_run_id="550e8400-e29b-41d4-a716-446655440000",
        )
        wire = batch.to_wire_json()
        self.assertEqual(wire["ingestRunId"], "550e8400-e29b-41d4-a716-446655440000")
        self.assertEqual(wire["watchlist"][0]["addedAt"], 100)


class PushAndSecretTests(unittest.TestCase):
    def test_build_ingest_mutation_request(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry

        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=["news"],
            ingest_run_id="550e8400-e29b-41d4-a716-446655440000",
        )
        req = trend_ingest.build_ingest_mutation_request(batch)
        self.assertEqual(req["path"], "trends:ingestSignalBatch")
        self.assertEqual(req["format"], "json")
        self.assertEqual(req["args"]["batch"]["ingestRunId"], "550e8400-e29b-41d4-a716-446655440000")

    def test_secret_scan_aborts_on_openai_proj_key(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        secret_kw = "topic sk-proj-abcdefghijklmnopqrstuvwxyz123456"
        batch = build_batch(
            watchlist=[WatchlistEntry("topic-sk-proj", secret_kw, "global", 1)],
            active_sources=[],
        )
        pattern_id = trend_ingest.scan_batch_for_secret_pattern_id(batch, REPO_ROOT)
        self.assertEqual(pattern_id, "openai_proj_key")

    def test_push_posts_mutation_with_deploy_key_header(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=[],
        )
        captured: dict[str, object] = {}

        class FakeResponse:
            def getcode(self) -> int:
                return 200

            def read(self) -> bytes:
                return b'{"status":"success","value":null}'

            def __enter__(self):
                return self

            def __exit__(self, *args: object) -> None:
                return None

        def fake_urlopen(request: object, timeout: int = 30) -> FakeResponse:
            captured["request"] = request
            return FakeResponse()

        trend_ingest.push_signal_batch(
            batch,
            convex_url="https://happy-otter-123.convex.cloud/",
            deploy_key="deploy-key-secret",
            urlopen=fake_urlopen,
        )
        request = captured["request"]
        self.assertEqual(
            request.full_url,  # type: ignore[attr-defined]
            "https://happy-otter-123.convex.cloud/api/mutation",
        )
        self.assertEqual(request.get_header("Authorization"), "Convex deploy-key-secret")  # type: ignore[attr-defined]
        body = json.loads(request.data.decode("utf-8"))  # type: ignore[attr-defined]
        self.assertEqual(body["path"], "trends:ingestSignalBatch")
        self.assertIn("batch", body["args"])

    def test_push_succeeds_with_empty_events_and_signal_sources_patch(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=["news"],
        )
        batch.signal_sources = [
            {
                "name": "news",
                "status": "ok",
                "lastRun": 100,
                "errorCount": 0,
                "lastError": None,
            }
        ]
        self.assertEqual(batch.events, [])

        class FakeResponse:
            def getcode(self) -> int:
                return 200

            def read(self) -> bytes:
                return b'{"status":"success"}'

            def __enter__(self):
                return self

            def __exit__(self, *args: object) -> None:
                return None

        trend_ingest.push_signal_batch(
            batch,
            convex_url="https://example.convex.cloud",
            deploy_key="key",
            urlopen=lambda *_a, **_k: FakeResponse(),
        )

    def test_push_raises_on_convex_error_status(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=[],
        )

        class FakeResponse:
            def getcode(self) -> int:
                return 200

            def read(self) -> bytes:
                return (
                    b'{"status":"error","errorMessage":"validator rejected batch"}'
                )

            def __enter__(self):
                return self

            def __exit__(self, *args: object) -> None:
                return None

        with self.assertRaises(RuntimeError) as ctx:
            trend_ingest.push_signal_batch(
                batch,
                convex_url="https://example.convex.cloud",
                deploy_key="key",
                urlopen=lambda *_a, **_k: FakeResponse(),
            )
        self.assertIn("validator rejected batch", str(ctx.exception))

    def test_push_raises_on_unexpected_status_with_error_message(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=[],
        )

        class FakeResponse:
            def getcode(self) -> int:
                return 200

            def read(self) -> bytes:
                return b'{"status":"pending","errorMessage":"still processing"}'

            def __enter__(self):
                return self

            def __exit__(self, *args: object) -> None:
                return None

        with self.assertRaises(RuntimeError) as ctx:
            trend_ingest.push_signal_batch(
                batch,
                convex_url="https://example.convex.cloud",
                deploy_key="key",
                urlopen=lambda *_a, **_k: FakeResponse(),
            )
        self.assertIn("still processing", str(ctx.exception))

    def test_push_raises_on_http_error(self) -> None:
        import urllib.error

        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=[],
        )

        def raise_http_error(request: object, timeout: int = 30) -> None:
            raise urllib.error.HTTPError(
                url="https://example.convex.cloud/api/mutation",
                code=401,
                msg="Unauthorized",
                hdrs=None,
                fp=None,
            )

        with self.assertRaises(RuntimeError) as ctx:
            trend_ingest.push_signal_batch(
                batch,
                convex_url="https://example.convex.cloud",
                deploy_key="key",
                urlopen=raise_http_error,
            )
        self.assertIn("Convex HTTP 401", str(ctx.exception))

    def test_push_raises_on_non_2xx_status(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        batch = build_batch(
            watchlist=[WatchlistEntry("slug-a", "Keyword", "global", 100)],
            active_sources=[],
        )

        class FakeResponse:
            def getcode(self) -> int:
                return 503

            def read(self) -> bytes:
                return b"service unavailable"

            def __enter__(self):
                return self

            def __exit__(self, *args: object) -> None:
                return None

        with self.assertRaises(RuntimeError) as ctx:
            trend_ingest.push_signal_batch(
                batch,
                convex_url="https://example.convex.cloud",
                deploy_key="key",
                urlopen=lambda *_a, **_k: FakeResponse(),
            )
        self.assertIn("Convex HTTP 503", str(ctx.exception))

    def test_load_secret_patterns_requires_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError) as ctx:
                trend_ingest.load_secret_patterns(Path(tmp))
            self.assertIn("not found", str(ctx.exception))

    def test_load_secret_patterns_rejects_empty_compiled_list(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            patterns_path = root / "config" / "secret-patterns.json"
            patterns_path.parent.mkdir(parents=True)
            patterns_path.write_text('{"patterns": []}\n', encoding="utf-8")
            with self.assertRaises(ValueError) as ctx:
                trend_ingest.load_secret_patterns(root)
            self.assertIn("no valid secret patterns", str(ctx.exception))


class GoogleTrendsCollectorTests(unittest.TestCase):
    def test_dedupe_key_uses_utc_hour_floor(self) -> None:
        collected_at = 1_746_000_000_000  # 2025-05-01T12:34:56Z approx
        key_a = trend_ingest.dedupe_key_for_event(
            topic_slug="ai-agents",
            source="google_trends",
            signal_type="search_volume",
            collected_at_ms=collected_at,
            window_hours=168,
        )
        key_b = trend_ingest.dedupe_key_for_event(
            topic_slug="ai-agents",
            source="google_trends",
            signal_type="search_volume",
            collected_at_ms=collected_at + 30_000,
            window_hours=168,
        )
        self.assertEqual(key_a, key_b)
        self.assertEqual(len(key_a), 64)

    def test_build_google_trends_event_shape(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("ai-agents", "AI agents", "global", 1)
        event = trend_ingest.build_google_trends_event(
            entry,
            interest=72,
            ingest_run_id="550e8400-e29b-41d4-a716-446655440000",
            collected_at_ms=1_746_000_000_000,
        )
        self.assertEqual(event["source"], "google_trends")
        self.assertEqual(event["signalType"], "search_volume")
        self.assertEqual(event["normalizedValue"], 0.72)
        self.assertEqual(
            event["metadata"]["normalisationMethod"],
            "trends_interest_over_100",
        )
        self.assertEqual(event["ingestRunId"], "550e8400-e29b-41d4-a716-446655440000")

    def test_collect_emits_events_for_each_keyword(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [
            WatchlistEntry("a", "A", "global", 1),
            WatchlistEntry("b", "B", "global", 1),
        ]

        def fetch(_entry: object) -> int:
            return 50

        events, patch = trend_ingest.collect_google_trends(
            entries,
            ingest_run_id="run-1",
            collected_at_ms=1_746_000_000_000,
            interest_fetcher=fetch,
        )
        self.assertEqual(len(events), 2)
        self.assertEqual(patch["status"], "ok")
        self.assertEqual(patch["errorCount"], 0)

    def test_collect_continues_after_keyword_error(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [
            WatchlistEntry("a", "A", "global", 1),
            WatchlistEntry("b", "B", "global", 1),
        ]
        calls: list[str] = []

        def fetch(entry: object) -> int:
            slug = getattr(entry, "topic_slug")
            calls.append(slug)
            if slug == "a":
                raise trend_ingest.TrendsEmptyResponseError("empty")
            return 40

        events, patch = trend_ingest.collect_google_trends(
            entries,
            ingest_run_id="run-1",
            collected_at_ms=1_746_000_000_000,
            interest_fetcher=fetch,
        )
        self.assertEqual(calls, ["a", "b"])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["topicSlug"], "b")
        self.assertEqual(patch["status"], "partial")

    def test_collect_rate_limit_aborts_remaining_keywords(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [
            WatchlistEntry("a", "A", "global", 1),
            WatchlistEntry("b", "B", "global", 1),
            WatchlistEntry("c", "C", "global", 1),
        ]
        calls: list[str] = []

        def fetch(entry: object) -> int:
            slug = getattr(entry, "topic_slug")
            calls.append(slug)
            if slug == "b":
                raise trend_ingest.TrendsRateLimitError("429")
            return 10

        events, patch = trend_ingest.collect_google_trends(
            entries,
            ingest_run_id="run-1",
            collected_at_ms=1_746_000_000_000,
            interest_fetcher=fetch,
        )
        self.assertEqual(calls, ["a", "b"])
        self.assertEqual(len(events), 1)
        self.assertEqual(patch["status"], "partial")
        self.assertIn("rate limited", patch["lastError"] or "")

    def test_collect_empty_response_emits_no_zero_event(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [WatchlistEntry("a", "A", "global", 1)]

        def fetch(_entry: object) -> int:
            raise trend_ingest.TrendsEmptyResponseError("captcha")

        events, patch = trend_ingest.collect_google_trends(
            entries,
            ingest_run_id="run-1",
            collected_at_ms=1_746_000_000_000,
            interest_fetcher=fetch,
        )
        self.assertEqual(events, [])
        self.assertEqual(patch["status"], "error")

    def test_trends_geo_uppercases_non_global_region(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("kw", "keyword", "us", 1)
        self.assertEqual(trend_ingest._trends_geo_for_entry(entry), "US")
        self.assertEqual(
            trend_ingest._trends_geo_for_entry(
                WatchlistEntry("kw", "keyword", "global", 1)
            ),
            "",
        )

    def test_exception_is_trends_rate_limit_ignores_bare_403_substring(self) -> None:
        self.assertFalse(
            trend_ingest._exception_is_trends_rate_limit(
                ValueError("connection failed on port 40322")
            )
        )

    def test_fetch_google_trends_interest_returns_latest_interest(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("ai-agents", "AI agents", "global", 1)

        class _Iloc:
            def __init__(self, values: list[int]) -> None:
                self._values = values

            def __getitem__(self, idx: int) -> int:
                return self._values[idx]

        class FakeSeries:
            def __init__(self, values: list[int]) -> None:
                self._values = values

            @property
            def empty(self) -> bool:
                return not self._values

            def dropna(self) -> "FakeSeries":
                return self

            @property
            def iloc(self) -> _Iloc:
                return _Iloc(self._values)

        class FakeFrame:
            empty = False
            columns = ["AI agents", "isPartial"]

            def drop(self, columns: list[str] | None = None) -> "FakeFrame":
                return self

            def __getitem__(self, key: str) -> FakeSeries:
                return FakeSeries([40, 72])

        class FakeTrendClient:
            last_geo: str | None = None

            def build_payload(
                self, keywords: list[str], timeframe: str, geo: str
            ) -> None:
                FakeTrendClient.last_geo = geo
                self.keywords = keywords

            def interest_over_time(self) -> FakeFrame:
                return FakeFrame()

        client = FakeTrendClient()
        interest = trend_ingest.fetch_google_trends_interest(
            entry, trend_client=client
        )
        self.assertEqual(interest, 72)
        self.assertEqual(FakeTrendClient.last_geo, "")

    def test_fetch_google_trends_interest_empty_frame_raises(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("a", "A", "global", 1)

        class EmptyFrame:
            empty = True
            columns: list[str] = []

        class FakeTrendClient:
            def build_payload(self, *_a: object, **_k: object) -> None:
                return None

            def interest_over_time(self) -> EmptyFrame:
                return EmptyFrame()

        with self.assertRaises(trend_ingest.TrendsEmptyResponseError):
            trend_ingest.fetch_google_trends_interest(
                entry, trend_client=FakeTrendClient()
            )

    def test_fetch_google_trends_interest_http_429_raises_rate_limit(self) -> None:
        import urllib.error

        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("a", "A", "global", 1)

        class FakeTrendClient:
            def build_payload(self, *_a: object, **_k: object) -> None:
                raise urllib.error.HTTPError(
                    url="https://trends.google.com",
                    code=429,
                    msg="Too Many Requests",
                    hdrs=None,
                    fp=None,
                )

        with self.assertRaises(trend_ingest.TrendsRateLimitError):
            trend_ingest.fetch_google_trends_interest(
                entry, trend_client=FakeTrendClient()
            )

    def test_collect_reuses_single_trend_client(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [
            WatchlistEntry("a", "A", "global", 1),
            WatchlistEntry("b", "B", "global", 1),
        ]
        instances: list[object] = []

        class FakeTrendReq:
            def __init__(self, *args: object, **kwargs: object) -> None:
                instances.append(self)

            def build_payload(self, *_a: object, **_k: object) -> None:
                return None

            def interest_over_time(self) -> object:
                raise trend_ingest.TrendsEmptyResponseError("empty")

        with patch.object(trend_ingest, "_TrendReq", FakeTrendReq):
            trend_ingest.collect_google_trends(
                entries,
                ingest_run_id="run-1",
                collected_at_ms=1_746_000_000_000,
            )
        self.assertEqual(len(instances), 1)


class NormCacheTests(unittest.TestCase):
    def test_minmax_first_sample_is_neutral(self) -> None:
        self.assertEqual(trend_ingest.minmax_normalize_7d(10, []), 0.5)

    def test_minmax_scales_between_history_bounds(self) -> None:
        history = [{"v": 0, "t": 1}, {"v": 100, "t": 2}]
        self.assertEqual(trend_ingest.minmax_normalize_7d(50, history), 0.5)

    def test_load_save_norm_cache_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.json"
            cache = {"version": 1, "entries": {}}
            trend_ingest.record_norm_cache_sample(
                cache,
                topic_slug="a",
                source="reddit",
                value=12,
                collected_at_ms=1_746_000_000_000,
            )
            trend_ingest.save_norm_cache(path, cache)
            loaded = trend_ingest.load_norm_cache(path)
            key = trend_ingest.norm_cache_storage_key("a", "reddit")
            self.assertEqual(len(loaded["entries"][key]["samples"]), 1)


class RedditNewsCollectorTests(unittest.TestCase):
    def test_collect_reddit_emits_minmax_event(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("ai-agents", "AI agents", "global", 1)
        cache = {"version": 1, "entries": {}}

        def fetch(_entry: object) -> float:
            return 20.0

        events, patch = trend_ingest.collect_reddit(
            [entry],
            ingest_run_id="run-1",
            norm_cache=cache,
            env={},
            collected_at_ms=1_746_000_000_000,
            count_fetcher=fetch,
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["signalType"], "mention_count")
        self.assertEqual(events[0]["metadata"]["normalisationMethod"], "reddit_7d_minmax")
        self.assertEqual(events[0]["metadata"]["rawValue"], 20.0)
        self.assertEqual(events[0]["value"], 20.0)
        self.assertEqual(patch["status"], "ok")

    def test_collect_news_updates_cache_before_return(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entry = WatchlistEntry("topic-a", "Topic A", "global", 1)
        cache = {"version": 1, "entries": {}}

        events, _patch = trend_ingest.collect_news(
            [entry],
            ingest_run_id="run-1",
            norm_cache=cache,
            env={"NEWSAPI_API_KEY": "test"},
            collected_at_ms=1_746_000_000_000,
            count_fetcher=lambda _e: 5.0,
        )
        self.assertEqual(len(events), 1)
        key = trend_ingest.norm_cache_storage_key("topic-a", "news")
        self.assertEqual(len(cache["entries"][key]["samples"]), 1)

    def test_collect_reddit_continues_after_keyword_error(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        entries = [
            WatchlistEntry("a", "A", "global", 1),
            WatchlistEntry("b", "B", "global", 1),
        ]
        cache = {"version": 1, "entries": {}}

        def fetch(entry: object) -> float:
            if getattr(entry, "topic_slug") == "a":
                raise trend_ingest.CollectorKeywordError("fail")
            return 3.0

        events, patch = trend_ingest.collect_reddit(
            entries,
            ingest_run_id="run-1",
            norm_cache=cache,
            env={},
            collected_at_ms=1_746_000_000_000,
            count_fetcher=fetch,
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["topicSlug"], "b")
        self.assertEqual(patch["status"], "partial")

    def test_run_collects_reddit_and_news_when_both_sourced(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        reddit_patch = trend_ingest.build_signal_source_patch(
            "reddit",
            status="ok",
            last_run_ms=1,
            error_count=0,
            last_error=None,
        )
        news_patch = trend_ingest.build_signal_source_patch(
            "news",
            status="ok",
            last_run_ms=1,
            error_count=0,
            last_error=None,
        )
        fake_reddit_event = trend_ingest.build_minmax_signal_event(
            WatchlistEntry("a", "A", "global", 1),
            source="reddit",
            signal_type="mention_count",
            raw_value=1,
            normalized_value=0.5,
            norm_method="reddit_7d_minmax",
            ingest_run_id="run-1",
            collected_at_ms=1,
            window_hours=trend_ingest.REDDIT_NEWS_WINDOW_HOURS,
        )
        fake_news_event = trend_ingest.build_minmax_signal_event(
            WatchlistEntry("b", "B", "global", 1),
            source="news",
            signal_type="article_count",
            raw_value=2,
            normalized_value=0.5,
            norm_method="news_7d_minmax",
            ingest_run_id="run-1",
            collected_at_ms=1,
            window_hours=trend_ingest.REDDIT_NEWS_WINDOW_HOURS,
        )
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text(
                "version: 1\nkeywords:\n  - A\n  - B\n",
                encoding="utf-8",
            )
            cache_path = Path(tmp) / "cache.json"
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(
                    trend_ingest,
                    "_default_ingest_env_path",
                    return_value=Path(tmp) / "missing.env",
                ):
                    with patch.object(
                        trend_ingest, "_default_norm_cache_path", return_value=cache_path
                    ):
                        with patch.object(trend_ingest, "_TrendReq", object()):
                            with patch.object(trend_ingest, "_praw", object()):
                                with patch.object(
                                    trend_ingest,
                                    "collect_reddit",
                                    return_value=([fake_reddit_event], reddit_patch),
                                ):
                                    with patch.object(
                                        trend_ingest,
                                        "collect_news",
                                        return_value=([fake_news_event], news_patch),
                                    ):
                                        env = Path(tmp) / "trend-ingest.env"
                                        env.write_text(
                                            "CONVEX_URL=https://example.convex.cloud\n"
                                            "CONVEX_DEPLOY_KEY=test-key\n",
                                            encoding="utf-8",
                                        )
                                        with patch.object(
                                            trend_ingest,
                                            "_default_ingest_env_path",
                                            return_value=env,
                                        ):
                                            with patch.object(
                                                trend_ingest, "push_signal_batch"
                                            ):
                                                code = run(
                                                    ["--sources", "reddit,news"]
                                                )
                                            self.assertEqual(code, 0)
                                            self.assertTrue(cache_path.is_file())

    def test_reddit_failure_still_runs_news(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        news_patch = trend_ingest.build_signal_source_patch(
            "news",
            status="ok",
            last_run_ms=1,
            error_count=0,
            last_error=None,
        )
        fake_news_event = trend_ingest.build_minmax_signal_event(
            WatchlistEntry("b", "B", "global", 1),
            source="news",
            signal_type="article_count",
            raw_value=2,
            normalized_value=0.5,
            norm_method="news_7d_minmax",
            ingest_run_id="run-1",
            collected_at_ms=1,
            window_hours=trend_ingest.REDDIT_NEWS_WINDOW_HOURS,
        )

        def fail_reddit(*_a: object, **_k: object) -> tuple[list, dict]:
            raise ValueError("reddit credentials missing")

        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - B\n", encoding="utf-8")
            cache_path = Path(tmp) / "cache.json"
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(
                    trend_ingest,
                    "_default_ingest_env_path",
                    return_value=Path(tmp) / "missing.env",
                ):
                    with patch.object(
                        trend_ingest, "_default_norm_cache_path", return_value=cache_path
                    ):
                        with patch.object(trend_ingest, "_praw", object()):
                            with patch.object(
                                trend_ingest, "collect_reddit", side_effect=fail_reddit
                            ):
                                with patch.object(
                                    trend_ingest,
                                    "collect_news",
                                    return_value=([fake_news_event], news_patch),
                                ):
                                    from io import StringIO

                                    buf = StringIO()
                                    with patch("sys.stdout", buf):
                                        code = run(
                                            ["--dry-run", "--sources", "reddit,news"]
                                        )
        self.assertEqual(code, 0)
        payload = json.loads(buf.getvalue())
        self.assertEqual(payload["signalSources"][0]["name"], "reddit")
        self.assertEqual(payload["signalSources"][0]["status"], "error")
        self.assertEqual(payload["signalSources"][1]["name"], "news")
        self.assertEqual(len(payload["events"]), 1)


@unittest.skipUnless(_yaml is not None, "PyYAML required")
class PushCliTests(unittest.TestCase):
    def _write_env(self, path: Path, lines: list[str]) -> None:
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_push_missing_credentials_exits_one(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - safe topic\n", encoding="utf-8")
            env = Path(tmp) / "trend-ingest.env"
            self._write_env(env, ["# no convex vars"])
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(trend_ingest, "_default_ingest_env_path", return_value=env):
                    code = run([])
        self.assertEqual(code, 1)

    def test_push_aborts_when_batch_matches_secret_pattern(self) -> None:
        secret = "sk-proj-abcdefghijklmnopqrstuvwxyz123456"
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text(f"version: 1\nkeywords:\n  - {secret}\n", encoding="utf-8")
            env = Path(tmp) / "trend-ingest.env"
            self._write_env(
                env,
                [
                    "CONVEX_URL=https://example.convex.cloud",
                    "CONVEX_DEPLOY_KEY=test-key",
                ],
            )
            calls: list[object] = []

            def fail_if_called(*_a: object, **_k: object) -> None:
                calls.append(True)
                raise AssertionError("push should not run when secret pattern matches")

            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(trend_ingest, "_default_ingest_env_path", return_value=env):
                    with patch.object(trend_ingest, "push_signal_batch", side_effect=fail_if_called):
                        code = run([])
        self.assertEqual(code, 1)
        self.assertEqual(calls, [])

    def test_push_success_exits_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - safe topic\n", encoding="utf-8")
            env = Path(tmp) / "trend-ingest.env"
            self._write_env(
                env,
                [
                    "CONVEX_URL=https://example.convex.cloud",
                    "CONVEX_DEPLOY_KEY=test-key",
                ],
            )
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(trend_ingest, "_default_ingest_env_path", return_value=env):
                    with patch.object(trend_ingest, "push_signal_batch"):
                        err = io.StringIO()
                        with patch("sys.stderr", err):
                            code = run([])
        self.assertEqual(code, 0)
        self.assertIn("pushed watchlist", err.getvalue())

    def test_push_failure_from_convex_exits_one(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - safe topic\n", encoding="utf-8")
            env = Path(tmp) / "trend-ingest.env"
            self._write_env(
                env,
                [
                    "CONVEX_URL=https://example.convex.cloud",
                    "CONVEX_DEPLOY_KEY=test-key",
                ],
            )

            def fail_push(*_a: object, **_k: object) -> None:
                raise RuntimeError("Convex HTTP 500: Server Error")

            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(trend_ingest, "_default_ingest_env_path", return_value=env):
                    with patch.object(trend_ingest, "push_signal_batch", side_effect=fail_push):
                        code = run([])
        self.assertEqual(code, 1)

    def test_push_google_trends_health_only_exits_zero(self) -> None:
        WatchlistEntry = trend_ingest.WatchlistEntry
        health_patch = trend_ingest.build_google_trends_source_patch(
            status="error",
            last_run_ms=1_746_000_000_000,
            error_count=1,
            last_error=None,
        )
        with tempfile.TemporaryDirectory() as tmp:
            wl = Path(tmp) / "watchlist.yaml"
            wl.write_text("version: 1\nkeywords:\n  - safe topic\n", encoding="utf-8")
            env = Path(tmp) / "trend-ingest.env"
            self._write_env(
                env,
                [
                    "CONVEX_URL=https://example.convex.cloud",
                    "CONVEX_DEPLOY_KEY=test-key",
                ],
            )
            with patch.object(trend_ingest, "_default_watchlist_path", return_value=wl):
                with patch.object(trend_ingest, "_default_ingest_env_path", return_value=env):
                    with patch.object(trend_ingest, "_TrendReq", object()):
                        with patch.object(
                            trend_ingest,
                            "collect_google_trends",
                            return_value=([], health_patch),
                        ):
                            with patch.object(trend_ingest, "push_signal_batch") as push_mock:
                                code = run(["--sources", "google_trends"])
        self.assertEqual(code, 0)
        pushed = push_mock.call_args[0][0]
        self.assertEqual(pushed.events, [])
        self.assertEqual(pushed.signal_sources[0]["name"], "google_trends")


if __name__ == "__main__":
    unittest.main()
